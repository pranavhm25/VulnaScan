import json
import asyncio
import random
import logging
from typing import List

from google import genai
from pydantic import BaseModel

from app.config import settings
from app.models.schemas import Finding
from app.services.cache import get_cached, set_cached

logger = logging.getLogger(__name__)

# Maximum retries for transient API errors
MAX_RETRIES = 3
BASE_DELAY = 1.0  # seconds

# Strings that indicate a transient / retryable error
RETRYABLE_INDICATORS = ["503", "429", "rate limit", "service unavailable", "quota", "overloaded", "timeout"]


class ExplanationResponse(BaseModel):
    explanation: str
    fix_suggestion: str
    triage_status: str   # "True Positive", "False Positive", or "Needs Review"
    triage_reason: str


SYSTEM_PROMPT = """You are a senior application security engineer reviewing code vulnerabilities.
For each finding, provide:
1. A clear, plain-English explanation of the security risk (2-3 sentences, avoid unnecessary jargon)
2. Why this matters in a real-world context
3. A concrete fix suggestion with a code snippet showing the corrected code
4. A triage classification: decide whether this is a "True Positive" (real exploitable vulnerability), "False Positive" (not a real risk, e.g. test code, comments, or dead code), or "Needs Review" (ambiguous, requires human judgement). Provide a brief reason for your classification.

Respond ONLY with valid JSON matching the schema."""


def _is_retryable(error: Exception) -> bool:
    """Check if an error is transient and worth retrying."""
    error_str = str(error).lower()
    return any(indicator in error_str for indicator in RETRYABLE_INDICATORS)


def _build_prompt(finding: Finding) -> str:
    """Build the user prompt for a single finding."""
    return (
        f"Vulnerability Finding:\n"
        f"  Scanner: {finding.scanner}\n"
        f"  Rule: {finding.rule_id}\n"
        f"  Category: {finding.category or 'Unknown'}\n"
        f"  Severity: {finding.severity}\n"
        f"  File: {finding.file_path} (lines {finding.start_line}-{finding.end_line})\n"
        f"  Scanner message: {finding.message}\n"
        f"  CWE: {finding.cwe_id or 'N/A'}\n\n"
        f"Vulnerable code:\n```\n{finding.code_snippet}\n```\n"
    )


async def _call_gemini_with_retry(client: genai.Client, prompt: str) -> ExplanationResponse:
    """
    Call Gemini API with exponential backoff and jitter on transient errors.
    Returns the parsed ExplanationResponse on success.
    Raises the last exception if all retries are exhausted.
    """
    last_exception = None

    for attempt in range(MAX_RETRIES):
        try:
            response = await client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config={
                    "system_instruction": SYSTEM_PROMPT,
                    "temperature": 0.3,
                    "max_output_tokens": 1500,
                    "response_mime_type": "application/json",
                    "response_schema": ExplanationResponse,
                },
            )

            if response.parsed:
                return response.parsed

            # Fallback: try to parse the text manually
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            parsed = json.loads(text)
            return ExplanationResponse(**parsed)

        except Exception as e:
            last_exception = e
            if _is_retryable(e) and attempt < MAX_RETRIES - 1:
                delay = BASE_DELAY * (2 ** attempt) + random.uniform(0, 1)
                logger.warning(
                    f"Retryable error on attempt {attempt + 1}/{MAX_RETRIES}: {str(e)[:100]}. "
                    f"Retrying in {delay:.1f}s..."
                )
                await asyncio.sleep(delay)
            else:
                raise

    raise last_exception


async def explain_finding(client: genai.Client, finding: Finding) -> Finding:
    """
    Call the Gemini API to get a plain-English explanation, fix suggestion,
    and triage classification for a single finding. Mutates and returns the finding.
    """
    # Check cache first (must have triage_status to be considered valid)
    cached = get_cached(finding.rule_id, finding.code_snippet, finding.file_path)
    if cached and cached.get("triage_status"):
        finding.explanation = cached.get("explanation")
        finding.fix_suggestion = cached.get("fix_suggestion")
        finding.triage_status = cached.get("triage_status")
        finding.triage_reason = cached.get("triage_reason")
        return finding

    prompt = _build_prompt(finding)

    try:
        result = await _call_gemini_with_retry(client, prompt)
        finding.explanation = result.explanation
        finding.fix_suggestion = result.fix_suggestion
        finding.triage_status = result.triage_status
        finding.triage_reason = result.triage_reason

        # Cache the result
        set_cached(finding.rule_id, finding.code_snippet, finding.file_path, {
            "explanation": finding.explanation,
            "fix_suggestion": finding.fix_suggestion,
            "triage_status": finding.triage_status,
            "triage_reason": finding.triage_reason,
        })

    except Exception as e:
        logger.error(f"Failed to explain finding {finding.rule_id}: {str(e)[:200]}")
        finding.explanation = f"Explanation unavailable: {str(e)[:200]}"
        finding.fix_suggestion = None
        finding.triage_status = "Needs Review"
        finding.triage_reason = "AI analysis failed — manual review recommended."

    return finding


async def explain_single_finding(finding: Finding) -> Finding:
    """
    Explain a single finding on-demand (used by the retry endpoint).
    Creates its own Gemini client instance.
    """
    if not settings.gemini_api_key:
        finding.explanation = "No API key configured."
        return finding

    client = genai.Client(api_key=settings.gemini_api_key)

    # Clear any previous error state
    finding.explanation = None
    finding.fix_suggestion = None
    finding.triage_status = None
    finding.triage_reason = None

    return await explain_finding(client, finding)


async def explain_findings(findings: List[Finding]) -> List[Finding]:
    """
    Explain up to settings.max_findings_to_explain findings using Gemini.
    Uses concurrency with rate limiting to avoid API throttling.
    Remaining findings are returned without explanations to control cost.
    """
    if not settings.gemini_api_key:
        # No API key configured — skip explanations
        return findings

    client = genai.Client(api_key=settings.gemini_api_key)

    limit = settings.max_findings_to_explain
    to_explain = findings[:limit]
    rest = findings[limit:]

    # Process in batches of 5 to avoid rate limits
    batch_size = 5
    explained = []

    for i in range(0, len(to_explain), batch_size):
        batch = to_explain[i:i + batch_size]
        tasks = [explain_finding(client, f) for f in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                finding = batch[idx]
                finding.explanation = f"Explanation unavailable: {str(result)[:200]}"
                finding.fix_suggestion = None
                finding.triage_status = "Needs Review"
                finding.triage_reason = "AI analysis failed — manual review recommended."
                explained.append(finding)
            else:
                explained.append(result)

        # Brief pause between batches to respect rate limits
        if i + batch_size < len(to_explain):
            await asyncio.sleep(1)

    return explained + rest
