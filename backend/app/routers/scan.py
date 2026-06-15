import uuid
import asyncio
from typing import Dict

from fastapi import APIRouter, HTTPException

from app.models.schemas import ScanRequest, ScanResponse, ScanStatus
from app.services.repo_handler import (
    clone_repo,
    cleanup_repo,
    detect_languages,
    RepoTooLargeError,
    InvalidRepoURLError,
)
from app.services.scanner_orchestrator import run_all_scanners, build_summary
from app.services.gemini_explainer import explain_findings

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
    asyncio.create_task(_run_scan(scan_id, repo_url))

    return _scans[scan_id]


@router.get("/scan/{scan_id}", response_model=ScanStatus)
async def get_scan_status(scan_id: str) -> ScanStatus:
    """Poll for scan progress and results."""
    if scan_id not in _scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    return _scans[scan_id]


async def _run_scan(scan_id: str, repo_url: str) -> None:
    """Background scan pipeline: clone → detect → scan → explain → respond."""
    repo_path = None

    try:
        # Step 1: Clone
        _scans[scan_id].status = "cloning"
        _scans[scan_id].progress_message = "Cloning repository..."

        # Run blocking clone in thread pool
        loop = asyncio.get_event_loop()
        repo_path = await loop.run_in_executor(None, clone_repo, repo_url)

        # Step 2: Detect languages
        languages = await loop.run_in_executor(None, detect_languages, repo_path)

        # Step 3: Scan
        _scans[scan_id].status = "scanning"
        _scans[scan_id].progress_message = f"Running security scanners on {', '.join(languages) or 'unknown'} code..."

        findings, scanners_used = await run_all_scanners(repo_path, languages)

        # Step 4: LLM explanations
        _scans[scan_id].status = "analyzing"
        _scans[scan_id].progress_message = f"AI analyzing {len(findings)} findings..."

        findings = await explain_findings(findings)

        # Step 5: Build result
        summary = build_summary(findings)

        _scans[scan_id].status = "complete"
        _scans[scan_id].progress_message = "Scan complete!"
        _scans[scan_id].result = ScanResponse(
            repo_url=repo_url,
            total_findings=len(findings),
            languages_detected=languages,
            scanners_used=scanners_used,
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
