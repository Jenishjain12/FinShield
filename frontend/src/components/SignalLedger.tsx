import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { riskColor } from "../lib/format";
import type { Signal } from "../types/api";

interface SignalLedgerProps {
  signals: Signal[];
  limitations?: string | null;
  className?: string;
  onSelectSignal?: (signal: Signal) => void;
  selectedSignalId?: string | null;
}

function getSignalSeverity(contribution: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (contribution >= 25) return "CRITICAL";
  if (contribution >= 15) return "HIGH";
  if (contribution >= 8) return "MEDIUM";
  return "LOW";
}

export function SignalLedger({
  signals,
  limitations,
  className = "",
  onSelectSignal,
  selectedSignalId,
}: SignalLedgerProps) {
  if (!signals || signals.length === 0) {
    return (
      <div className={`p-6 text-center text-xs font-mono text-dim border border-line rounded-sm bg-panel ${className}`}>
        No active disturbances or rule hits recorded for this case.
      </div>
    );
  }

  const totalPoints = signals.reduce((sum, s) => sum + s.contribution, 0);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-warn" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-paper font-semibold">
            Signal Ledger ({signals.length} Disturbances)
          </h3>
        </div>
        <span className="font-mono text-2xs text-warn font-semibold">
          +{totalPoints} total triage pts
        </span>
      </div>

      <div className="space-y-2.5">
        {signals.map((signal) => {
          const severity = getSignalSeverity(signal.contribution);
          const color = riskColor(severity);
          const isSelected = selectedSignalId === signal.id;

          return (
            <article
              key={signal.id}
              onClick={() => onSelectSignal?.(signal)}
              className={`group relative overflow-hidden rounded-sm border p-3.5 transition-all ${
                isSelected
                  ? "border-accent bg-surface shadow-sm"
                  : "border-line bg-surface/40 hover:border-line-hover hover:bg-surface/80"
              } ${onSelectSignal ? "cursor-pointer" : ""}`}
            >
              {/* Left Urgency Stripe */}
              <span
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />

              <div className="pl-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-1.5 py-0.5 rounded-sm font-mono text-3xs font-bold uppercase border"
                      style={{
                        color,
                        borderColor: `${color}40`,
                        backgroundColor: `${color}14`,
                      }}
                    >
                      {severity}
                    </span>
                    <h4 className="font-mono text-xs font-semibold text-paper group-hover:text-accent transition-colors">
                      {signal.title}
                    </h4>
                  </div>
                  <span className="font-mono text-xs font-bold shrink-0" style={{ color }}>
                    +{signal.contribution} pts
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-sub font-sans">
                  {signal.explanation}
                </p>

                {signal.evidence && (
                  <div className="mt-2.5 flex items-start gap-1.5 rounded-sm border border-line/60 bg-bg/60 p-2 font-mono text-2xs text-paper/90">
                    <span className="text-dim shrink-0 uppercase tracking-wider">Observed:</span>
                    <span className="break-all">{signal.evidence}</span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {limitations && (
        <div className="flex items-center gap-1.5 text-3xs text-dim font-mono pt-1 border-t border-line/40">
          <Info size={10} className="shrink-0 text-dim" />
          <span>Scope limitation: {limitations}</span>
        </div>
      )}

      <p className="text-3xs text-dim font-mono flex items-center gap-1 pt-1">
        <AlertTriangle size={10} className="text-warn/70" />
        Signals represent calibrated rule disturbances for investigator triage, not legal verdicts.
      </p>
    </div>
  );
}
