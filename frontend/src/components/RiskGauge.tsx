import { riskColor } from "../lib/format";
import type { RiskCategory } from "../types/api";

interface Props {
  score: number;
  category: RiskCategory;
  /** "compact" shows score inline; "block" shows score as large numeral */
  variant?: "compact" | "block";
}

/** Displays a configured triage score with risk category.
 *  Deliberately avoids the radial gauge pattern (see design brief). */
export function RiskScore({ score, category, variant = "block" }: Props) {
  const color = riskColor(category);
  const barWidth = `${Math.max(4, score)}%`;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2.5">
        <span
          className="font-mono text-sm font-semibold tabular"
          style={{ color }}
          aria-label={`Triage score ${score}`}
        >
          {score}
        </span>
        <span className="text-xs uppercase tracking-wide" style={{ color }}>
          {category}
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded border border-line bg-panel p-4"
      role="region"
      aria-label={`Risk assessment: ${category}, score ${score}`}
    >
      <p className="text-2xs font-medium uppercase tracking-[0.1em] text-sub mb-3">
        Configured triage score
      </p>
      <div className="flex items-end gap-4">
        <span
          className="font-mono text-5xl font-semibold leading-none tabular"
          style={{ color }}
          aria-hidden="true"
        >
          {score}
        </span>
        <div className="mb-1">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color }}
          >
            {category}
          </span>
          <p className="text-2xs text-dim mt-0.5">out of 100</p>
        </div>
      </div>
      {/* Progress bar */}
      <div
        className="mt-4 h-1 w-full rounded-full bg-surface overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: barWidth, backgroundColor: color }}
        />
      </div>
      <p className="mt-3 text-2xs leading-relaxed text-dim">
        This score is a rule-based triage signal. It is not a probability of
        fraud and does not constitute proof of criminality.
      </p>
    </div>
  );
}

/** Backward-compatible alias so existing code keeps working */
export function RiskGauge({ score, category }: { score: number; category: RiskCategory; size?: number }) {
  return <RiskScore score={score} category={category} />;
}
