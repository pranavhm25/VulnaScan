import os
import re
import uuid
from typing import List
from app.models.schemas import Finding

# Common secret regex patterns mapped to rule IDs and readable names
SECRET_PATTERNS = {
    "secrets.google_api_key": {
        "pattern": r"AIzaSy[A-Za-z0-9_-]{35}",
        "name": "Google API Key",
        "cwe": "CWE-798",
    },
    "secrets.stripe_api_key": {
        "pattern": r"sk_(?:live|test)_[0-9a-zA-Z]{24}",
        "name": "Stripe API Key",
        "cwe": "CWE-798",
    },
    "secrets.aws_access_key": {
        "pattern": r"\b(AKIA|ASCA|AOIS)[0-9A-Z]{16}\b",
        "name": "AWS Access Key ID",
        "cwe": "CWE-798",
    },
    "secrets.aws_secret_key": {
        "pattern": r"(?i)aws(.{0,20})?['\"][0-9a-zA-Z\/+]{40}['\"]",
        "name": "AWS Secret Access Key",
        "cwe": "CWE-798",
    },
    "secrets.slack_token": {
        "pattern": r"xox[bapr]-[0-9A-Za-z\-]+",
        "name": "Slack Token",
        "cwe": "CWE-798",
    },
    "secrets.private_key": {
        "pattern": r"-----BEGIN [A-Z ]+ PRIVATE KEY-----",
        "name": "Private Key",
        "cwe": "CWE-312",  # Cleartext Storage of Sensitive Information
    }
}

# Directories to skip when scanning
IGNORED_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".next",
    ".vscode",
}

# File extensions to ignore (binary or non-source files)
IGNORED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz",
    ".mp3", ".mp4", ".wav", ".avi", ".mov", ".db", ".sqlite", ".woff", ".woff2",
    ".ttf", ".eot", ".bin", ".exe", ".dll", ".so", ".dylib"
}

def run_secrets_scan(repo_path: str) -> List[Finding]:
    """
    Scan all text files in the repository for hardcoded credentials.
    Returns a list of Finding objects.
    """
    findings: List[Finding] = []
    
    # Compile regex patterns
    compiled_patterns = {
        rule_id: re.compile(info["pattern"])
        for rule_id, info in SECRET_PATTERNS.items()
    }

    # Walk the directory
    for root, dirs, files in os.walk(repo_path):
        # Prune ignored directories in-place
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]

        for file in files:
            file_ext = os.path.splitext(file)[1].lower()
            if file_ext in IGNORED_EXTENSIONS:
                continue

            file_path = os.path.join(root, file)
            
            # Skip files larger than 1MB to avoid performance issues
            try:
                if os.path.getsize(file_path) > 1 * 1024 * 1024:
                    continue
            except OSError:
                continue

            # Scan text file
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
            except OSError:
                continue

            for line_idx, line in enumerate(lines, start=1):
                for rule_id, regex in compiled_patterns.items():
                    for match in regex.finditer(line):
                        match_str = match.group(0)
                        if not match_str:
                            continue
                        
                        # Obfuscate the secret for UI and reporting safety
                        masked_secret = match_str[:6] + "..." + match_str[-6:] if len(match_str) > 12 else "********"
                        
                        # Mask in line and snippet
                        masked_line = line.replace(match_str, masked_secret)

                        # Create a snippet with 1 context line before and after
                        snippet_lines = []
                        start_snippet_line = max(1, line_idx - 1)
                        end_snippet_line = min(len(lines), line_idx + 1)
                        
                        for s_idx in range(start_snippet_line, end_snippet_line + 1):
                            s_line = lines[s_idx - 1]
                            if s_idx == line_idx:
                                s_line = s_line.replace(match_str, masked_secret)
                            snippet_lines.append(f"{s_idx} {s_line.rstrip()}")

                        code_snippet = "\n".join(snippet_lines)
                        relative_path = os.path.relpath(file_path, repo_path)

                        info = SECRET_PATTERNS[rule_id]
                        findings.append(
                            Finding(
                                id=str(uuid.uuid4()),
                                rule_id=rule_id,
                                file_path=relative_path,
                                start_line=line_idx,
                                end_line=line_idx,
                                severity="High",
                                message=f"Hardcoded {info['name']} detected: {masked_secret}",
                                code_snippet=code_snippet,
                                scanner="secrets",
                                category="Hardcoded Secrets",
                                cwe_id=info["cwe"],
                            )
                        )

    return findings
