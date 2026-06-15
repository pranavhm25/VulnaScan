import json
import subprocess
import uuid
from typing import List

from app.config import settings
from app.models.schemas import Finding

# Map semgrep severities to display-friendly labels
SEVERITY_MAP = {
    "ERROR": "High",
    "WARNING": "Medium",
    "INFO": "Low",
}

# Map common semgrep rule ID patterns to vulnerability categories
CATEGORY_MAP = {
    "sql": "SQL Injection",
    "xss": "Cross-Site Scripting",
    "xxe": "XML External Entity",
    "ssrf": "Server-Side Request Forgery",
    "csrf": "Cross-Site Request Forgery",
    "injection": "Injection",
    "hardcoded": "Hardcoded Secrets",
    "secret": "Hardcoded Secrets",
    "password": "Hardcoded Secrets",
    "deserialization": "Insecure Deserialization",
    "crypto": "Weak Cryptography",
    "hash": "Weak Cryptography",
    "path-traversal": "Path Traversal",
    "redirect": "Open Redirect",
    "cors": "CORS Misconfiguration",
    "jwt": "JWT Issues",
    "command-injection": "Command Injection",
    "exec": "Command Injection",
    "eval": "Code Injection",
}


def _classify_category(rule_id: str, message: str) -> str:
    """Infer a vulnerability category from the rule ID and message text."""
    combined = (rule_id + " " + message).lower()
    for keyword, category in CATEGORY_MAP.items():
        if keyword in combined:
            return category
    return "Security Issue"


def _extract_cwe(metadata: dict) -> str | None:
    """Extract CWE ID from semgrep metadata if present."""
    cwe = metadata.get("cwe", [])
    if isinstance(cwe, list) and cwe:
        return cwe[0] if isinstance(cwe[0], str) else str(cwe[0])
    if isinstance(cwe, str):
        return cwe
    return None


def run_semgrep_scan(repo_path: str) -> List[Finding]:
    """
    Run semgrep with the security-focused 'p/security-audit' ruleset
    against the cloned repo and parse results into Finding objects.
    """
    cmd = [
        "semgrep",
        "scan",
        "--config", "p/security-audit",
        "--config", "p/owasp-top-ten",
        "--json",
        "--timeout", str(settings.scan_timeout_seconds),
        "--quiet",
        "--no-git-ignore",
        repo_path,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=settings.scan_timeout_seconds + 30,
    )

    if result.returncode not in (0, 1):  # 1 = findings found, still valid
        raise RuntimeError(f"Semgrep failed: {result.stderr[:500]}")

    data = json.loads(result.stdout or "{}")
    raw_results = data.get("results", [])

    findings: List[Finding] = []
    seen = set()  # deduplicate across rulesets

    for r in raw_results:
        metadata = r.get("extra", {}).get("metadata", {})
        severity_raw = r.get("extra", {}).get("severity", "INFO")
        rule_id = r.get("check_id", "unknown")
        file_path = r.get("path", "").replace(repo_path, "").lstrip("/")
        start_line = r.get("start", {}).get("line", 0)
        code_snippet = r.get("extra", {}).get("lines", "").strip()
        message = r.get("extra", {}).get("message", "")

        # Deduplicate key
        dedup_key = f"{rule_id}:{file_path}:{start_line}"
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        findings.append(
            Finding(
                id=str(uuid.uuid4()),
                rule_id=rule_id,
                file_path=file_path,
                start_line=start_line,
                end_line=r.get("end", {}).get("line", 0),
                severity=SEVERITY_MAP.get(severity_raw, "Low"),
                message=message,
                code_snippet=code_snippet,
                scanner="semgrep",
                category=_classify_category(rule_id, message),
                cwe_id=_extract_cwe(metadata),
            )
        )

    return findings
