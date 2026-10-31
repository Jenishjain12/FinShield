import type { Entity, Signal } from "../types/api";

function highlightText(text: string, entities: Entity[], signals: Signal[], onSelect?: (value: string) => void) {
  const values = [...entities.map((e) => e.raw_value), ...signals.map((s) => s.evidence)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!values.length) return text;
  const escaped = values.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (!escaped) return text;
  const pieces = text.split(new RegExp(`(${escaped})`, "gi"));
  return pieces.map((piece, index) => values.some((value) => value.toLowerCase() === piece.toLowerCase()) ? (
    <button key={`${piece}-${index}`} type="button" onClick={() => onSelect?.(piece)} className="mx-px rounded-sm border-b border-accent/70 bg-accent/10 px-0.5 font-inherit text-inherit hover:bg-accent/20 focus-visible:outline-accent" title="Focus matched evidence">{piece}</button>
  ) : <span key={`${piece}-${index}`}>{piece}</span>);
}

export function EvidenceDocument({ text, entities = [], signals = [], onSelect }: { text: string; entities?: Entity[]; signals?: Signal[]; onSelect?: (value: string) => void }) {
  return (
    <article className="dossier-panel artifact-corner overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="eyebrow">Submitted artifact</span><span className="evidence-mono text-2xs text-dim">TEXT / OCR</span>
      </div>
      <p className="whitespace-pre-wrap p-5 font-mono text-sm leading-7 text-paper/85">{highlightText(text, entities, signals, onSelect)}</p>
      <div className="flex flex-wrap gap-2 border-t border-line px-4 py-2.5 text-2xs text-dim"><span className="h-2 w-2 border border-accent bg-accent/15" /> linked extracted evidence <span className="ml-auto">Select a highlight to focus it</span></div>
    </article>
  );
}
