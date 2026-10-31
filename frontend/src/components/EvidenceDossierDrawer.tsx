import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Flame,
  Link2,
  Phone,
  QrCode,
  Shield,
  Tag,
  X,
  Check,
} from "lucide-react";
import { api } from "../services/api";
import type {
  AdvertisementDetail,
  AdvertisementSummary,
  Relationship,
  ReviewStatus,
} from "../types/api";
import { relationshipLabel, riskClass } from "../lib/format";
import { RiskScore } from "./RiskGauge";
import { Skeleton } from "./Skeleton";
import { useToast } from "./Toast";

interface Props {
  selectedNode: AdvertisementSummary | null;
  selectedEdge: Relationship | null;
  onClose: () => void;
  onSelectRelatedAd?: (adId: string) => void;
}

const REVIEW_OPTIONS: { status: ReviewStatus; label: string; icon: string }[] = [
  { status: "unreviewed", label: "Unreviewed", icon: "·" },
  { status: "under_review", label: "Under Review", icon: "◐" },
  { status: "escalated", label: "Escalated", icon: "▲" },
  { status: "closed", label: "Closed", icon: "✓" },
];

export function EvidenceDossierDrawer({
  selectedNode,
  selectedEdge,
  onClose,
  onSelectRelatedAd,
}: Props) {
  const toast = useToast();
  const [detail, setDetail] = useState<AdvertisementDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (selectedNode?.id) {
      setLoading(true);
      api.ad(selectedNode.id)
        .then((res) => {
          setDetail(res);
          setLoading(false);
        })
        .catch(() => {
          setDetail(null);
          setLoading(false);
        });
    } else {
      setDetail(null);
    }
  }, [selectedNode?.id]);

  function copyValue(val: string) {
    navigator.clipboard.writeText(val);
    setCopiedText(val);
    toast("Copied to clipboard", "ok");
    setTimeout(() => setCopiedText(null), 2000);
  }

  async function handleStatusChange(newStatus: ReviewStatus) {
    if (!detail) return;
    setUpdatingStatus(true);
    try {
      const updated = await api.updateReview(detail.id, newStatus);
      setDetail(updated);
      toast(`Case disposition updated to ${newStatus.replace("_", " ")}`, "ok");
    } catch {
      toast("Failed to update case disposition", "err");
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (!selectedNode && !selectedEdge) return null;

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 w-full sm:w-[420px] lg:w-[460px] z-30 bg-panel/95 backdrop-blur-xl border-l border-line shadow-2xl flex flex-col animate-slide-left overflow-hidden select-text"
      aria-label="Evidence dossier drawer"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-surface/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse_subtle" />
          <span className="text-3xs font-mono uppercase tracking-widest text-dim">
            {selectedNode ? "Case Dossier" : "Relationship Thread"}
          </span>
          {selectedNode && (
            <span className="evidence-mono text-xs font-semibold text-accent truncate">
              CASE {selectedNode.id.slice(0, 8).toUpperCase()}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-dim hover:text-paper hover:bg-surface transition-colors"
          aria-label="Close dossier drawer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {selectedNode ? (
          loading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          ) : (
            <>
              {/* Risk Score & Category Banner */}
              <div className="rounded border border-line bg-surface/60 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <RiskScore
                    score={selectedNode.risk_score}
                    category={selectedNode.risk_category}
                    variant="block"
                  />
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-2xs font-bold ${riskClass(
                        selectedNode.risk_category
                      )}`}
                    >
                      <Shield size={10} />
                      {selectedNode.risk_category}
                    </span>
                    <span className="block text-3xs font-mono text-dim mt-1">
                      {detail?.is_seed ? "Synthetic Benchmark" : "Submitted Record"}
                    </span>
                  </div>
                </div>

                {/* Score Disclaimer Caveat */}
                <p className="text-3xs text-dim leading-relaxed border-t border-line/50 pt-2 font-mono">
                  Configured rules-based triage score (0–100). Not a statistically calibrated fraud probability.
                </p>
              </div>

              {/* Disposition Action Buttons */}
              <div className="space-y-1.5">
                <span className="text-3xs font-semibold uppercase tracking-wider text-dim block">
                  Investigator Disposition Stamp:
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {REVIEW_OPTIONS.map((opt) => {
                    const isCurrent = detail?.review_status === opt.status;
                    return (
                      <button
                        key={opt.status}
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleStatusChange(opt.status)}
                        className={`px-2 py-1.5 text-3xs rounded border font-mono transition-all text-center ${
                          isCurrent
                            ? "border-accent bg-accent/15 text-accent font-bold shadow-sm"
                            : "border-line bg-surface/50 text-sub hover:text-paper hover:bg-surface"
                        }`}
                      >
                        <span className="block text-xs leading-none mb-0.5">{opt.icon}</span>
                        <span className="truncate block">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ad Copy Excerpt with detected highlights */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-semibold uppercase tracking-wider text-dim">
                    Observable Advertisement Text:
                  </span>
                  {selectedNode.source && (
                    <span className="text-3xs font-mono text-dim uppercase">
                      Channel: {selectedNode.source}
                    </span>
                  )}
                </div>
                <div className="rounded border border-line bg-bg p-3.5 text-xs text-paper/90 leading-relaxed font-sans whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedNode.text || "No copy text recorded."}
                </div>
                {detail?.source_url && (
                  <div className="flex items-center gap-2 text-2xs text-dim font-mono truncate">
                    <span className="text-sub">Ref URL:</span>
                    <span className="truncate text-accent/80">{detail.source_url}</span>
                    <span className="text-3xs text-dim italic">(Never fetched)</span>
                  </div>
                )}
              </div>

              {/* Signal Ledger Composition */}
              {detail && detail.signals.length > 0 && (
                <div className="space-y-2">
                  <span className="text-3xs font-semibold uppercase tracking-wider text-dim flex items-center gap-1.5">
                    <Flame size={11} className="text-warn" />
                    Triggered Signal Breakdown ({detail.signals.length}):
                  </span>
                  <div className="space-y-1.5">
                    {detail.signals.map((sig) => (
                      <div
                        key={sig.id}
                        className="rounded border border-line bg-surface/40 p-2.5 text-2xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-paper font-semibold">
                          <span className="truncate flex items-center gap-1.5">
                            <AlertTriangle size={11} className="text-warn shrink-0" />
                            {sig.title}
                          </span>
                          <span className="evidence-mono text-accent font-bold shrink-0">
                            +{sig.contribution} pts
                          </span>
                        </div>
                        <p className="text-3xs text-sub leading-relaxed">{sig.explanation}</p>
                        {sig.evidence && (
                          <div className="font-mono text-3xs text-accent/80 bg-bg/80 border border-line/60 rounded px-2 py-0.5 truncate">
                            Evidence: "{sig.evidence}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Observable Identifiers */}
              {detail && detail.entities.length > 0 && (
                <div className="space-y-2">
                  <span className="text-3xs font-semibold uppercase tracking-wider text-dim flex items-center gap-1.5">
                    <Tag size={11} className="text-accent" />
                    Observable Extracted Entities ({detail.entities.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.entities.map((ent) => (
                      <button
                        key={ent.id}
                        type="button"
                        onClick={() => copyValue(ent.normalized_value)}
                        className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-2.5 py-1 text-3xs font-mono text-paper hover:border-accent/40 transition-colors group"
                        title="Click to copy identifier"
                      >
                        {ent.entity_type === "phone" && <Phone size={9} className="text-accent" />}
                        {ent.entity_type === "upi" && <QrCode size={9} className="text-warn" />}
                        <span className="text-dim uppercase">{ent.entity_type}:</span>
                        <span className="text-paper font-medium">{ent.normalized_value}</span>
                        {copiedText === ent.normalized_value ? (
                          <Check size={9} className="text-ok ml-0.5" />
                        ) : (
                          <Copy size={9} className="text-dim group-hover:text-accent ml-0.5 opacity-50 group-hover:opacity-100" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Campaign Pathways */}
              {detail && detail.relationships.length > 0 && (
                <div className="space-y-2 border-t border-line pt-3">
                  <span className="text-3xs font-semibold uppercase tracking-wider text-dim flex items-center gap-1.5">
                    <Link2 size={11} className="text-accent" />
                    Connected Advertisements ({detail.relationships.length}):
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {detail.relationships.slice(0, 6).map((rel) => {
                      const otherId =
                        rel.source_ad_id === detail.id ? rel.target_ad_id : rel.source_ad_id;
                      return (
                        <div
                          key={rel.id}
                          className="flex items-center justify-between gap-2 rounded border border-line bg-surface/30 p-2 text-2xs"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-3xs text-accent">
                              CASE {otherId.slice(0, 8).toUpperCase()}
                            </span>
                            <span className="block text-3xs text-dim truncate">
                              via {relationshipLabel(rel.relationship_type)}: {rel.evidence}
                            </span>
                          </div>
                          {onSelectRelatedAd && (
                            <button
                              type="button"
                              onClick={() => onSelectRelatedAd(otherId)}
                              className="shrink-0 text-3xs font-mono text-accent hover:underline"
                            >
                              Focus →
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )
        ) : selectedEdge ? (
          /* Edge Relationship Inspector */
          <div className="space-y-4 animate-fade-in">
            <div className="rounded border border-line bg-surface/60 p-4 space-y-2">
              <span className="text-3xs font-semibold uppercase tracking-wider text-dim block">
                Evidence Connection Type:
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    selectedEdge.relationship_type === "text_similarity" ? "bg-warn" : "bg-accent"
                  }`}
                />
                <h3 className="text-sm font-semibold text-paper">
                  {relationshipLabel(selectedEdge.relationship_type)}
                </h3>
              </div>
            </div>

            {selectedEdge.evidence && (
              <div className="space-y-1.5">
                <span className="text-3xs font-semibold uppercase tracking-wider text-dim block">
                  Shared Observable Identifier Value:
                </span>
                <div className="flex items-center justify-between rounded border border-accent/40 bg-accent/[0.08] p-3 text-xs font-mono text-accent break-all">
                  <span>{selectedEdge.evidence}</span>
                  <button
                    type="button"
                    onClick={() => copyValue(selectedEdge.evidence)}
                    className="p-1 hover:text-paper transition-colors shrink-0 ml-2"
                    title="Copy identifier"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            )}

            {selectedEdge.explanation && (
              <div className="space-y-1.5">
                <span className="text-3xs font-semibold uppercase tracking-wider text-dim block">
                  Deterministic Link Provenance:
                </span>
                <p className="text-2xs text-paper/85 leading-relaxed bg-surface/50 border border-line rounded p-3 font-sans">
                  {selectedEdge.explanation}
                </p>
              </div>
            )}

            {selectedEdge.similarity_score != null && (
              <div className="rounded border border-warn/30 bg-warn/[0.06] p-3 space-y-1.5">
                <div className="flex items-center justify-between text-2xs font-mono">
                  <span className="text-warn font-semibold">Computed Copy Overlap:</span>
                  <span className="text-warn font-bold">
                    {(selectedEdge.similarity_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden">
                  <div
                    className="h-full bg-warn rounded-full"
                    style={{ width: `${Math.round(selectedEdge.similarity_score * 100)}%` }}
                  />
                </div>
                <span className="text-3xs text-dim block font-sans">
                  Heuristic text similarity does not imply common criminal coordination.
                </span>
              </div>
            )}

            {/* Linked Pair Navigation */}
            <div className="space-y-2 border-t border-line pt-3">
              <span className="text-3xs font-semibold uppercase tracking-wider text-dim block">
                Linked Case Pair:
              </span>
              <div className="grid grid-cols-2 gap-2 text-2xs font-mono">
                <Link
                  to={`/investigations/${selectedEdge.source_ad_id}`}
                  className="rounded border border-line bg-surface p-2.5 text-center text-accent hover:border-accent/40 transition-colors"
                >
                  Source Case <br />
                  <span className="text-paper">{selectedEdge.source_ad_id.slice(0, 8)}</span>
                </Link>
                <Link
                  to={`/investigations/${selectedEdge.target_ad_id}`}
                  className="rounded border border-line bg-surface p-2.5 text-center text-accent hover:border-accent/40 transition-colors"
                >
                  Target Case <br />
                  <span className="text-paper">{selectedEdge.target_ad_id.slice(0, 8)}</span>
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer CTA */}
      {selectedNode && (
        <div className="border-t border-line p-4 bg-surface/50 shrink-0">
          <Link
            to={`/investigations/${selectedNode.id}`}
            className="w-full flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-xs font-semibold text-white hover:bg-accent/90 transition-colors shadow-sm"
          >
            <ExternalLink size={13} />
            Open Deep Investigation Workspace
          </Link>
        </div>
      )}
    </aside>
  );
}
