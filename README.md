# 🛡️ VulnaScan — AI-Powered GitHub Vulnerability Scanner

Scan public GitHub repositories for security vulnerabilities using multi-tool static analysis (Semgrep, Bandit, ESLint), with AI-powered plain-English explanations and fix suggestions from Gemini.

## Architecture

```
User submits GitHub URL
        │
        ▼
   ┌─────────────────────────────────────────┐
   │  FastAPI Backend                         │
   │                                         │
   │  1. Clone repo (shallow, sandboxed)     │
   │  2. Detect languages                    │
   │  3. Run scanners in parallel:           │
   │     • Semgrep (all languages)           │
   │     • Bandit (Python)                   │
   │     • ESLint + security plugin (JS/TS)  │
   │  4. Gemini AI explains each finding     │
   │  5. Return structured JSON              │
   └─────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────┐
   │  React Frontend                         │
   │                                         │
   │  • Neon dark theme dashboard            │
   │  • Severity ring chart + stats          │
   │  • Grouped/filterable finding cards     │
   │  • AI explanations + fix suggestions    │
   │  • Real-time scan progress tracking     │
   └─────────────────────────────────────────┘
```

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
│   │   │   ├── repo_handler.py         # Clone, validate, detect languages
│   │   │   ├── semgrep_scanner.py      # Semgrep security-audit + OWASP
│   │   │   ├── bandit_scanner.py       # Bandit for Python
│   │   │   ├── eslint_scanner.py       # ESLint security plugin for JS/TS
│   │   │   ├── scanner_orchestrator.py # Run all scanners, merge results
│   │   │   ├── gemini_explainer.py     # Gemini AI explanations + fixes
│   │   │   └── cache.py               # File-based LLM response cache
│   │   └── routers/
│   │       └── scan.py         # /api/scan endpoints (async polling)
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # React + Vite + Tailwind v4
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js              # API client with polling
│   │   ├── index.css           # Neon design system
│   │   ├── main.jsx
│   │   └── components/
│   │       ├── RepoForm.jsx        # URL input with validation
│   │       ├── ScanProgress.jsx    # Multi-step progress indicator
│   │       ├── SummaryDashboard.jsx # Ring chart + stats + categories
│   │       ├── ResultsList.jsx     # Grouped, filterable results
│   │       └── FindingCard.jsx     # Expandable finding details
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
| `POST` | `/api/scan` | Start a vulnerability scan (returns `scan_id`) |
| `GET` | `/api/scan/{scan_id}` | Poll scan status and results |
| `GET` | `/` | Health check |

## How It Works

1. **Submit** a public GitHub repository URL
2. **Clone**: Shallow-clones the repo into a sandboxed temp directory
3. **Detect**: Identifies programming languages in the codebase
4. **Scan**: Runs applicable scanners in parallel:
   - **Semgrep**: `p/security-audit` + `p/owasp-top-ten` rulesets
   - **Bandit**: Python-specific security analysis
   - **ESLint**: `eslint-plugin-security` for JavaScript/TypeScript
5. **Analyze**: Gemini AI generates plain-English explanations and fix suggestions
6. **Display**: Results grouped by severity with search and filter capabilities

## Security Notes

- ⚠️ **No code execution** — all tools perform static analysis only
- Repos are cloned with `--depth 1` (no history) into isolated temp directories
- Clone directories are deleted after each scan
- Repository size limits enforced (default 200 MB)
- Scan timeouts prevent runaway processes
- Git prompts disabled (`GIT_TERMINAL_PROMPT=0`)

## Tech Stack

- **Backend**: Python, FastAPI, Pydantic
- **Scanners**: Semgrep, Bandit, ESLint
- **AI**: Google Gemini (`google-genai` SDK)
- **Frontend**: React 18, Vite, Tailwind CSS v4
- **Design**: Neon dark theme, glassmorphism, CSS-only charts
