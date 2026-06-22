import uuid
import asyncio
from typing import Dict

from fastapi import APIRouter, HTTPException

from app.models.schemas import ScanRequest, ScanResponse, ScanStatus, Finding
from app.services.repo_handler import (
    clone_repo,
    cleanup_repo,
    detect_languages,
    RepoTooLargeError,
    InvalidRepoURLError,
)
from app.services.scanner_orchestrator import run_all_scanners, build_summary
from app.services.gemini_explainer import explain_findings, explain_single_finding
from app.services.diff_parser import fetch_pr_diff, fetch_branch_diff

router = APIRouter(prefix="/api", tags=["scan"])

# In-memory store for async scan results
_scans: Dict[str, ScanStatus] = {}


@router.post("/scan", response_model=ScanStatus)
async def start_scan(request: ScanRequest) -> ScanStatus:
    """
    Start an async vulnerability scan.
    Returns a scan_id immediately; poll GET /api/scan/{scan_id} for results.
    """
    scan_id = str(uuid.uuid4())
    repo_url = str(request.repo_url)

    # Validate URL before starting
    try:
        from app.services.repo_handler import validate_github_url
        validate_github_url(repo_url)
    except InvalidRepoURLError as e:
        raise HTTPException(status_code=400, detail=str(e))

    _scans[scan_id] = ScanStatus(
        scan_id=scan_id,
        status="queued",
        progress_message="Scan queued...",
    )

    # Launch the scan as a background task
    asyncio.create_task(_run_scan(
        scan_id,
        repo_url,
        branch=request.branch,
        pr_number=request.pr_number,
        scan_diff_only=request.scan_diff_only,
    ))

    return _scans[scan_id]


@router.get("/scan/{scan_id}", response_model=ScanStatus)
async def get_scan_status(scan_id: str) -> ScanStatus:
    """Poll for scan progress and results."""
    if scan_id not in _scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    return _scans[scan_id]


@router.post("/findings/explain", response_model=Finding)
async def retry_explain(finding: Finding) -> Finding:
    """
    Re-explain a single finding using the Gemini API.
    Used by the frontend retry button when an explanation fails.
    """
    return await explain_single_finding(finding)


async def _run_scan(
    scan_id: str,
    repo_url: str,
    branch: str = None,
    pr_number: int = None,
    scan_diff_only: bool = False,
) -> None:
    """Background scan pipeline: clone → detect → scan → explain → respond."""
    repo_path = None

    try:
        # Step 1: Clone
        _scans[scan_id].status = "cloning"

        clone_target = "repository"
        if pr_number:
            clone_target = f"PR #{pr_number}"
        elif branch:
            clone_target = f"branch '{branch}'"

        _scans[scan_id].progress_message = f"Cloning {clone_target}..."

        # Run blocking clone in thread pool
        loop = asyncio.get_event_loop()
        repo_path = await loop.run_in_executor(
            None, clone_repo, repo_url, branch, pr_number
        )

        # Step 2: Detect languages
        languages = await loop.run_in_executor(None, detect_languages, repo_path)

        # Step 3: Fetch diff (if scanning diff only)
        diff_map = None
        if scan_diff_only:
            _scans[scan_id].progress_message = "Fetching diff for changed files..."
            if pr_number:
                diff_map = await fetch_pr_diff(repo_url, pr_number)
            elif branch:
                diff_map = await fetch_branch_diff(repo_url, branch)

            if not diff_map:
                # Fallback: scan everything if diff fetch fails
                scan_diff_only = False

        # Step 4: Scan
        _scans[scan_id].status = "scanning"
        scan_scope = "changed code" if diff_map else f"{', '.join(languages) or 'unknown'} code"
        _scans[scan_id].progress_message = f"Running security scanners on {scan_scope}..."

        findings, scanners_used = await run_all_scanners(
            repo_path, languages, diff_map=diff_map
        )

        # Step 5: LLM explanations
        _scans[scan_id].status = "analyzing"
        _scans[scan_id].progress_message = f"AI analyzing {len(findings)} findings..."

        findings = await explain_findings(findings)

        # Step 6: Build result
        summary = build_summary(findings)

        _scans[scan_id].status = "complete"
        _scans[scan_id].progress_message = "Scan complete!"
        _scans[scan_id].result = ScanResponse(
            repo_url=repo_url,
            total_findings=len(findings),
            languages_detected=languages,
            scanners_used=scanners_used,
            branch=branch,
            pr_number=pr_number,
            scan_diff_only=scan_diff_only,
            findings=findings,
            summary=summary,
        )

    except RepoTooLargeError as e:
        _scans[scan_id].status = "failed"
        _scans[scan_id].error = str(e)
        _scans[scan_id].progress_message = "Repository too large"

    except Exception as e:
        _scans[scan_id].status = "failed"
        _scans[scan_id].error = f"Scan failed: {str(e)[:500]}"
        _scans[scan_id].progress_message = "Scan encountered an error"

    finally:
        if repo_path:
            cleanup_repo(repo_path)
