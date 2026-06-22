import { useState } from "react";
import { retryExplanation } from "../api";

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

const TRIAGE_CYCLE = ["True Positive", "False Positive", "Needs Review"];

const TRIAGE_STYLES = {
  "True Positive": {
    bg: "bg-[var(--color-severity-high)]/15",
    text: "text-[var(--color-severity-high)]",
    border: "border-[var(--color-severity-high)]/30",
    icon: "🔴",
  },
  "False Positive": {
    bg: "bg-[var(--color-severity-low)]/15",
    text: "text-[var(--color-severity-low)]",
    border: "border-[var(--color-severity-low)]/30",
    icon: "🟢",
  },
  "Needs Review": {
    bg: "bg-[var(--color-severity-medium)]/15",
    text: "text-[var(--color-severity-medium)]",
    border: "border-[var(--color-severity-medium)]/30",
    icon: "🟡",
  },
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

export default function FindingCard({ finding, open: controlledOpen, onToggle, onFindingUpdate }) {
  const [localOpen, setLocalOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [triageStatus, setTriageStatus] = useState(finding.triage_status || null);
  const [triageReason, setTriageReason] = useState(finding.triage_reason || null);
  const [explanation, setExplanation] = useState(finding.explanation);
  const [fixSuggestion, setFixSuggestion] = useState(finding.fix_suggestion);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : localOpen;

  const handleToggle = () => {
    if (isControlled) {
      onToggle();
    } else {
      setLocalOpen(!localOpen);
    }
  };

  const isExplanationFailed = explanation && explanation.startsWith("Explanation unavailable");

  const handleRetry = async (e) => {
    e.stopPropagation();
    setRetrying(true);
    try {
      const updated = await retryExplanation(finding);
      setExplanation(updated.explanation);
      setFixSuggestion(updated.fix_suggestion);
      setTriageStatus(updated.triage_status);
      setTriageReason(updated.triage_reason);
      // Notify parent if callback provided
      if (onFindingUpdate) onFindingUpdate(updated);
    } catch (err) {
      setExplanation(`Retry failed: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  const cycleTriageStatus = (e) => {
    e.stopPropagation();
    const currentIdx = TRIAGE_CYCLE.indexOf(triageStatus);
    const nextIdx = (currentIdx + 1) % TRIAGE_CYCLE.length;
    setTriageStatus(TRIAGE_CYCLE[nextIdx]);
  };

  const triageStyle = triageStatus ? TRIAGE_STYLES[triageStatus] : null;

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
          {/* Triage badge on header */}
          {triageStyle && (
            <button
              onClick={cycleTriageStatus}
              title="Click to cycle triage status"
              className={`text-[0.6rem] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap border cursor-pointer transition-all hover:scale-105 ${triageStyle.bg} ${triageStyle.text} ${triageStyle.border}`}
            >
              {triageStyle.icon} {triageStatus}
            </button>
          )}
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

          {/* AI Triage Classification */}
          {triageStatus && (
            <div className={`rounded-lg p-3 border ${triageStyle.bg} ${triageStyle.border}`}>
              <div className="flex items-center justify-between">
                <h4 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${triageStyle.text}`}>
                  <span>🎯</span>
                  AI Triage: {triageStatus}
                </h4>
                <button
                  onClick={cycleTriageStatus}
                  className="text-[0.6rem] text-[var(--color-text-muted)] hover:text-[var(--color-neon-cyan)] transition-colors cursor-pointer border border-[var(--color-surface-700)] px-2 py-0.5 rounded-md"
                >
                  Override ↻
                </button>
              </div>
              {triageReason && (
                <p className="text-[var(--color-text-secondary)] text-xs mt-1.5 leading-relaxed">
                  {triageReason}
                </p>
              )}
            </div>
          )}

          {/* AI Explanation */}
          {explanation && !isExplanationFailed && (
            <div>
              <h4 className="text-[var(--color-neon-cyan)] text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>🤖</span>
                AI Explanation
              </h4>
              <div className="glass-card rounded-lg p-4">
                <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed whitespace-pre-wrap">
                  {explanation}
                </p>
              </div>
            </div>
          )}

          {/* Fix Suggestion */}
          {fixSuggestion && (
            <div>
              <h4 className="text-[var(--color-severity-low)] text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>💡</span>
                Suggested Fix
              </h4>
              <div className="glass-card rounded-lg p-4">
                {renderFixSuggestion(fixSuggestion)}
              </div>
            </div>
          )}

          {/* Retry button for failed explanations */}
          {(isExplanationFailed || (!explanation && !fixSuggestion)) && (
            <div className="glass-card rounded-lg p-4 border border-[var(--color-severity-medium)]/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⚠️</span>
                  <span className="text-[var(--color-text-muted)] text-xs italic">
                    {isExplanationFailed ? explanation : "AI explanation not available for this finding."}
                  </span>
                </div>
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="px-3 py-1 rounded-lg bg-[var(--color-surface-900)] text-[var(--color-neon-cyan)] hover:border-[var(--color-neon-cyan)]/30 text-xs border border-[var(--color-surface-700)] transition-all cursor-pointer flex items-center gap-1.5 font-medium disabled:opacity-50 disabled:cursor-wait"
                >
                  {retrying ? (
                    <>
                      <span className="animate-spin">⟳</span> Retrying...
                    </>
                  ) : (
                    <>
                      <span>🔄</span> Retry AI Explanation
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
