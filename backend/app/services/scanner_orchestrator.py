import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List

from app.models.schemas import Finding, ScanSummary
from app.services.repo_handler import detect_languages
from app.services.semgrep_scanner import run_semgrep_scan
from app.services.bandit_scanner import run_bandit_scan
from app.services.eslint_scanner import run_eslint_scan

# Thread pool for running blocking scanner subprocesses
_executor = ThreadPoolExecutor(max_workers=3)


async def run_all_scanners(repo_path: str, languages: List[str]) -> tuple[List[Finding], List[str]]:
    """
    Run all applicable scanners based on detected languages.
    Returns (findings, scanners_used).
    """
    loop = asyncio.get_event_loop()
    tasks = []
    scanners_used = []

    # Semgrep always runs (supports many languages)
    tasks.append(loop.run_in_executor(_executor, run_semgrep_scan, repo_path))
    scanners_used.append("semgrep")

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
            # Log but don't fail the whole scan
            continue
        all_findings.extend(result)

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
