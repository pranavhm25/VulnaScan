import { useState, useMemo } from "react";
import FindingCard from "./FindingCard";

const SEVERITY_ORDER = ["High", "Medium", "Low"];

export default function ResultsList({ result }) {
  if (!result) return null;

  const { findings } = result;
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterScanner, setFilterScanner] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [expandedFindings, setExpandedFindings] = useState({});

  // Get unique scanners
  const scanners = useMemo(
    () => [...new Set(findings.map((f) => f.scanner))],
    [findings]
  );

  // Filter findings
  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (filterSeverity !== "all" && f.severity !== filterSeverity) return false;
      if (filterScanner !== "all" && f.scanner !== filterScanner) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          f.file_path.toLowerCase().includes(q) ||
          f.rule_id.toLowerCase().includes(q) ||
          f.message.toLowerCase().includes(q) ||
          (f.category || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [findings, filterSeverity, filterScanner, searchQuery]);

  // Group by severity
  const grouped = useMemo(() => {
    const groups = {};
    for (const sev of SEVERITY_ORDER) {
      const items = filtered.filter((f) => f.severity === sev);
      if (items.length > 0) groups[sev] = items;
    }
    return groups;
  }, [filtered]);

  const toggleGroup = (severity) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [severity]: !prev[severity],
    }));
  };

  const toggleFinding = (id) => {
    setExpandedFindings((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const next = {};
    filtered.forEach((f) => {
      next[f.id] = true;
    });
    setExpandedFindings(next);
    setCollapsedGroups({});
  };

  const collapseAll = () => {
    setExpandedFindings({});
    const nextGroups = {};
    SEVERITY_ORDER.forEach((sev) => {
      nextGroups[sev] = true;
    });
    setCollapsedGroups(nextGroups);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);

    let repoName = "report";
    try {
      const urlParts = result.repo_url.split("/");
      repoName = urlParts[urlParts.length - 1] || "report";
    } catch {
      // Fallback
    }

    downloadAnchor.setAttribute("download", `vulnascan-report-${repoName}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const severityIcon = { High: "🔴", Medium: "🟡", Low: "🟢" };
  const severityBadgeClass = { High: "badge-high", Medium: "badge-medium", Low: "badge-low" };

  if (findings.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center animate-fade-in">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="text-xl font-bold text-[var(--color-severity-low)] mb-2">All Clear!</h3>
        <p className="text-[var(--color-text-secondary)]">
          No security issues were found in this repository. Nice and clean!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Print cover page (hidden on screen, visible on print) */}
      <div className="hidden print:flex flex-col justify-between p-12 rounded-2xl mb-12 print-cover-page">
        <div className="space-y-8 my-auto">
          <div className="flex items-center gap-3">
            <span className="text-5xl">🛡️</span>
            <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">VulnaScan Audit Report</h1>
          </div>
          <div className="border-t border-slate-300 my-6"></div>
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Repository</h2>
            <p className="text-xl font-mono text-slate-700 mt-1 break-all">{result.repo_url}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            {result.branch && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Branch</h2>
                <p className="text-md text-slate-600 font-mono mt-1">{result.branch}</p>
              </div>
            )}
            {result.pr_number && (
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">PR Number</h2>
                <p className="text-md text-slate-600 font-mono mt-1">#{result.pr_number}</p>
              </div>
            )}
            {result.scan_diff_only && (
              <div className="col-span-2 mt-2">
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200 font-medium">
                  Diff Scan Only (Modified code checked)
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-200 mt-8">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Findings</h3>
              <p className="text-3xl font-bold text-slate-800 mt-1">{findings.length}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Scanners</h3>
              <p className="text-sm text-slate-600 mt-1 capitalize">{result.scanners_used?.join(", ")}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Severity Breakdown</h3>
              <p className="text-xs text-slate-600 mt-1">
                🔴 High: {result.summary?.by_severity?.High || 0}<br />
                🟡 Medium: {result.summary?.by_severity?.Medium || 0}<br />
                🟢 Low: {result.summary?.by_severity?.Low || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6 mt-12 flex justify-between text-xs text-slate-400">
          <span>Generated: {new Date().toLocaleDateString()}</span>
          <span>VulnaScan Security Assessment</span>
        </div>
      </div>

      {/* Print header (hidden on screen, visible on print) */}
      <div className="hidden print:block print-report-header">
        <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-300">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">VulnaScan Security Audit Report</h1>
            <p className="text-sm text-slate-500 mt-1">Repository: {result.repo_url}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">Generated: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Filters (hidden during print) */}
      <div className="glass-card rounded-xl p-4 no-print">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              id="findings-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search findings..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-surface-900)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm border border-transparent focus:border-[var(--color-neon-cyan)]/20 focus:outline-none"
            />
          </div>

          {/* Severity filter */}
          <select
            id="severity-filter"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--color-surface-900)] text-[var(--color-text-secondary)] text-sm border border-[var(--color-surface-700)] focus:outline-none focus:border-[var(--color-neon-cyan)]/20 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Scanner filter */}
          {scanners.length > 1 && (
            <select
              id="scanner-filter"
              value={filterScanner}
              onChange={(e) => setFilterScanner(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[var(--color-surface-900)] text-[var(--color-text-secondary)] text-sm border border-[var(--color-surface-700)] focus:outline-none focus:border-[var(--color-neon-cyan)]/20 cursor-pointer capitalize"
            >
              <option value="all">All Scanners</option>
              {scanners.map((s) => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <div>
            Showing {filtered.length} of {findings.length} findings
          </div>
          {searchQuery && (
            <span className="bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] px-2 py-0.5 rounded-full border border-[var(--color-neon-cyan)]/20">
              {filtered.length} matches
            </span>
          )}
        </div>
      </div>

      {/* Global Actions Bar (hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-900)] text-[var(--color-text-secondary)] hover:text-[var(--color-neon-cyan)] hover:border-[var(--color-neon-cyan)]/30 text-xs border border-[var(--color-surface-700)] transition-all cursor-pointer flex items-center gap-1.5 font-medium"
          >
            <span>↔</span> Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-900)] text-[var(--color-text-secondary)] hover:text-[var(--color-neon-pink)] hover:border-[var(--color-neon-pink)]/30 text-xs border border-[var(--color-surface-700)] transition-all cursor-pointer flex items-center gap-1.5 font-medium"
          >
            <span>⇆</span> Collapse All
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-900)] text-[var(--color-text-secondary)] hover:text-[var(--color-neon-cyan)] hover:border-[var(--color-neon-cyan)]/30 text-xs border border-[var(--color-surface-700)] transition-all cursor-pointer flex items-center gap-1.5 font-medium"
          >
            <span>📄</span> Export PDF Report
          </button>
          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-900)] text-[var(--color-text-secondary)] hover:text-[var(--color-neon-green)] hover:border-[var(--color-neon-green)]/30 text-xs border border-[var(--color-surface-700)] transition-all cursor-pointer flex items-center gap-1.5 font-medium"
          >
            <span>⬇️</span> Download JSON
          </button>
        </div>
      </div>

      {/* Grouped findings */}
      {Object.entries(grouped).map(([severity, items]) => (
        <div key={severity} className="space-y-2">
          <button
            onClick={() => toggleGroup(severity)}
            className="flex items-center gap-2 w-full text-left py-2 cursor-pointer group no-print"
          >
            <span className="text-sm">{severityIcon[severity]}</span>
            <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${severityBadgeClass[severity]}`}>
              {severity}
            </span>
            <span className="text-[var(--color-text-muted)] text-sm">
              {items.length} finding{items.length !== 1 ? "s" : ""}
            </span>
            <span className="ml-auto text-[var(--color-text-muted)] text-xs transition-transform group-hover:text-[var(--color-text-secondary)]">
              {collapsedGroups[severity] ? "▶" : "▼"}
            </span>
          </button>

          {/* Simple header for print report instead of buttons */}
          <div className="hidden print:block border-b border-slate-200 pb-1 mt-6 mb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {severityIcon[severity]} {severity} Severity Findings ({items.length})
            </h2>
          </div>

          {!collapsedGroups[severity] && (
            <div className="space-y-2 pl-1">
              {items.map((f, idx) => (
                <div
                  key={f.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <FindingCard
                    finding={f}
                    open={!!expandedFindings[f.id]}
                    onToggle={() => toggleFinding(f.id)}
                    onFindingUpdate={(updated) => {
                      // Dynamically update the finding object in the result state
                      // so JSON downloads capture updated AI explanations
                      f.explanation = updated.explanation;
                      f.fix_suggestion = updated.fix_suggestion;
                      f.triage_status = updated.triage_status;
                      f.triage_reason = updated.triage_reason;
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && findings.length > 0 && (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-[var(--color-text-muted)]">No findings match your filters.</p>
        </div>
      )}
    </div>
  );
}
