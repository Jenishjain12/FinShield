import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Send,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  Crosshair,
} from "lucide-react";
import { Breadcrumb } from "../components/Breadcrumb";
import { EntityPanel } from "../components/EntityPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { EmptyState } from "../components/EmptyState";
import { RiskComposition } from "../components/RiskComposition";
import { EvidenceDocument } from "../components/EvidenceDocument";
import { RelationshipPathway } from "../components/RelationshipPathway";
import { SignalCard } from "../components/SignalCard";
import { Skeleton } from "../components/Skeleton";
import { DossierPanel } from "../components/DossierPanel";
import { TacticalBadge, ShimmerButton } from "../components/ui";
import { useToast } from "../components/Toast";
import { useAsync } from "../hooks/useAsync";
import { formatDate, truncate } from "../lib/format";
import { api } from "../services/api";
import type { ReviewStatus } from "../types/api";

const REVIEW_OPTIONS: { status: ReviewStatus; label: string; Icon: typeof Clock; desc: string }[] = [
  { status: "unreviewed",   label: "Unreviewed",   Icon: Clock,          desc: "Awaiting triage inspection" },
  { status: "under_review", label: "Under Review",  Icon: ShieldAlert,    desc: "Active human investigation" },
  { status: "escalated",    label: "Escalated",     Icon: ShieldAlert,    desc: "Flagged for priority audit" },
  { status: "closed",       label: "Closed / Resolved", Icon: CheckCircle2, desc: "Triage audit finalized" },
];

const REVIEW_ACTIVE: Record<ReviewStatus, string> = {
  unreviewed:   "border-dim/40 bg-surface text-sub",
  under_review: "border-warn/40 bg-warn/[0.08] text-warn",
  escalated:    "border-danger/40 bg-danger/[0.08] text-danger",
  closed:       "border-ok/40 bg-ok/[0.08] text-ok",
};

