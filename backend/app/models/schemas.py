from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Literal


class ScanRequest(BaseModel):
    repo_url: HttpUrl
    branch: Optional[str] = None          # e.g. "develop", "feature/auth"
    pr_number: Optional[int] = None       # e.g. 42
    scan_diff_only: bool = False           # if True, only report findings on changed lines


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
    triage_status: Optional[Literal["True Positive", "False Positive", "Needs Review"]] = None
    triage_reason: Optional[str] = None


class ScanSummary(BaseModel):
    by_severity: Dict[str, int] = {"High": 0, "Medium": 0, "Low": 0}
    by_scanner: Dict[str, int] = {}
    by_category: Dict[str, int] = {}


class ScanResponse(BaseModel):
    repo_url: str
    total_findings: int
    languages_detected: List[str] = []
    scanners_used: List[str] = []
    branch: Optional[str] = None
    pr_number: Optional[int] = None
    scan_diff_only: bool = False
    findings: List[Finding]
    summary: ScanSummary


# --- Async scan models ---


class ScanStatus(BaseModel):
    scan_id: str
    status: str  # queued, cloning, scanning, analyzing, complete, failed
    progress_message: str = ""
    result: Optional[ScanResponse] = None
    error: Optional[str] = None
