import { Loader2 } from "lucide-react";

/** Displayed inline during analysis submission. Avoids fake progress stages. */
export function ProcessingOverlay() {
  return (
    <div
      className="flex items-center gap-3 rounded border border-line bg-panel px-5 py-4 animate-fade-in"
      role="status"
      aria-live="polite"
      aria-label="Analysis in progress"
    >
      <Loader2 size={16} className="animate-spin text-accent shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-paper">Analyzing advertisement…</p>
        <p className="text-xs text-sub mt-0.5">
          Extracting entities, evaluating rule-based indicators, and checking
          for related records.
        </p>
      </div>
    </div>
  );
}
