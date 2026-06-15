import json
import subprocess
import uuid
from typing import List

from app.config import settings
from app.models.schemas import Finding

# Map Bandit severities
SEVERITY_MAP = {
    "HIGH": "High",
    "MEDIUM": "Medium",
    "LOW": "Low",
}

# Map common Bandit test IDs to categories
BANDIT_CATEGORY_MAP = {
    "B101": "Assert Usage",
    "B102": "Code Injection",
    "B103": "File Permissions",
    "B104": "Binding to All Interfaces",
    "B105": "Hardcoded Secrets",
    "B106": "Hardcoded Secrets",
    "B107": "Hardcoded Secrets",
    "B108": "Hardcoded Secrets",
    "B110": "Exception Handling",
    "B112": "Exception Handling",
    "B201": "Code Injection",
    "B301": "Insecure Deserialization",
    "B302": "Insecure Deserialization",
    "B303": "Weak Cryptography",
    "B304": "Weak Cryptography",
    "B305": "Weak Cryptography",
    "B306": "Insecure Temp File",
    "B307": "Code Injection",
    "B308": "Cross-Site Scripting",
    "B310": "URL Handling",
    "B311": "Weak Random",
    "B312": "Insecure Connection",
    "B313": "XML Parsing",
    "B314": "XML Parsing",
    "B315": "XML Parsing",
    "B316": "XML Parsing",
    "B317": "XML Parsing",
    "B318": "XML Parsing",
    "B319": "XML Parsing",
    "B320": "XML Parsing",
    "B321": "Insecure Connection",
    "B323": "Insecure Connection",
    "B324": "Weak Cryptography",
    "B501": "Insecure Connection",
    "B502": "Insecure Connection",
    "B503": "Insecure Connection",
    "B504": "Insecure Connection",
    "B505": "Weak Cryptography",
    "B506": "YAML Unsafe",
    "B507": "Insecure Connection",
    "B601": "Command Injection",
    "B602": "Command Injection",
    "B603": "Command Injection",
    "B604": "Command Injection",
    "B605": "Command Injection",
    "B606": "Command Injection",
    "B607": "Command Injection",
    "B608": "SQL Injection",
    "B609": "Wildcard Injection",
    "B610": "Django SQL Injection",
    "B611": "Django SQL Injection",
    "B701": "Jinja2 Autoescape",
    "B702": "Mako Template Injection",
    "B703": "Django XSS",
}


def run_bandit_scan(repo_path: str) -> List[Finding]:
    """
    Run Bandit security scanner on a Python codebase.
    Returns a list of Finding objects.
    """
    cmd = [
        "bandit",
        "-r", repo_path,
        "-f", "json",
        "-ll",  # only medium and high severity
        "--quiet",
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=settings.scan_timeout_seconds,
        )
    except FileNotFoundError:
        # Bandit not installed — skip gracefully
        return []
    except subprocess.TimeoutExpired:
        return []

    # Bandit returns exit code 1 when findings exist
    if result.returncode not in (0, 1):
        return []

    try:
        data = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return []

    raw_results = data.get("results", [])
    findings: List[Finding] = []

    for r in raw_results:
        test_id = r.get("test_id", "unknown")
        severity_raw = r.get("issue_severity", "LOW")
        cwe = r.get("issue_cwe", {})
        cwe_id = f"CWE-{cwe.get('id')}" if cwe.get("id") else None

        findings.append(
            Finding(
                id=str(uuid.uuid4()),
                rule_id=f"bandit.{test_id}",
                file_path=r.get("filename", "").replace(repo_path, "").lstrip("/"),
                start_line=r.get("line_number", 0),
                end_line=r.get("line_number", 0) + len(r.get("line_range", [1])) - 1,
                severity=SEVERITY_MAP.get(severity_raw, "Low"),
                message=r.get("issue_text", ""),
                code_snippet=r.get("code", "").strip(),
                scanner="bandit",
                category=BANDIT_CATEGORY_MAP.get(test_id, "Security Issue"),
                cwe_id=cwe_id,
            )
        )

    return findings
