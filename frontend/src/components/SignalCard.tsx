import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { contributionLabel } from "../lib/format";
import type { Signal } from "../types/api";

interface Props {
  signal: Signal;
}

/** Renders a single rule-based risk indicator.
 *  Clearly separates indicator name, contribution, evidence, and explanation. */
export function SignalCard({ signal }: Props) {
  const [expanded, setExpanded] = useState(false);

  const bandClass =
    signal.contribution >= 20
      ? "border-l-danger text-danger bg-danger/[0.04]"
      : signal.contribution >= 10
      ? "border-l-warn text-warn bg-warn/[0.04]"
      : "border-l-accent text-accent bg-accent/[0.04]";

  return (
    <article
      className={`rounded border border-line border-l-2 ${bandClass} transition-colors`}
      aria-label={signal.title}
    >
      {/* Header row */}
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-paper leading-snug">
            {signal.title}
          </p>
          <p className="mt-0.5 text-2xs text-sub">
            {contributionLabel(signal.contribution)}
            {signal.contribution > 0
              ? ` · +${signal.contribution} score contribution`
              : ""}
          </p>
        </div>
        {expanded
          ? <ChevronUp size={14} className="mt-0.5 shrink-0 text-dim" aria-hidden="true" />
          : <ChevronDown size={14} className="mt-0.5 shrink-0 text-dim" aria-hidden="true" />
        }
      </button>

      {/* Expanded content */}
      {expanded ? (
        <div className="border-t border-line/60 px-4 pb-4 pt-3 space-y-3">
          {signal.evidence ? (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-sub mb-1.5">
                Evidence
              </p>
              <p className="font-mono text-xs leading-relaxed text-paper/75 bg-bg rounded px-3 py-2 border border-line/60">
                {signal.evidence}
              </p>
            </div>
          ) : null}
          {signal.explanation ? (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-sub mb-1.5">
                Explanation
              </p>
              <p className="text-xs leading-relaxed text-paper/70">
                {signal.explanation}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
