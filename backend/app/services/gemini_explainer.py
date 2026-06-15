import json
import asyncio
from typing import List

from google import genai

from app.config import settings
from app.models.schemas import Finding
from app.services.cache import get_cached, set_cached

SYSTEM_PROMPT = """You are a senior application security engineer reviewing code vulnerabilities.
For each finding, provide:
1. A clear, plain-English explanation of the security risk (2-3 sentences, avoid unnecessary jargon)
2. Why this matters in a real-world context
3. A concrete fix suggestion with a code snippet showing the corrected code

Respond ONLY with valid JSON (no markdown fences, no preamble) in this exact shape:
{
  "explanation": "Plain-English explanation of the vulnerability and its real-world impact.",
  "fix_suggestion": "Code snippet or clear step-by-step instructions to fix the issue."
}"""


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


async def explain_finding(client: genai.Client, finding: Finding) -> Finding:
    """
    Call the Gemini API to get a plain-English explanation and fix
    suggestion for a single finding. Mutates and returns the finding.
    """
    # Check cache first
    cached = get_cached(finding.rule_id, finding.code_snippet, finding.file_path)
    if cached:
        finding.explanation = cached.get("explanation")
        finding.fix_suggestion = cached.get("fix_suggestion")
        return finding

    prompt = _build_prompt(finding)

    try:
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config={
                "system_instruction": SYSTEM_PROMPT,
                "temperature": 0.3,
                "max_output_tokens": 600,
            },
        )

        text = response.text.strip()

        # Strip accidental markdown fences
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        parsed = json.loads(text)
        finding.explanation = parsed.get("explanation")
        finding.fix_suggestion = parsed.get("fix_suggestion")

        # Cache the result
        set_cached(finding.rule_id, finding.code_snippet, finding.file_path, {
            "explanation": finding.explanation,
            "fix_suggestion": finding.fix_suggestion,
        })

    except json.JSONDecodeError:
        # LLM returned non-JSON — use raw text as explanation
        finding.explanation = text if 'text' in dir() else "Explanation unavailable"
        finding.fix_suggestion = None
    except Exception as e:
        finding.explanation = f"Explanation unavailable: {str(e)[:200]}"
        finding.fix_suggestion = None

    return finding


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

        for result in results:
            if isinstance(result, Exception):
                # Create a finding with error explanation
                explained.append(batch[len(explained) - i] if (len(explained) - i) < len(batch) else batch[0])
            else:
                explained.append(result)

        # Brief pause between batches to respect rate limits
        if i + batch_size < len(to_explain):
            await asyncio.sleep(1)

    return explained + rest
