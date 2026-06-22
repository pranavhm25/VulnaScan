"""
Diff Parser Service

Downloads and parses GitHub pull request or branch comparison diffs
to extract a map of modified file paths to their changed line numbers.
Used by the scanner orchestrator to filter findings to only those
affecting changed code when scan_diff_only is enabled.
"""
import re
import logging
from typing import Dict, Set, Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)


def _extract_owner_repo(repo_url: str) -> tuple[str, str]:
    """Extract (owner, repo) from a GitHub URL."""
    path = urlparse(repo_url).path.strip("/")
    # Remove trailing .git if present
    if path.endswith(".git"):
        path = path[:-4]
    parts = path.split("/")
    if len(parts) < 2:
        raise ValueError(f"Cannot parse owner/repo from URL: {repo_url}")
    return parts[0], parts[1]


def _parse_unified_diff(diff_text: str) -> Dict[str, Set[int]]:
    """
    Parse a unified diff and extract modified line numbers per file.
    Returns { 'path/to/file.py': {3, 4, 5, 12, 13}, ... }

    We track lines that were ADDED or MODIFIED in the new version
    (lines starting with '+' that aren't the diff header).
    """
    modified: Dict[str, Set[int]] = {}
    current_file: Optional[str] = None
    current_line = 0

    for line in diff_text.split("\n"):
        # Detect file header: +++ b/path/to/file.py
        if line.startswith("+++ b/"):
            current_file = line[6:]  # strip "+++ b/"
            if current_file not in modified:
                modified[current_file] = set()
            continue

        # Detect hunk header: @@ -old_start,old_count +new_start,new_count @@
        hunk_match = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", line)
        if hunk_match:
            current_line = int(hunk_match.group(1))
            continue

        if current_file is None:
            continue

        if line.startswith("+") and not line.startswith("+++"):
            # Added line in new version
            modified[current_file].add(current_line)
            current_line += 1
        elif line.startswith("-") and not line.startswith("---"):
            # Removed line — don't increment current_line (it's removed)
            pass
        else:
            # Context line
            current_line += 1

    return modified


async def fetch_pr_diff(repo_url: str, pr_number: int) -> Dict[str, Set[int]]:
    """
    Fetch the diff for a GitHub pull request and return modified line map.
    Uses the public .diff endpoint: https://github.com/owner/repo/pull/N.diff
    """
    owner, repo = _extract_owner_repo(repo_url)
    diff_url = f"https://github.com/{owner}/{repo}/pull/{pr_number}.diff"

    logger.info(f"Fetching PR diff from: {diff_url}")

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        response = await client.get(diff_url)
        if response.status_code != 200:
            logger.warning(f"Failed to fetch PR diff (HTTP {response.status_code}), falling back to full scan")
            return {}

        return _parse_unified_diff(response.text)


async def fetch_branch_diff(repo_url: str, branch: str) -> Dict[str, Set[int]]:
    """
    Fetch the diff between a branch and the default branch.
    Uses: https://github.com/owner/repo/compare/main...branch.diff

    We try 'main' first, then 'master' as fallback for the base branch.
    """
    owner, repo = _extract_owner_repo(repo_url)

    for base in ["main", "master"]:
        diff_url = f"https://github.com/{owner}/{repo}/compare/{base}...{branch}.diff"
        logger.info(f"Fetching branch diff from: {diff_url}")

        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            response = await client.get(diff_url)
            if response.status_code == 200:
                return _parse_unified_diff(response.text)

    logger.warning("Failed to fetch branch diff, falling back to full scan")
    return {}
