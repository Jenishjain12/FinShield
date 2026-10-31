import { riskColor } from "../lib/format";
import type { RiskCategory, Signal } from "../types/api";

export function RiskComposition({ score, category, signals = [] }: { score: number; category: RiskCategory; signals?: Signal[] }) {
  const color = riskColor(category);
  const contribution = signals.reduce((sum, signal) => sum + signal.contribution, 0);
  return (
    <section className="dossier-panel artifact-corner p-4" aria-label={`Configured triage score ${score}, ${category}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Configured triage score</p>
          <div className="mt-2 flex items-end gap-2">
            <strong className="evidence-mono text-5xl leading-none" style={{ color }}>{score}</strong>
            <span className="mb-1 text-xs font-semibold tracking-[.16em]" style={{ color }}>{category}</span>
          </div>
        </div>
        <span className="evidence-mono border border-line px-2 py-1 text-2xs text-dim">0—100</span>
      </div>
      <div className="mt-5 h-2 overflow-hidden bg-surface" aria-hidden="true">
        <div className="h-full transition-all duration-500" style={{ width: `${Math.max(3, score)}%`, backgroundColor: color }} />
      </div>
      {signals.length ? (
        <div className="mt-4 space-y-2">
          {signals.slice(0, 4).map((signal) => (
            <div key={signal.id} className="grid grid-cols-[1fr,50px] items-center gap-3 text-2xs">
              <span className="truncate text-sub">{signal.title}</span>
              <span className="evidence-mono text-right" style={{ color }}>+{signal.contribution}</span>
            </div>
          ))}
          {contribution > 0 ? <p className="pt-1 text-2xs text-dim">Visible rule contributions: {contribution} points.</p> : null}
        </div>
      ) : null}
      <p className="mt-4 border-t border-line pt-3 text-2xs leading-relaxed text-dim">Rule-based triage aid — not a fraud probability.</p>
    </section>
  );
}
