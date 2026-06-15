import { useState } from "react";

export default function RepoForm({ onScan, loading, onCancel }) {
  const [url, setUrl] = useState("");
  const [valid, setValid] = useState(null);

  const validateUrl = (value) => {
    setUrl(value);
    if (!value.trim()) {
      setValid(null);
      return;
    }
    const pattern = /^https?:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+\/?$/;
    setValid(pattern.test(value.trim()));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim() && valid) onScan(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="glass rounded-2xl p-2 gradient-border">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </div>
            <input
              id="repo-url-input"
              type="text"
              value={url}
              onChange={(e) => validateUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className={`w-full pl-11 pr-4 py-3.5 rounded-xl bg-[var(--color-surface-900)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none transition-all text-sm font-mono border ${
                valid === null
                  ? "border-transparent focus:border-[var(--color-neon-cyan)]/30"
                  : valid
                  ? "border-[var(--color-severity-low)]/30 focus:border-[var(--color-severity-low)]/50"
                  : "border-[var(--color-severity-high)]/30 focus:border-[var(--color-severity-high)]/50"
              }`}
              disabled={loading}
            />
            {valid !== null && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {valid ? (
                  <span className="text-[var(--color-severity-low)] text-sm">✓</span>
                ) : (
                  <span className="text-[var(--color-severity-high)] text-xs">Invalid URL</span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3.5 rounded-xl bg-[var(--color-surface-700)] text-[var(--color-text-secondary)] font-semibold text-sm hover:bg-[var(--color-surface-600)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            <button
              type="submit"
              disabled={!valid || loading}
              className="btn-scan text-sm cursor-pointer disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
                Scan Repository
              </span>
            </button>
          )}
        </div>
      </div>

      {url && !valid && valid !== null && (
        <p className="text-[var(--color-severity-high)] text-xs mt-2 ml-2 opacity-80">
          Please enter a valid GitHub repository URL (https://github.com/owner/repo)
        </p>
      )}
    </form>
  );
}
