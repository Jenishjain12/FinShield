import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileText,
  MapPin,
  MessageSquare,
  Network,
  Send,
  ShieldAlert,
  Smartphone,
  User,
  AlertTriangle,
} from "lucide-react";
import { SpotlightCard, TacticalBadge, BorderBeam, ShimmerButton } from "../components/ui";
import { api } from "../services/api";
import { riskColor } from "../lib/format";
import type { ReviewStatus, TransactionDetail } from "../types/api";

export function TransactionDetailPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();

  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Note form state
  const [newNote, setNewNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("Lead Risk Analyst");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Review update state
  const [updatingReview, setUpdatingReview] = useState(false);

  const fetchDetail = async () => {
    if (!transactionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.transaction(transactionId);
      setTx(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load transaction details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [transactionId]);

  const handleReviewChange = async (status: ReviewStatus) => {
    if (!tx) return;
    setUpdatingReview(true);
    try {
      const updated = await api.updateTransactionReview(tx.transaction_id, status);
      setTx(updated);
    } catch (err: any) {
      alert("Failed to update review status: " + err?.message);
    } finally {
      setUpdatingReview(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tx || !newNote.trim()) return;
    setSubmittingNote(true);
    try {
      await api.addTransactionNote(tx.transaction_id, newNote.trim(), noteAuthor);
      setNewNote("");
      fetchDetail();
    } catch (err: any) {
      alert("Failed to attach note: " + err?.message);
    } finally {
      setSubmittingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs font-mono text-dim animate-pulse">
        Retrieving transaction telemetry and risk assessment graph…
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-sm font-mono text-signal-red">{error || "Transaction record not found."}</p>
        <button
          onClick={() => navigate("/transactions")}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-line rounded bg-panel hover:bg-surface text-sub hover:text-paper transition-colors"
        >
          <ArrowLeft size={13} /> Return to Transactions Monitor
        </button>
      </div>
    );
  }

  const assessment = tx.assessment;
  const ruleHits = assessment?.rule_hits || [];
  const isCritical = tx.risk_category === "CRITICAL";
  const catColor = riskColor(tx.risk_category);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in relative">
      {/* ── Breadcrumb & Navigation Bar ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/transactions"
            className="flex items-center gap-1.5 text-xs font-mono text-sub hover:text-paper transition-colors"
          >
            <ArrowLeft size={14} /> Transactions
          </Link>
          <span className="text-dim">/</span>
          <span className="font-mono text-xs text-signal-cyan font-semibold">{tx.transaction_id}</span>
        </div>

        {/* Review Status Selector */}
        <div className="flex items-center gap-2.5">
          <span className="text-3xs font-mono text-dim uppercase tracking-wider">
            Human Disposition:
          </span>
          <select
            value={tx.review_status}
            disabled={updatingReview}
            onChange={(e) => handleReviewChange(e.target.value as ReviewStatus)}
            className="px-3 py-1.5 bg-surface border border-line rounded text-xs font-mono text-paper focus:outline-none focus:border-accent"
          >
            <option value="unreviewed">Unreviewed</option>
            <option value="under_review">Under Review</option>
            <option value="escalated">Escalated</option>
            <option value="closed">Closed / Cleared</option>
          </select>
        </div>
      </div>

      {/* ── Hero Banner: Forensic Overview ──────────────────────────── */}
      <SpotlightCard
        spotlightColor={isCritical ? "rgba(185, 56, 58, 0.15)" : "rgba(88, 199, 217, 0.08)"}
        className="p-5 sm:p-6 border-line bg-panel artifact-corner"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left Details (8 columns) */}
          <div className="md:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <TacticalBadge level={tx.risk_category} text={`${tx.risk_category} RISK`} />
              <span className="px-2 py-0.5 rounded text-3xs font-mono bg-surface border border-line text-sub uppercase font-semibold">
                {tx.transaction_type}
              </span>
              <span className="px-2 py-0.5 rounded text-3xs font-mono bg-surface border border-line text-sub">
                Channel: {tx.channel}
              </span>
              {tx.is_synthetic && (
                <span className="px-2 py-0.5 rounded text-3xs font-mono bg-signal-cyan/10 text-signal-cyan border border-signal-cyan/25 font-semibold">
                  Synthetic Demonstration Record
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold font-mono text-paper tracking-tight">
                ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h1>
              <span className="text-xs font-mono text-dim">{tx.currency}</span>
              <span className="text-xs font-mono text-dim">
                • {new Date(tx.timestamp).toLocaleString()}
              </span>
            </div>

            {tx.reference_note && (
              <p className="text-xs text-sub font-mono bg-surface/60 px-3 py-1.5 rounded border border-line w-fit">
                <span className="text-dim">Payment Reference: </span>
                <span className="text-paper">"{tx.reference_note}"</span>
              </p>
            )}
          </div>

          {/* Right Triage Score Meter (4 columns) */}
          <div className="md:col-span-4 p-5 bg-surface/50 border border-line rounded text-center space-y-2 relative overflow-hidden">
            {isCritical && (
              <BorderBeam colorFrom="#B9383A" colorTo="#E6654F" duration={5} size={150} borderWidth={1.5} />
            )}
            <div className="text-3xs font-mono uppercase text-dim tracking-wider">
              Composite Triage Score
            </div>
            <div className="text-4xl sm:text-5xl font-mono font-extrabold leading-none" style={{ color: catColor }}>
              {tx.risk_score}
              <span className="text-sm font-normal text-dim"> / 100</span>
            </div>
            <div className="text-3xs font-mono text-dim flex items-center justify-center gap-3 pt-1">
              <span>ML Anomaly: <strong className="text-paper">{tx.anomaly_score}</strong></span>
              <span>•</span>
              <span>Rules Points: <strong className="text-paper">{ruleHits.reduce((acc, r) => acc + r.contribution, 0)}</strong></span>
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* ── Main Forensic Grid: Counterparties (Left) vs Risk Analysis (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Topology & Hardware (6 columns) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Counterparties Topology Card */}
          <SpotlightCard className="p-5 border-line bg-panel artifact-corner">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h2 className="text-xs font-mono uppercase tracking-wider text-paper flex items-center gap-2 font-semibold">
                  <User size={14} className="text-signal-cyan" />
                  Counterparty Topology
                </h2>
                <span className="text-3xs font-mono text-dim">2 Endpoints</span>
              </div>

              {/* Sender Box */}
              <div className="p-3.5 bg-surface/50 border border-line rounded space-y-2">
                <div className="flex items-center justify-between text-3xs font-mono text-dim uppercase">
                  <span>Sender / Payer</span>
                  <span className="text-paper font-semibold">{tx.sender_account_id}</span>
                </div>
                <div className="font-mono text-sm text-signal-cyan font-semibold truncate">
                  {tx.sender_upi_handle}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/50 text-xs font-mono text-sub">
                  <div>
                    <span className="text-3xs text-dim block uppercase">Observed Region</span>
                    <span className="text-paper flex items-center gap-1 text-2xs mt-0.5">
                      <MapPin size={11} className="text-signal-cyan" /> {tx.synthetic_geo_region}
                    </span>
                  </div>
                  <div>
                    <span className="text-3xs text-dim block uppercase">Synthetic IP</span>
                    <span className="text-paper text-2xs mt-0.5">{tx.synthetic_ip}</span>
                  </div>
                </div>
              </div>

              {/* Transfer Direction Indicator */}
              <div className="flex items-center justify-center text-dim font-mono text-3xs py-1">
                <span className="border-t border-line flex-1" />
                <span className="px-3 uppercase flex items-center gap-1.5 text-signal-cyan font-semibold">
                  {tx.transaction_type === "collect" ? "Pull Request (Collect)" : "Push Transfer (Pay)"}
                  <ArrowRight size={12} className="text-signal-cyan" />
                </span>
                <span className="border-t border-line flex-1" />
              </div>

              {/* Receiver Box */}
              <div className="p-3.5 bg-surface/50 border border-line rounded space-y-2">
                <div className="flex items-center justify-between text-3xs font-mono text-dim uppercase">
                  <span>Beneficiary / Payee</span>
                  <span className="text-paper font-semibold">{tx.receiver_account_id}</span>
                </div>
                <div className="font-mono text-sm text-paper font-semibold truncate">
                  {tx.receiver_upi_handle}
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* Hardware & Terminal Metadata */}
          <SpotlightCard className="p-5 border-line bg-panel artifact-corner">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h2 className="text-xs font-mono uppercase tracking-wider text-paper flex items-center gap-2 font-semibold">
                  <Smartphone size={14} className="text-signal-cyan" />
                  Hardware & Terminal Metadata
                </h2>
                <span className="text-3xs font-mono text-dim">Device Verification</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-surface/50 border border-line rounded">
                  <span className="text-3xs text-dim block uppercase">Device Fingerprint</span>
                  <span className="text-paper font-medium text-2xs mt-0.5 block truncate">{tx.device_id}</span>
                </div>
                <div className="p-3 bg-surface/50 border border-line rounded">
                  <span className="text-3xs text-dim block uppercase">Gateway Channel</span>
                  <span className="text-paper font-medium text-2xs mt-0.5 uppercase block">{tx.channel}</span>
                </div>
              </div>

              <div className="pt-1 text-right">
                <Link
                  to={`/entities?q=${encodeURIComponent(tx.device_id)}`}
                  className="text-signal-cyan hover:underline inline-flex items-center gap-1 text-2xs font-mono"
                >
                  Inspect Device Clustering in Network Graph <Network size={11} />
                </Link>
              </div>
            </div>
          </SpotlightCard>

          {/* Investigator Audit Log */}
          <SpotlightCard className="p-5 border-line bg-panel artifact-corner">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h2 className="text-xs font-mono uppercase tracking-wider text-paper flex items-center gap-2 font-semibold">
                  <MessageSquare size={14} className="text-signal-cyan" />
                  Investigator Audit Log ({tx.notes?.length || 0})
                </h2>
                <span className="text-3xs font-mono text-dim">Case History</span>
              </div>

              {/* Note form */}
              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Record verifiable evidence note, rule confirmation, or bank query reference…"
                  rows={3}
                  className="w-full p-2.5 bg-surface/60 border border-line rounded text-xs text-paper placeholder:text-dim focus:outline-none focus:border-accent font-mono"
                />
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    value={noteAuthor}
                    onChange={(e) => setNoteAuthor(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface/60 border border-line rounded text-2xs font-mono text-sub focus:outline-none focus:border-accent w-48"
                    placeholder="Author identifier"
                  />
                  <ShimmerButton
                    type="submit"
                    disabled={submittingNote || !newNote.trim()}
                    variant="primary"
                    size="sm"
                  >
                    <Send size={12} className="mr-1 inline" /> Record Note
                  </ShimmerButton>
                </div>
              </form>

              {/* Notes list */}
              <div className="space-y-2 pt-2">
                {tx.notes && tx.notes.length > 0 ? (
                  tx.notes.map((n) => (
                    <div key={n.id} className="p-3 bg-surface/50 border border-line rounded text-xs space-y-1 font-mono">
                      <div className="flex items-center justify-between text-3xs text-dim">
                        <span className="text-signal-cyan font-semibold">{n.author}</span>
                        <span>{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-paper/90 font-sans text-xs">{n.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-3xs font-mono text-dim">
                    No analyst annotations recorded for this transaction yet.
                  </div>
                )}
              </div>
            </div>
          </SpotlightCard>
        </div>

        {/* RIGHT COLUMN: Explainable Signals & Models (6 columns) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Rules & Signals Card */}
          <SpotlightCard className="p-5 border-line bg-panel artifact-corner">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h2 className="text-xs font-mono uppercase tracking-wider text-paper flex items-center gap-2 font-semibold">
                  <ShieldAlert size={14} className="text-burnished-amber" />
                  Deterministic Risk Signals ({ruleHits.length})
                </h2>
                <span className="text-3xs font-mono text-dim">Transparent Engine</span>
              </div>

              {ruleHits.length === 0 ? (
                <div className="p-6 bg-surface/40 border border-line rounded text-center text-xs font-mono text-dim space-y-2">
                  <CheckCircle2 size={24} className="mx-auto text-mineral-green/70" />
                  <p className="text-paper font-medium">No rule violations triggered on this transaction.</p>
                  <p className="text-3xs text-dim">Parameters match baseline velocity and payee relationship profiles.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ruleHits.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-surface/50 border border-line rounded space-y-2 hover:border-line-hover transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TacticalBadge level={rule.severity} text={rule.severity} />
                          <span className="font-mono text-xs font-semibold text-paper">{rule.title}</span>
                        </div>
                        <span className="text-2xs font-mono text-burnished-amber font-bold">
                          +{rule.contribution} pts
                        </span>
                      </div>

                      <p className="text-xs text-sub leading-relaxed font-sans">{rule.explanation}</p>

                      <div className="p-2 bg-surface/80 border border-line/60 rounded text-3xs font-mono text-paper">
                        <span className="text-dim">Observable Evidence: </span>{rule.evidence}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SpotlightCard>

          {/* Machine Learning Outlier Isolation */}
          <SpotlightCard className="p-5 border-line bg-panel artifact-corner">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h2 className="text-xs font-mono uppercase tracking-wider text-paper flex items-center gap-2 font-semibold">
                  <Cpu size={14} className="text-signal-cyan" />
                  Machine Learning Outlier Isolation
                </h2>
                <span className="text-3xs font-mono text-dim">Tree Partitioning</span>
              </div>

              <div className="p-4 bg-surface/50 border border-line rounded space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-dim">Algorithm:</span>
                  <span className="text-paper font-semibold">Isolation Forest (Tree Partitioning)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dim">Normalized Distance:</span>
                  <span className="text-paper font-semibold">{tx.anomaly_score} / 100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dim">Model Pipeline:</span>
                  <span className="text-signal-cyan font-semibold">{assessment?.model_version || "isolation_forest_v1.0"}</span>
                </div>
              </div>

              {/* Feature Snapshot */}
              {assessment?.feature_snapshot && (
                <div className="space-y-2">
                  <span className="text-3xs font-mono uppercase text-dim block">
                    Evaluated Feature Vector
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-3xs font-mono bg-surface/40 p-3 rounded border border-line max-h-48 overflow-y-auto">
                    {Object.entries(assessment.feature_snapshot).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-line/40 pb-1">
                        <span className="text-dim truncate">{k}:</span>
                        <span className="text-paper font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SpotlightCard>

          {/* Recommendation & Limitations Notice */}
          <SpotlightCard className="p-5 border-line bg-panel artifact-corner">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h2 className="text-xs font-mono uppercase tracking-wider text-paper flex items-center gap-2 font-semibold">
                  <FileText size={14} className="text-signal-cyan" />
                  Investigator Protocol & Guidance
                </h2>
                <span className="text-3xs font-mono text-dim">Action Guidance</span>
              </div>

              {assessment?.recommendation && (
                <div className="p-3 bg-signal-cyan/10 border border-signal-cyan/25 rounded text-xs text-paper font-sans leading-relaxed">
                  <span className="font-semibold text-signal-cyan block font-mono text-3xs uppercase mb-1">
                    Recommended Investigative Protocol:
                  </span>
                  {assessment.recommendation}
                </div>
              )}

              <div className="flex items-start gap-2.5 p-3 bg-warn/[0.05] border border-warn/25 rounded text-2xs text-sub font-mono leading-relaxed">
                <AlertTriangle size={13} className="text-warn shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-warn uppercase block text-3xs mb-0.5">
                    Methodology Disclaimer:
                  </span>
                  {assessment?.limitations ||
                    "FIN-SHIELD is an investigation and triage aid. Scores and anomalies reflect statistical deviations and rule matches, requiring independent verification before taking enforcement action."}
                </div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
