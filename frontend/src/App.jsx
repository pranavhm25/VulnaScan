import { useState, useRef } from "react";
import RepoForm from "./components/RepoForm";
import ScanProgress from "./components/ScanProgress";
import SummaryDashboard from "./components/SummaryDashboard";
import ResultsList from "./components/ResultsList";
import { startScan, pollScanResults } from "./api";

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const abortRef = useRef(null);

  const handleScan = async (repoUrl, options = {}) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setScanStatus(null);

    // Create abort controller for cancellation
    abortRef.current = new AbortController();

    try {
      const { scan_id } = await startScan(repoUrl, options);

      const data = await pollScanResults(
        scan_id,
        (status) => setScanStatus(status),
        abortRef.current.signal
      );

      setResult(data);
    } catch (e) {
      if (e.message !== "Scan cancelled") {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setLoading(false);
    setScanStatus(null);
  };

  return (
    <div className="min-h-screen bg-grid relative">
      {/* Top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[rgba(0,240,255,0.04)] to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center px-4 sm:px-6 py-10 max-w-5xl mx-auto">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="text-4xl">🛡️</div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
              <span className="text-[var(--color-neon-cyan)] glow-text-cyan">Vulna</span>
              <span className="text-[var(--color-text-primary)]">Scan</span>
            </h1>
          </div>
          <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl leading-relaxed">
            AI-powered vulnerability scanning for GitHub repositories.
            <br />
            <span className="text-[var(--color-text-muted)] text-sm">
              Powered by Semgrep · Bandit · ESLint · Gemini AI
            </span>
          </p>
        </header>

        {/* Scan Form */}
        <RepoForm onScan={handleScan} loading={loading} onCancel={handleCancel} />

        {/* Error */}
        {error && (
          <div className="mt-6 w-full max-w-2xl glass-card rounded-xl p-4 border-[var(--color-severity-high)]/30 animate-fade-in">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-[var(--color-severity-high)] font-semibold text-sm">Scan Error</p>
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {loading && scanStatus && (
          <ScanProgress status={scanStatus} />
        )}

        {/* Results */}
        {result && (
          <div className="w-full mt-8 space-y-8 animate-fade-in">
            <SummaryDashboard result={result} />
            <ResultsList result={result} />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pb-8 text-center">
          <p className="text-[var(--color-text-muted)] text-xs">
            VulnaScan v1.0 · Static analysis only — no code is executed from scanned repositories
          </p>
        </footer>
      </div>
    </div>
  );
}
