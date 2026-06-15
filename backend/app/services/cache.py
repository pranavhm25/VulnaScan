import json
import hashlib
import os
import time
from typing import Optional

from app.config import settings


def _cache_key(rule_id: str, code_snippet: str, file_path: str) -> str:
    """Generate a deterministic cache key from finding attributes."""
    raw = f"{rule_id}|{code_snippet}|{file_path}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _cache_file_path(key: str) -> str:
    """Return the full path for a cache entry."""
    return os.path.join(settings.cache_dir, f"{key}.json")


def get_cached(rule_id: str, code_snippet: str, file_path: str) -> Optional[dict]:
    """
    Look up a cached LLM explanation.
    Returns {"explanation": ..., "fix_suggestion": ...} or None.
    """
    key = _cache_key(rule_id, code_snippet, file_path)
    path = _cache_file_path(key)

    if not os.path.exists(path):
        return None

    try:
        with open(path, "r") as f:
            entry = json.load(f)
    except (json.JSONDecodeError, OSError):
        return None

    # Check TTL
    created_at = entry.get("created_at", 0)
    if time.time() - created_at > settings.cache_ttl_seconds:
        # Expired — remove and return None
        try:
            os.remove(path)
        except OSError:
            pass
        return None

    return entry.get("data")


def set_cached(rule_id: str, code_snippet: str, file_path: str, data: dict) -> None:
    """Store an LLM explanation result in the file cache."""
    os.makedirs(settings.cache_dir, exist_ok=True)
    key = _cache_key(rule_id, code_snippet, file_path)
    path = _cache_file_path(key)

    entry = {
        "created_at": time.time(),
        "data": data,
    }

    try:
        with open(path, "w") as f:
            json.dump(entry, f)
    except OSError:
        pass  # cache write failure is non-fatal


def clear_expired() -> int:
    """Remove expired cache entries. Returns count of entries removed."""
    if not os.path.exists(settings.cache_dir):
        return 0

    removed = 0
    for filename in os.listdir(settings.cache_dir):
        if not filename.endswith(".json"):
            continue
        path = os.path.join(settings.cache_dir, filename)
        try:
            with open(path, "r") as f:
                entry = json.load(f)
            if time.time() - entry.get("created_at", 0) > settings.cache_ttl_seconds:
                os.remove(path)
                removed += 1
        except (json.JSONDecodeError, OSError):
            # Corrupted cache file — remove it
            try:
                os.remove(path)
                removed += 1
            except OSError:
                pass

    return removed
