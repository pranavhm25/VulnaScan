import os
import shutil
import uuid
import git

from app.config import settings


class RepoTooLargeError(Exception):
    pass


class InvalidRepoURLError(Exception):
    pass


def validate_github_url(url: str) -> None:
    """Validate that the URL looks like a public GitHub repo."""
    import re

    pattern = r"^https?://github\.com/[\w\-\.]+/[\w\-\.]+/?$"
    if not re.match(pattern, url):
        raise InvalidRepoURLError(
            "URL must be a valid public GitHub repository (https://github.com/owner/repo)"
        )


def clone_repo(repo_url: str) -> str:
    """
    Shallow-clone a public GitHub repo into a unique temp directory.
    Returns the path to the cloned repo.
    Raises RepoTooLargeError if the repo exceeds the configured size limit.
    Raises InvalidRepoURLError if the URL doesn't match GitHub format.
    """
    validate_github_url(repo_url)

    target_dir = os.path.join(settings.tmp_repo_dir, str(uuid.uuid4()))
    os.makedirs(target_dir, exist_ok=True)

    try:
        # Shallow clone to avoid pulling full history
        git.Repo.clone_from(
            repo_url,
            target_dir,
            depth=1,
            single_branch=True,
            env={"GIT_TERMINAL_PROMPT": "0"},  # prevent interactive prompts
        )
    except git.GitCommandError as e:
        cleanup_repo(target_dir)
        raise RuntimeError(f"Git clone failed: {e.stderr.strip()}")

    # Enforce size limit
    total_size = _get_dir_size(target_dir)
    max_bytes = settings.max_repo_size_mb * 1024 * 1024
    if total_size > max_bytes:
        cleanup_repo(target_dir)
        raise RepoTooLargeError(
            f"Repository exceeds size limit of {settings.max_repo_size_mb} MB"
        )

    return target_dir


def detect_languages(repo_path: str) -> list[str]:
    """Detect programming languages present in the repo by file extensions."""
    extensions_map = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".java": "java",
        ".go": "go",
        ".rb": "ruby",
        ".php": "php",
        ".c": "c",
        ".cpp": "cpp",
        ".cs": "csharp",
        ".rs": "rust",
        ".swift": "swift",
        ".kt": "kotlin",
    }
    found = set()
    for dirpath, _, filenames in os.walk(repo_path):
        # Skip hidden dirs and node_modules
        if any(
            part.startswith(".") or part == "node_modules"
            for part in dirpath.split(os.sep)
        ):
            continue
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in extensions_map:
                found.add(extensions_map[ext])
    return sorted(found)


def cleanup_repo(path: str) -> None:
    """Remove a cloned repo directory, ignoring errors on missing paths."""
    shutil.rmtree(path, ignore_errors=True)


def _get_dir_size(path: str) -> int:
    total = 0
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if os.path.exists(fp):
                total += os.path.getsize(fp)
    return total
