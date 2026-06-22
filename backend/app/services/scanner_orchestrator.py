import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Set, Optional

from app.models.schemas import Finding, ScanSummary
from app.services.repo_handler import detect_languages
from app.services.semgrep_scanner import run_semgrep_scan
from app.services.bandit_scanner import run_bandit_scan
from app.services.eslint_scanner import run_eslint_scan
from app.services.secrets_scanner import run_secrets_scan

logger = logging.getLogger(__name__)

# Thread pool for running blocking scanner subprocesses
_executor = ThreadPoolExecutor(max_workers=4)


def _filter_findings_by_diff(
    findings: List[Finding],
    diff_map: Dict[str, Set[int]],
) -> List[Finding]:
    """
    Filter findings to only those whose file and line range overlap
    with modified lines in the diff map.
    """
    filtered = []
    for f in findings:
        if f.file_path in diff_map:
            modified_lines = diff_map[f.file_path]
            finding_lines = set(range(f.start_line, f.end_line + 1))
            if finding_lines & modified_lines:
                filtered.append(f)
    return filtered


async def run_all_scanners(
    repo_path: str,
    languages: List[str],
    diff_map: Optional[Dict[str, Set[int]]] = None,
) -> tuple[List[Finding], List[str]]:
    """
    Run all applicable scanners based on detected languages.
    If diff_map is provided, filter findings to only those on modified lines.
    Returns (findings, scanners_used).
    """
    loop = asyncio.get_event_loop()
    tasks = []
    scanners_used = []

    # Semgrep always runs (supports many languages)
    tasks.append(loop.run_in_executor(_executor, run_semgrep_scan, repo_path))
    scanners_used.append("semgrep")

    # Secrets scanner always runs to check all text files
    tasks.append(loop.run_in_executor(_executor, run_secrets_scan, repo_path))
    scanners_used.append("secrets")

    # Bandit for Python repos
    if "python" in languages:
        tasks.append(loop.run_in_executor(_executor, run_bandit_scan, repo_path))
        scanners_used.append("bandit")

    # ESLint for JS/TS repos
    if "javascript" in languages or "typescript" in languages:
        tasks.append(loop.run_in_executor(_executor, run_eslint_scan, repo_path))
        scanners_used.append("eslint")

    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_findings: List[Finding] = []
    for result in results:
        if isinstance(result, Exception):
            logger.warning(f"Scanner error (skipping): {str(result)[:200]}")
            continue
        all_findings.extend(result)

    # Filter by diff if provided
    if diff_map:
        pre_count = len(all_findings)
        all_findings = _filter_findings_by_diff(all_findings, diff_map)
        logger.info(f"Diff filter: {pre_count} → {len(all_findings)} findings (only modified lines)")

    # Deduplicate across scanners by (file_path, start_line, category)
    seen = set()
    unique_findings: List[Finding] = []
    for f in all_findings:
        dedup_key = (f.file_path, f.start_line, f.category)
        if dedup_key not in seen:
            seen.add(dedup_key)
            unique_findings.append(f)

    # Sort by severity (High first) then by file path
    severity_order = {"High": 0, "Medium": 1, "Low": 2}
    unique_findings.sort(key=lambda f: (severity_order.get(f.severity, 3), f.file_path, f.start_line))

    return unique_findings, scanners_used


def build_summary(findings: List[Finding]) -> ScanSummary:
    """Build a structured summary from findings."""
    summary = ScanSummary()

    for f in findings:
        # By severity
        if f.severity in summary.by_severity:
            summary.by_severity[f.severity] += 1

        # By scanner
        summary.by_scanner[f.scanner] = summary.by_scanner.get(f.scanner, 0) + 1

        # By category
        cat = f.category or "Other"
        summary.by_category[cat] = summary.by_category.get(cat, 0) + 1

    return summary
