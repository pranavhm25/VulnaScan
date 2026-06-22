import { useMemo } from "react";

function RingChart({ high, medium, low }) {
  const total = high + medium + low;
  if (total === 0) return null;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { count: high, color: "var(--color-severity-high)", label: "High" },
    { count: medium, color: "var(--color-severity-medium)", label: "Medium" },
    { count: low, color: "var(--color-severity-low)", label: "Low" },
  ];

  let offset = 0;
  const arcs = segments
    .filter((s) => s.count > 0)
    .map((s) => {
      const pct = s.count / total;
      const dash = circumference * pct;
      const gap = circumference - dash;
      const arc = { ...s, dashArray: `${dash} ${gap}`, dashOffset: -offset };
      offset += dash;
      return arc;
    });

  return (
    <div className="relative flex items-center justify-center">
      <svg width="130" height="130" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-surface-700)" strokeWidth="10" opacity="0.3" />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth="10"
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${arc.color})` }}
          />
        ))}
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-[var(--color-text-primary)]">{total}</div>
        <div className="text-xs text-[var(--color-text-muted)]">findings</div>
      </div>
    </div>
  );
}

function AnimatedCounter({ value, label, color }) {
  return (
    <div className="stat-card">
      <div className="text-3xl font-bold mb-1" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{label}</div>
    </div>
  );
}

// Color map for scanner badges in the distribution bar
const SCANNER_COLORS = {
  semgrep: "#38bdf8",   // sky-400
  bandit: "#a78bfa",    // violet-400
  eslint: "#fbbf24",    // amber-400
  secrets: "#f472b6",   // pink-400
};

function SeverityBar({ high, medium, low }) {
  const total = high + medium + low;
  if (total === 0) return null;

  const segments = [
    { count: high, color: "var(--color-severity-high)", label: "High", glow: "rgba(239,68,68,0.4)" },
    { count: medium, color: "var(--color-severity-medium)", label: "Medium", glow: "rgba(249,115,22,0.35)" },
    { count: low, color: "var(--color-severity-low)", label: "Low", glow: "rgba(16,185,129,0.35)" },
  ].filter((s) => s.count > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1">
        <span className="uppercase tracking-wider font-semibold">Severity Distribution</span>
        <span>{total} total</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-[var(--color-surface-700)]/40">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{
              width: `${(s.count / total) * 100}%`,
              backgroundColor: s.color,
              boxShadow: `0 0 8px ${s.glow}`,
              transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        ))}
      </div>
      <div className="flex gap-4 mt-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.glow}` }}
            />
            <span className="text-[var(--color-text-secondary)]">
              {s.label} <span className="text-[var(--color-text-muted)]">({s.count})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScannerBar({ byScanner }) {
  const entries = Object.entries(byScanner).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, c]) => sum + c, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1">
        <span className="uppercase tracking-wider font-semibold">Findings by Scanner</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-[var(--color-surface-700)]/40">
        {entries.map(([scanner, count]) => (
          <div
            key={scanner}
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: SCANNER_COLORS[scanner] || "#94a3b8",
              transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
        {entries.map(([scanner, count]) => (
          <div key={scanner} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: SCANNER_COLORS[scanner] || "#94a3b8" }}
            />
            <span className="text-[var(--color-text-secondary)] capitalize">
              {scanner} <span className="text-[var(--color-text-muted)]">({count})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SummaryDashboard({ result }) {
  const { total_findings, summary, languages_detected, scanners_used } = result;
  const { by_severity, by_scanner, by_category } = summary;

  const topCategories = useMemo(() => {
    return Object.entries(by_category)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [by_category]);

  const maxCategoryCount = topCategories.length > 0 ? topCategories[0][1] : 1;

  return (
    <div className="space-y-6">
      {/* Top row: Ring + Stats */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* Ring chart */}
          <RingChart
            high={by_severity.High || 0}
            medium={by_severity.Medium || 0}
            low={by_severity.Low || 0}
          />

          {/* Stat counters */}
          <div className="flex-1 grid grid-cols-3 gap-3 w-full">
            <AnimatedCounter value={by_severity.High || 0} label="High" color="var(--color-severity-high)" />
            <AnimatedCounter value={by_severity.Medium || 0} label="Medium" color="var(--color-severity-medium)" />
            <AnimatedCounter value={by_severity.Low || 0} label="Low" color="var(--color-severity-low)" />
          </div>
        </div>

        {/* Severity distribution bar */}
        <div className="mt-6 pt-5 border-t border-[var(--color-surface-700)]">
          <SeverityBar
            high={by_severity.High || 0}
            medium={by_severity.Medium || 0}
            low={by_severity.Low || 0}
          />
        </div>

        {/* Scanner distribution bar */}
        {Object.keys(by_scanner).length > 0 && (
          <div className="mt-5 pt-5 border-t border-[var(--color-surface-700)]">
            <ScannerBar byScanner={by_scanner} />
          </div>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t border-[var(--color-surface-700)]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Languages:</span>
            <div className="flex gap-1.5">
              {languages_detected.map((lang) => (
                <span key={lang} className="category-tag capitalize">{lang}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Scanners:</span>
            <div className="flex gap-1.5">
              {scanners_used.map((scanner) => (
                <span key={scanner} className="badge-scanner capitalize">{scanner}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Categories with horizontal bar charts */}
      {topCategories.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4 uppercase tracking-wider">
            Top Vulnerability Categories
          </h3>
          <div className="space-y-3">
            {topCategories.map(([cat, count]) => (
              <div key={cat} className="group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-neon-cyan)] transition-colors">
                    {cat}
                  </span>
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-surface-700)]/40 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / maxCategoryCount) * 100}%`,
                      background: "linear-gradient(90deg, var(--color-neon-cyan), var(--color-neon-purple))",
                      transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
                      boxShadow: "0 0 8px rgba(0,240,255,0.25)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
