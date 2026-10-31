import { ShieldCheck } from "lucide-react";

export function MethodologyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`flex items-start gap-2.5 ${compact ? "" : "dossier-panel artifact-corner px-4 py-3"}`} role="note">
      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      <div>
        {!compact ? <p className="eyebrow mb-1">Methodology notice</p> : null}
        <p className="text-xs leading-relaxed text-sub">
          FIN-SHIELD organizes observed indicators for human triage. Scores and relationships are not fraud probabilities, verdicts, or proof of criminality.
        </p>
      </div>
    </aside>
  );
}
