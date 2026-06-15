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

export default function SummaryDashboard({ result }) {
  const { total_findings, summary, languages_detected, scanners_used } = result;
  const { by_severity, by_scanner, by_category } = summary;

  const topCategories = useMemo(() => {
    return Object.entries(by_category)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [by_category]);

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

      {/* Categories */}
      {topCategories.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3 uppercase tracking-wider">
            Top Vulnerability Categories
          </h3>
          <div className="flex flex-wrap gap-2">
            {topCategories.map(([cat, count]) => (
              <span key={cat} className="category-tag flex items-center gap-1.5">
                {cat}
                <span className="bg-[var(--color-surface-700)] text-[var(--color-text-muted)] rounded-full px-1.5 py-0.5 text-[0.65rem] leading-none">
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
