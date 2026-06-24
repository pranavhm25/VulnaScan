# 🛡️ VulnaScan — AI-Powered GitHub Vulnerability Scanner

Scan public GitHub repositories for security vulnerabilities using multi-tool static analysis (Semgrep, Bandit, ESLint, and a custom Secrets Scanner), with AI-powered plain-English explanations, automated triage classification, and fix suggestions from Gemini.

## Architecture

```
User submits GitHub URL & Optional Branch/PR/Diff config
         │
         ▼
    ┌─────────────────────────────────────────┐
    │  FastAPI Backend                         │
    │                                         │
    │  1. Sandbox clone branch/PR head        │
    │  2. Fetch & parse git line-level diff   │
    │  3. Run scanners in parallel:           │
    │     • Semgrep (all languages)           │
    │     • Bandit (Python)                   │
    │     • ESLint + security (JS/TS)         │
    │     • Secrets Scanner (keys/credentials)│
    │  4. Filter findings by diff line ranges │
    │  5. Gemini AI explains & triages results│
    │     (with rate-limit backoff retry)     │
    │  6. Return structured JSON              │
    └─────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────┐
    │  React Frontend                         │
    │                                         │
    │  • Neon dark theme dashboard            │
    │  • Severity ring chart + stats          │
    │  • Advanced Scan: branch/PR/diff options│
    │  • Grouped/filterable findings list     │
    │  • AI Triage badge + manual override    │
    │  • AI explanation retry control         │
    │  • Enterprise PDF export + cover page   │
    └─────────────────────────────────────────┘
```

## Features

- **Multi-Tool Static Analysis**: Parallel execution of Semgrep, Bandit, and ESLint.
- **Custom Secrets Scanner**: Built-in regex-based secrets scanner targeting Google API keys, Stripe, AWS, Slack, and private keys with automatic credential masking.
- **AI Triage Classifier**: Gemini automatically labels each vulnerability as `True Positive`, `False Positive`, or `Needs Review` along with structural reasoning. Users can manually cycle/override this triage state in the UI.
- **Branch & PR Diff-Only Scanning**: Target specific branches or PR numbers. Enabling "Scan diff only" filters results to show only vulnerabilities introduced in modified files/lines.
- **Resilient AI Pipeline**: Robust API client featuring exponential backoff and randomized jitter to handle rate limits (`429`) and model service unavailability (`503`).
- **On-Demand Explanation Retry**: Clickable `🔄 Retry` buttons on individual finding cards for quick manual recovery if a transient API limit was reached during the initial batch run.
- **Enterprise PDF Reports**: Professional `@media print` layout featuring a generated Audit Cover Page containing scan metadata, disclaimer, and severity breakdown metrics.

## Project Structure

```
VulnaScan/
├── backend/                    # FastAPI
│   ├── app/
│   │   ├── main.py             # Entrypoint, CORS, lifespan
│   │   ├── config.py           # Pydantic settings from .env
│   │   ├── models/
│   │   │   └── schemas.py      # Request/response Pydantic models
│   │   ├── services/
│   │   │   ├── repo_handler.py         # Clone, branch/PR checkout, detect languages
│   │   │   ├── diff_parser.py          # Unified diff download and line mapping
│   │   │   ├── semgrep_scanner.py      # Semgrep security-audit + OWASP
│   │   │   ├── bandit_scanner.py       # Bandit for Python
│   │   │   ├── eslint_scanner.py       # ESLint security plugin for JS/TS
│   │   │   ├── secrets_scanner.py      # Regex-based credentials detection
│   │   │   ├── scanner_orchestrator.py # Run all scanners, filter by diff, merge
│   │   │   ├── gemini_explainer.py     # Gemini AI explanations, triage & retries
│   │   │   └── cache.py               # File-based LLM response cache
│   │   └── routers/
│   │       └── scan.py         # /api/scan & /api/findings/explain endpoints
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # React + Vite + Tailwind v4
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js              # API client with polling & retry endpoints
│   │   ├── index.css           # Neon design system & print styles
│   │   ├── main.jsx
│   │   └── components/
│   │       ├── RepoForm.jsx        # URL & branch/PR options input
│   │       ├── ScanProgress.jsx    # Multi-step progress indicator
│   │       ├── SummaryDashboard.jsx # Ring chart + stats + category breakdown
│   │       ├── ResultsList.jsx     # Grouped filter list & PDF print cover
│   │       └── FindingCard.jsx     # AI triage control + explanation retry card
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Semgrep](https://semgrep.dev/docs/getting-started/) (`pip install semgrep` or `brew install semgrep`)
- [Gemini API key](https://aistudio.google.com/apikey)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Google Gemini API key (required for AI explanations) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model to use |
| `MAX_REPO_SIZE_MB` | `200` | Maximum repository size to clone |
| `SCAN_TIMEOUT_SECONDS` | `180` | Timeout for scanner processes |
| `MAX_FINDINGS_TO_EXPLAIN` | `25` | Max findings sent to Gemini (cost control) |
| `CACHE_TTL_SECONDS` | `604800` | LLM cache TTL (default: 7 days) |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/scan` | Start a vulnerability scan (accepts optional `branch`, `pr_number`, `scan_diff_only`) |
| `GET` | `/api/scan/{scan_id}` | Poll scan status, progress details, and results |
| `POST` | `/api/findings/explain` | On-demand single finding analysis & explanation |
| `GET` | `/` | Health check |

## Security Notes

- ⚠️ **No code execution** — all tools perform static analysis only.
- Credentials matched by the secrets scanner are automatically obfuscated in JSON results and UI/PDF views.
- Repos are cloned with `--depth 1` (no history) into sandboxed temp directories.
- Temp directories are cleaned up immediately after each scan.
- Repository size limits are enforced (default 200 MB).
- Scan timeouts prevent runaway processes.
- Git interactive prompts are disabled (`GIT_TERMINAL_PROMPT=0`).

## Tech Stack

- **Backend**: Python, FastAPI, Pydantic, HTTPX
- **Scanners**: Semgrep, Bandit, ESLint, and Secrets Scanner
- **AI**: Google Gemini (`google-genai` SDK)
- **Frontend**: React 18, Vite, Tailwind CSS v4
- **Design**: Neon dark theme, glassmorphism, CSS-only charts
