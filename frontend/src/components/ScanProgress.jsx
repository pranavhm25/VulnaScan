const STEPS = [
  { key: "queued", label: "Queued", icon: "⏳" },
  { key: "cloning", label: "Cloning Repo", icon: "📦" },
  { key: "scanning", label: "Running Scanners", icon: "🔍" },
  { key: "analyzing", label: "AI Analysis", icon: "🤖" },
  { key: "complete", label: "Complete", icon: "✅" },
];

function getStepIndex(status) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function ScanProgress({ status }) {
  const currentIdx = getStepIndex(status.status);

  return (
    <div className="w-full max-w-2xl mt-8 animate-fade-in">
      <div className="glass-card rounded-2xl p-6">
        {/* Progress bar */}
        <div className="relative mb-6">
          <div className="h-1 bg-[var(--color-surface-700)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-neon-cyan)] to-[var(--color-neon-purple)] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.max(5, (currentIdx / (STEPS.length - 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="flex justify-between">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentIdx;
            const isDone = idx < currentIdx;
            const isPending = idx > currentIdx;

            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all duration-300 ${
                    isActive
                      ? "bg-[var(--color-neon-cyan)]/15 pulse-glow border border-[var(--color-neon-cyan)]/40"
                      : isDone
                      ? "bg-[var(--color-severity-low)]/15 border border-[var(--color-severity-low)]/30"
                      : "bg-[var(--color-surface-800)] border border-[var(--color-surface-700)]"
                  }`}
                >
                  <span className={isActive ? "step-active" : isPending ? "opacity-30" : ""}>
                    {isDone ? "✓" : step.icon}
                  </span>
                </div>
                <span
                  className={`text-xs font-medium transition-colors ${
                    isActive
                      ? "text-[var(--color-neon-cyan)]"
                      : isDone
                      ? "text-[var(--color-severity-low)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status message */}
        <div className="mt-5 text-center">
          <p className="text-[var(--color-text-secondary)] text-sm">
            {status.progress_message || "Preparing scan..."}
          </p>
        </div>
      </div>
    </div>
  );
}
