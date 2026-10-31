import { riskClass } from "../lib/format";
import type { RiskCategory } from "../types/api";

interface Props {
  value: string;
}

/** Small inline badge showing a risk category or severity level.
 *  Always includes a visible text label — color alone is never the sole signal. */
export function StatusBadge({ value }: Props) {
  const cat = value.toUpperCase() as RiskCategory;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5
                  text-2xs font-semibold uppercase tracking-[0.06em] ${riskClass(cat)}`}
      aria-label={`Risk level: ${value}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-75" aria-hidden="true" />
      {value}
    </span>
  );
}
