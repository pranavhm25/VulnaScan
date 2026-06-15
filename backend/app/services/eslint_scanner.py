import json
import os
import subprocess
import uuid
from typing import List

from app.config import settings
from app.models.schemas import Finding

# Map ESLint severity numbers to labels
ESLINT_SEVERITY_MAP = {
    2: "High",   # error
    1: "Medium",  # warning
}

# Map eslint-plugin-security rule names to categories
ESLINT_CATEGORY_MAP = {
    "security/detect-buffer-noassert": "Buffer Safety",
    "security/detect-child-process": "Command Injection",
    "security/detect-disable-mustache-escape": "Cross-Site Scripting",
    "security/detect-eval-with-expression": "Code Injection",
    "security/detect-new-buffer": "Buffer Safety",
    "security/detect-no-csrf-before-method-override": "CSRF",
    "security/detect-non-literal-fs-filename": "Path Traversal",
    "security/detect-non-literal-regexp": "ReDoS",
    "security/detect-non-literal-require": "Code Injection",
    "security/detect-object-injection": "Object Injection",
    "security/detect-possible-timing-attacks": "Timing Attack",
    "security/detect-pseudoRandomBytes": "Weak Random",
    "security/detect-unsafe-regex": "ReDoS",
}


def _create_eslint_config(repo_path: str) -> str:
    """Create a temporary ESLint flat config for security scanning."""
    config_content = """
import security from "eslint-plugin-security";

export default [
  security.configs.recommended,
  {
    plugins: { security },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    }
  }
];
"""
    config_path = os.path.join(repo_path, ".vulnascan-eslint.config.mjs")
    with open(config_path, "w") as f:
        f.write(config_content)
    return config_path


def _cleanup_eslint_config(config_path: str) -> None:
    """Remove the temporary ESLint config file."""
    try:
        os.remove(config_path)
    except OSError:
        pass


def run_eslint_scan(repo_path: str) -> List[Finding]:
    """
    Run ESLint with eslint-plugin-security on a JavaScript/TypeScript codebase.
    Returns a list of Finding objects.
    """
    # Install eslint and plugin in the scan directory temporarily
    install_cmd = [
        "npm", "install", "--no-save", "--no-audit", "--no-fund",
        "eslint", "eslint-plugin-security",
    ]

    try:
        subprocess.run(
            install_cmd,
            capture_output=True,
            text=True,
            cwd=repo_path,
            timeout=60,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []

    config_path = _create_eslint_config(repo_path)

    try:
        cmd = [
            "npx", "eslint",
            "--config", config_path,
            "--format", "json",
            "--no-eslintrc",
            ".",
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=repo_path,
            timeout=settings.scan_timeout_seconds,
        )

        # ESLint returns 1 for lint issues, 2 for config errors
        if result.returncode == 2:
            return []

        try:
            data = json.loads(result.stdout or "[]")
        except json.JSONDecodeError:
            return []

        findings: List[Finding] = []

        for file_result in data:
            file_path = file_result.get("filePath", "").replace(repo_path, "").lstrip("/")
            # Skip node_modules and config files
            if "node_modules" in file_path or file_path.startswith("."):
                continue

            for msg in file_result.get("messages", []):
                rule_id = msg.get("ruleId", "unknown")
                if not rule_id or not rule_id.startswith("security/"):
                    continue  # only care about security plugin rules

                findings.append(
                    Finding(
                        id=str(uuid.uuid4()),
                        rule_id=f"eslint.{rule_id}",
                        file_path=file_path,
                        start_line=msg.get("line", 0),
                        end_line=msg.get("endLine", msg.get("line", 0)),
                        severity=ESLINT_SEVERITY_MAP.get(msg.get("severity", 1), "Medium"),
                        message=msg.get("message", ""),
                        code_snippet=msg.get("source", ""),
                        scanner="eslint",
                        category=ESLINT_CATEGORY_MAP.get(rule_id, "Security Issue"),
                        cwe_id=None,
                    )
                )

        return findings

    finally:
        _cleanup_eslint_config(config_path)
