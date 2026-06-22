import { useState } from "react";

const SEVERITY_BORDER = {
  High: "border-l-[var(--color-severity-high)]",
  Medium: "border-l-[var(--color-severity-medium)]",
  Low: "border-l-[var(--color-severity-low)]",
};

const SEVERITY_BADGE = {
  High: "badge-high",
  Medium: "badge-medium",
  Low: "badge-low",
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-neon-cyan)] transition-colors cursor-pointer flex items-center gap-1"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <span className="text-[var(--color-severity-low)]">✓</span>
          <span className="text-[var(--color-severity-low)]">Copied</span>
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function renderFixSuggestion(fixSuggestion) {
  if (!fixSuggestion) return null;

  // Split by code blocks: ```lang\ncode\n```
  const parts = fixSuggestion.split(/```[a-zA-Z]*\n?/);
  if (parts.length >= 2) {
    const description = parts[0].trim();
    const rest = parts[1].split("```");
    const code = rest[0].trim();
    const footer = rest[1] ? rest[1].trim() : "";

    return (
      <div className="space-y-3">
        {description && (
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed whitespace-pre-wrap">
            {description}
          </p>
        )}
        {code && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider font-semibold">Suggested Code</span>
              <CopyButton text={code} />
            </div>
            <pre className="fix-block">
              <code>{code}</code>
            </pre>
          </div>
        )}
        {footer && (
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed whitespace-pre-wrap mt-2">
            {footer}
          </p>
        )}
      </div>
    );
  }

  // Fallback: no code block found
  return (
    <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed whitespace-pre-wrap">
      {fixSuggestion}
    </p>
  );
}

export default function FindingCard({ finding, open: controlledOpen, onToggle }) {
  const [localOpen, setLocalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : localOpen;

  const handleToggle = () => {
    if (isControlled) {
      onToggle();
    } else {
      setLocalOpen(!localOpen);
    }
  };

  return (
    <div
      className={`glass-card rounded-xl overflow-hidden border-l-[3px] ${SEVERITY_BORDER[finding.severity]}`}
    >
      {/* Header — always visible */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${SEVERITY_BADGE[finding.severity]}`}>
            {finding.severity}
          </span>
          <span className="badge-scanner whitespace-nowrap">{finding.scanner}</span>
          <span className="text-[var(--color-text-primary)] font-mono text-sm truncate">
            {finding.file_path}
            <span className="text-[var(--color-text-muted)]">:{finding.start_line}</span>
          </span>
        </div>
        <div className="flex items-center gap-3 ml-3 shrink-0">
          {finding.category && (
            <span className="hidden sm:inline text-[var(--color-text-muted)] text-xs truncate max-w-[150px]">
              {finding.category}
            </span>
          )}
          <span className="text-[var(--color-text-muted)] text-xs transition-transform">
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {/* Expandable details */}
      <div className={`px-4 pb-4 space-y-4 animate-fade-in finding-details-container ${open ? "block" : "hidden"}`}>
          {/* Rule info */}
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <span className="text-[var(--color-text-muted)]">Rule:</span>
            <code className="text-[var(--color-neon-purple)] bg-[var(--color-surface-900)] px-2 py-0.5 rounded font-mono">
              {finding.rule_id}
            </code>
            {finding.cwe_id && (
              <>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span className="text-[var(--color-neon-orange)]">{finding.cwe_id}</span>
              </>
            )}
          </div>

          {/* Scanner message */}
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
            {finding.message}
          </p>

          {/* Vulnerable code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[var(--color-neon-cyan)] text-xs font-semibold uppercase tracking-wider">
                Vulnerable Code
              </h4>
              <CopyButton text={finding.code_snippet} />
            </div>
            <pre className="code-block">
              <code>{finding.code_snippet}</code>
            </pre>
          </div>

          {/* AI Explanation */}
          {finding.explanation && (
            <div>
              <h4 className="text-[var(--color-neon-cyan)] text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>🤖</span>
                AI Explanation
              </h4>
              <div className="glass-card rounded-lg p-4">
                <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed whitespace-pre-wrap">
                  {finding.explanation}
                </p>
              </div>
            </div>
          )}

          {/* Fix Suggestion */}
          {finding.fix_suggestion && (
            <div>
              <h4 className="text-[var(--color-severity-low)] text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>💡</span>
                Suggested Fix
              </h4>
              <div className="glass-card rounded-lg p-4">
                {renderFixSuggestion(finding.fix_suggestion)}
              </div>
            </div>
          )}

          {/* No explanation available */}
          {!finding.explanation && !finding.fix_suggestion && (
            <div className="text-[var(--color-text-muted)] text-xs italic py-2">
              AI explanation not available for this finding.
            </div>
          )}
        </div>
    </div>
  );
}
