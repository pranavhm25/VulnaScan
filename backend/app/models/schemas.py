from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict


class ScanRequest(BaseModel):
    repo_url: HttpUrl


class Finding(BaseModel):
    id: str
    rule_id: str
    file_path: str
    start_line: int
    end_line: int
    severity: str  # High, Medium, Low
    message: str  # raw message from the scanner
    code_snippet: str
    scanner: str  # semgrep, bandit, eslint
    category: Optional[str] = None  # e.g., SQLi, XSS, hardcoded_secret
    cwe_id: Optional[str] = None
    explanation: Optional[str] = None
    fix_suggestion: Optional[str] = None


class ScanSummary(BaseModel):
    by_severity: Dict[str, int] = {"High": 0, "Medium": 0, "Low": 0}
    by_scanner: Dict[str, int] = {}
    by_category: Dict[str, int] = {}


class ScanResponse(BaseModel):
    repo_url: str
    total_findings: int
    languages_detected: List[str] = []
    scanners_used: List[str] = []
    findings: List[Finding]
    summary: ScanSummary


# --- Async scan models ---


class ScanStatus(BaseModel):
    scan_id: str
    status: str  # queued, cloning, scanning, analyzing, complete, failed
    progress_message: str = ""
    result: Optional[ScanResponse] = None
    error: Optional[str] = None