export function InvestigationDetailPage() {
  const { adId } = useParams();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAsync(() => api.ad(adId!), [adId]);
  const [note, setNote]         = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [focusedEvidence, setFocusedEvidence] = useState<string | null>(null);

  async function submitNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim() || !data) return;
    setNoteBusy(true);
    try {
      const newNote = await api.addNote(data.id, note.trim());
      setData({ ...data, notes: [...data.notes, newNote] });
      setNote("");
      toast("Analyst annotation recorded in case log.");
    } catch {
      toast("Failed to record annotation.", "err");
    } finally {
      setNoteBusy(false);
    }
  }

  async function setReview(status: ReviewStatus) {
    if (!data) return;
    try {
      const updated = await api.updateReview(data.id, status);
      setData(updated);
      toast(`Case disposition updated to "${status.replace("_", " ")}".`);
    } catch {
      toast("Failed to update case disposition.", "err");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16" />
        <div className="grid gap-4 lg:grid-cols-[240px_1fr_300px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* ── Breadcrumb ───────────────────────────────────────────── */}
      <Breadcrumb
        items={[
          { label: "Case Archive", to: "/investigations" },
          { label: `CASE / ${truncate(data.id, 12)}` },
        ]}
      />

      {/* ── Case Header & Metadata Strip ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-line bg-panel p-4 artifact-corner">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Crosshair size={14} className="text-signal-cyan" />
            <span className="font-mono text-xs font-semibold text-paper">
              CASE / {data.id.slice(0, 16).toUpperCase()}
            </span>
          </div>

          {data.is_seed && (
            <span className="border border-line/80 px-2 py-0.5 text-3xs font-mono text-dim uppercase">
              SYNTHETIC DEMONSTRATION DATA
            </span>
          )}

          <span className="text-3xs font-mono text-dim">
            Ingested: {formatDate(data.created_at)}
            {data.source ? ` · Channel: ${data.source}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <TacticalBadge level={data.risk_category} text={data.risk_category} />
          <Link
            to={`/copilot?adId=${data.id}`}
            className="flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
          >
            <Bot size={12} />
            Copilot Triage
            <ExternalLink size={10} />
          </Link>
        </div>
      </div>

      {/* ── Three-Panel Investigation Workspace ──────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[230px_1fr_300px] xl:grid-cols-[250px_1fr_320px]">
        {/* LEFT PANEL: Case Disposition & Metadata */}
        <aside className="space-y-4">
          {/* Disposition Controls */}
          <DossierPanel
            eyebrow="Triage Disposition"
            title="Human Decision Stamp"
            subtitle="Record investigator disposition"
          >
            <div className="space-y-2 mt-2" role="group" aria-label="Set review status">
              {REVIEW_OPTIONS.map((opt) => {
                const isActive = data.review_status === opt.status;
                return (
                  <button
                    key={opt.status}
                    type="button"
                    onClick={() => setReview(opt.status)}
                    aria-pressed={isActive}
                    className={`w-full flex items-start gap-2.5 border p-2.5 text-left text-xs font-mono transition-all ${
                      isActive
                        ? REVIEW_ACTIVE[opt.status]
                        : "border-line text-sub hover:bg-surface hover:text-paper"
                    }`}
                  >
                    <opt.Icon size={13} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{opt.label}</p>
                      <p className="text-3xs opacity-75 mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </DossierPanel>

          {/* Evidence Dossier Metadata */}
          <DossierPanel
            eyebrow="Forensic Ledger"
            title="Metadata Matrix"
          >
            <div className="space-y-2 font-mono text-2xs mt-2">
              {[
                { label: "Case ID", value: data.id.slice(0, 14) + "…" },
                { label: "Channel", value: data.source || "Unspecified" },
                { label: "Extracted Entities", value: String(data.entity_count) },
                { label: "Linked Relationships", value: String(data.relationships?.length ?? 0) },
                { label: "OCR Status", value: data.ocr_status || "N/A" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-1 border-b border-line/40">
                  <span className="text-dim">{label}</span>
                  <span className="text-paper truncate max-w-[120px]">{value}</span>
                </div>
              ))}
            </div>

            {data.source_url && (
              <div className="border-t border-line mt-3 pt-3">
                <p className="text-3xs font-mono text-dim mb-1 uppercase tracking-wider">
                  Submitted Reference URL (Not Fetched)
                </p>
                <p className="font-mono text-3xs text-sub break-all bg-surface/60 p-2 border border-line">
                  {data.source_url}
                </p>
              </div>
            )}
          </DossierPanel>
        </aside>

        {/* CENTER PANEL: Evidence Document, Signals & Chain */}
        <main className="space-y-4">
          {/* Submitted Copy & Annotations */}
          <DossierPanel
            eyebrow="Observable Artifact"
            title="Submitted Advertisement Copy"
            subtitle="Annotated entity tokens and linguistic signals"
          >
            <EvidenceDocument
              text={data.text}
              entities={data.entities}
              signals={data.signals}
              onSelect={setFocusedEvidence}
            />

            {focusedEvidence && (
              <div className="mt-3 flex items-center justify-between border-l-2 border-accent bg-accent/[0.08] px-3.5 py-2 font-mono text-xs">
                <span>
                  <span className="eyebrow mr-2">Focused Evidence Token:</span>
                  <span className="text-accent font-semibold">{focusedEvidence}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFocusedEvidence(null)}
                  className="text-accent hover:underline text-3xs uppercase font-semibold"
                >
                  Clear Selection
                </button>
              </div>
            )}

            {data.ocr_text && (
              <div className="mt-4 border border-line bg-surface/40 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ImageIcon size={12} className="text-dim" />
                  <p className="eyebrow">OCR Extracted Text</p>
                </div>
                <p className="evidence-mono text-xs leading-relaxed text-sub">
                  {data.ocr_text}
                </p>
              </div>
            )}

            {data.image_filename && (
              <div className="mt-4 border border-line bg-surface/30 p-3">
                <p className="eyebrow mb-2">Ingested Visual Media</p>
                <img
                  src={`/uploads/${data.image_filename}`}
                  alt="Ingested ad graphic"
                  className="border border-line w-full object-contain max-h-64 bg-black/40"
                />
              </div>
            )}
          </DossierPanel>

          {/* Operational Methodology Caveat */}
          <div className="flex items-start gap-3 border border-warn/30 bg-warn/[0.04] p-3.5" role="note">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-2xs font-mono text-sub leading-relaxed">
              <strong>INVESTIGATION AID DISCLOSURE:</strong> Risk scores and signals represent deterministic,
              explainable heuristic rules. They do not constitute an automated fraud verdict or criminal determination.
              All findings require independent analyst verification.
            </p>
          </div>

          {/* Signal Ledger */}
          <DossierPanel
            eyebrow="Deterministic Rules Engine"
            title="Signal Ledger & Score Breakdown"
            subtitle={`${data.signals.length} rules triggered`}
          >
            {data.signals.length === 0 ? (
              <EmptyState
                title="No elevated signals detected"
                body="Absence of rule hits does not verify legitimacy. Manual verification of counterparty credentials is recommended."
              />
            ) : (
              <div className="space-y-2 mt-2">
                {data.signals.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            )}

            {data.limitations && (
              <div className="mt-4 border border-line bg-surface/40 p-3 font-mono text-3xs text-dim leading-relaxed">
                <p className="eyebrow mb-1">Assessment Boundary & Scope Limitations</p>
                <p>{data.limitations}</p>
              </div>
            )}
          </DossierPanel>

          {/* Cross-Case Relationships */}
          {data.relationships && data.relationships.length > 0 && (
            <DossierPanel
              eyebrow="Network Graph"
              title="Related Investigations & Cross-Links"
              subtitle={`${data.relationships.length} connected case records`}
            >
              <p className="mb-3 text-2xs font-mono text-sub leading-relaxed">
                Links are established strictly through shared observable phone numbers, payment accounts, URLs, or high-similarity linguistic templates.
              </p>
              <RelationshipPathway relationships={data.relationships} currentAdId={data.id} />
            </DossierPanel>
          )}

          {/* Analyst Annotation Thread */}
          <DossierPanel
            eyebrow="Audit Trail"
            title="Analyst Annotations"
            subtitle={`${data.notes.length} case log entries`}
          >
            {data.notes.length > 0 && (
              <div className="mb-4 space-y-2.5">
                {data.notes.map((n) => (
                  <div key={n.id} className="border-l-2 border-accent bg-surface/50 pl-3.5 pr-3 py-2.5 font-mono">
                    <p className="text-xs text-paper/90 leading-relaxed font-sans">{n.content}</p>
                    <p className="mt-1 text-3xs text-dim">
                      {formatDate(n.created_at)} · Investigator Note
                    </p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={submitNote} className="flex gap-2" aria-label="Add case note">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Log an observation, verification step, or bank query reference…"
                aria-label="Note text"
                className="flex-1 border border-line bg-surface/60 px-3.5 py-2 font-mono text-xs text-paper placeholder:text-dim outline-none focus:border-accent transition-colors"
              />
              <ShimmerButton
                type="submit"
                disabled={noteBusy || !note.trim()}
                variant="primary"
                size="sm"
              >
                <Send size={12} className="mr-1.5 inline" /> Log
              </ShimmerButton>
            </form>
          </DossierPanel>
        </main>

        {/* RIGHT PANEL: Risk Composition & Entity Registry */}
        <aside className="space-y-4">
          <RiskComposition
            score={data.risk_score}
            category={data.risk_category}
            signals={data.signals}
          />

          {data.recommendation && (
            <DossierPanel
              eyebrow="Protocol Action"
              title="Investigative Guidance"
            >
              <p className="text-xs font-mono leading-relaxed text-paper/85 mt-2 bg-surface/40 p-3 border border-line">
                {data.recommendation}
              </p>
            </DossierPanel>
          )}

          <DossierPanel
            eyebrow="Entity Extraction"
            title="Identified Trace Entities"
            subtitle={`${data.entities.filter((e) => e.entity_type !== "phrase").length} actionable identifiers`}
          >
            <EntityPanel entities={data.entities} />
          </DossierPanel>
        </aside>
      </div>
    </div>
  );
}
