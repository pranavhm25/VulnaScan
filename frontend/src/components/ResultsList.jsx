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
      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
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

        <div className="mt-2 text-xs text-[var(--color-text-muted)]">
          Showing {filtered.length} of {findings.length} findings
        </div>
      </div>

      {/* Grouped findings */}
      {Object.entries(grouped).map(([severity, items]) => (
        <div key={severity} className="space-y-2">
          <button
            onClick={() => toggleGroup(severity)}
            className="flex items-center gap-2 w-full text-left py-2 cursor-pointer group"
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

          {!collapsedGroups[severity] && (
            <div className="space-y-2 pl-1">
              {items.map((f, idx) => (
                <div
                  key={f.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <FindingCard finding={f} />
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
