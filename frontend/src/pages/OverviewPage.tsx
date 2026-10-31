import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Clock,
  Pause,
  Play,
  Zap,
} from "lucide-react";
import { DossierPanel } from "../components/DossierPanel";
import { EvidenceDossierDrawer } from "../components/EvidenceDossierDrawer";
import { MethodologyNotice } from "../components/MethodologyNotice";
import { Skeleton } from "../components/Skeleton";
import {
  BorderBeam,
  NumberTicker,
  ShimmerButton,
  TacticalBadge,
} from "../components/ui";
import { riskColor } from "../lib/format";
import { api } from "../services/api";
import type {
  AdvertisementSummary,
  CampaignDetail,
  DashboardSummaryResponse,
  Relationship,
} from "../types/api";

const EvidenceUniverse3D = lazy(() =>
  import("../components/EvidenceUniverse3D").then((m) => ({
    default: m.EvidenceUniverse3D,
  }))
);

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

const ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-2xs text-dim tabular">
      {now.toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      })}
      {" · "}
      {now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  );
}

export function OverviewPage() {
  const navigate = useNavigate();

  // Load UPI Dashboard summary
  const [upiData, setUpiData] = useState<DashboardSummaryResponse | null>(null);

  // Evidence Universe 3D State
  const [ads, setAds] = useState<AdvertisementSummary[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [selectedNode, setSelectedNode] = useState<AdvertisementSummary | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Relationship | null>(null);

  const [hasWebGL] = useState(() => supportsWebGL());
  const [viewMode, setViewMode] = useState<"upi" | "3d">("upi");

  const fetchUPISummary = async () => {
    try {
      const res = await api.dashboardUPI();
      setUpiData(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUPISummary();
    const interval = setInterval(fetchUPISummary, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load 3D graph if user switches to 3D mode
  useEffect(() => {
    if (viewMode === "3d" && ads.length === 0) {
      Promise.all([
        api.ads({ page_size: 80 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 80 })),
        api.campaigns().catch(() => []),
      ])
        .then(([adsRes, campaignsRes]) => {
          setAds(adsRes.items);
          if (campaignsRes.length > 0) {
            Promise.all(
              campaignsRes.slice(0, 4).map((c) => api.campaign(c.id).catch(() => null))
            ).then((topCampaigns) => {
              const allRels: Relationship[] = [];
              const seen = new Set<string>();
              topCampaigns.forEach((camp: CampaignDetail | null) => {
                if (camp?.relationships) {
                  camp.relationships.forEach((rel) => {
                    const key = `${rel.source_ad_id}|${rel.target_ad_id}`;
                    if (!seen.has(key)) {
                      seen.add(key);
                      allRels.push(rel);
                    }
                  });
                }
              });
              setRelationships(allRels);
            });
          }
        })
        .catch(() => {});
    }
  }, [viewMode, ads.length]);

  const handleStreamToggle = async () => {
    if (!upiData) return;
    try {
      if (upiData.stream_telemetry.status === "running") {
        const res = await api.streamPause();
        setUpiData((prev) => (prev ? { ...prev, stream_telemetry: res } : prev));
      } else {
        const res = await api.streamStart(2.0);
        setUpiData((prev) => (prev ? { ...prev, stream_telemetry: res } : prev));
      }
    } catch (err: any) {
      alert("Stream error: " + err?.message);
    }
  };

  const isStreamRunning = upiData?.stream_telemetry?.status === "running";

  return (
    <div className="space-y-6 animate-fade-in relative pb-12">
      {/* ── Editorial Hero Header ───────────────────────────────────── */}
      <header className="border-b border-line pb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse_subtle" />
              <p className="eyebrow text-accent">Signal Cartography // Financial Intelligence</p>
            </div>
            <h1 className="font-display text-3xl text-paper tracking-tight">
              Evidence Observatory
            </h1>
            <p className="mt-1 text-xs text-sub font-mono leading-relaxed max-w-2xl">
              Multivariate digital-payment anomaly monitoring, deterministic pattern constellations, and evidence-backed triage for simulated Indian UPI streams.
            </p>
          </div>

          {/* Global Operations Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-sm border border-line bg-surface p-0.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setViewMode("upi")}
                className={`px-3 py-1 rounded-sm transition-all flex items-center gap-1.5 ${
                  viewMode === "upi"
                    ? "bg-accent/20 text-accent font-bold border border-accent/30 shadow-sm"
                    : "text-dim hover:text-paper"
                }`}
              >
                <Zap size={12} className={viewMode === "upi" ? "text-accent animate-pulse" : ""} />
                Anomaly Monitor
              </button>
              {hasWebGL && (
                <button
                  type="button"
                  onClick={() => setViewMode("3d")}
                  className={`px-3 py-1 rounded-sm transition-all flex items-center gap-1.5 ${
                    viewMode === "3d"
                      ? "bg-accent/20 text-accent font-bold border border-accent/30 shadow-sm"
                      : "text-dim hover:text-paper"
                  }`}
                >
                  <Box size={12} className={viewMode === "3d" ? "text-accent animate-pulse" : ""} />
                  3D Evidence Field
                </button>
              )}
            </div>

            <ShimmerButton
              onClick={handleStreamToggle}
              variant={isStreamRunning ? "warning" : "primary"}
              size="sm"
            >
              {isStreamRunning ? <Pause size={12} /> : <Play size={12} />}
              {isStreamRunning ? "Pause Stream" : "Start Live Stream"}
            </ShimmerButton>
          </div>
        </div>

        {/* Telemetry Status Ribbon */}
        <div className="flex flex-wrap items-center gap-3 pt-2 text-2xs font-mono text-dim border-t border-line/40">
          <TacticalBadge level="NOMINAL" text="ISOLATION FOREST v1.0 ONLINE" pulse />
          <span className="text-line">|</span>
          <span className="border border-warn/30 bg-warn/[0.06] px-2 py-0.5 text-3xs text-warn font-mono flex items-center gap-1 rounded-sm">
            <AlertTriangle size={9} />
            SYNTHETIC DEMONSTRATION DATA
          </span>
          <span className="text-line">|</span>
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-dim" />
            <LiveClock />
          </div>
        </div>
      </header>

      {/* ── Main Risk Landscape Composition ────────────────────────── */}
      <DossierPanel
        eyebrow="Triage Landscape"
        title="Simulated Payment Rail Ingestion & Anomaly Density"
        badge={
          <span className="font-mono text-2xs text-dim">
            Engine: In-Memory Event Queue
          </span>
        }
        className="space-y-5"
      >
        {/* KPI Instrument Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono text-xs border-b border-line pb-5">
          <div className="p-3 bg-surface/50 border border-line rounded-sm space-y-1">
            <span className="text-3xs text-dim block uppercase">Transactions Ingested</span>
            <div className="text-2xl font-bold text-paper tabular">
              <NumberTicker value={upiData?.total_transactions || 0} />
            </div>
            <span className="text-3xs text-dim block">Simulated UPI flow</span>
          </div>

          <div className="p-3 bg-surface/50 border border-line rounded-sm space-y-1">
            <span className="text-3xs text-dim block uppercase">Total Volume Processed</span>
            <div className="text-2xl font-bold text-paper tabular">
              <NumberTicker
                value={upiData ? upiData.total_volume_processed : 0}
                prefix="₹"
                decimalPlaces={0}
              />
            </div>
            <span className="text-3xs text-dim block">INR Ledger Volume</span>
          </div>

          <div className="p-3 bg-surface/50 border border-line rounded-sm space-y-1">
            <span className="text-3xs text-warn block uppercase">Anomalies Detected</span>
            <div className="text-2xl font-bold text-warn tabular">
              <NumberTicker value={upiData?.anomalies_detected || 0} />
            </div>
            <span className="text-3xs text-dim block">Triage Score ≥ 25</span>
          </div>

          <div className="p-3 bg-surface/50 border border-line rounded-sm space-y-1">
            <span className="text-3xs text-accent block uppercase">Anomaly Ratio</span>
            <div className="text-2xl font-bold text-accent tabular">
              <NumberTicker
                value={upiData?.anomaly_rate_pct || 0}
                decimalPlaces={1}
                suffix="%"
              />
            </div>
            <span className="text-3xs text-dim block">Contamination index</span>
          </div>

          {/* Critical Risk Card with Laser Border */}
          <div className="p-3 bg-danger-dim/30 border border-danger/40 rounded-sm space-y-1 relative overflow-hidden">
            <BorderBeam colorFrom="#B9383A" colorTo="#D9A34C" duration={6} size={140} borderWidth={1.5} />
            <span className="text-3xs text-danger font-semibold block uppercase">
              Critical Risk Attention
            </span>
            <div className="text-2xl font-bold text-danger tabular">
              <NumberTicker value={upiData?.critical_risk_count || 0} />
            </div>
            <span className="text-3xs text-danger/80 block">Urgent human triage</span>
          </div>
        </div>

        {/* Triage Spectrum Distribution */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-2xs font-mono">
            <span className="text-dim uppercase tracking-wider">Calibrated Risk Triage Spectrum</span>
            <span className="text-dim">Score Distribution (0–100)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            {ORDER.map((level) => {
              const count = upiData?.risk_distribution?.[level] || 0;
              const total = upiData?.total_transactions || 1;
              const pct = Math.round((count / total) * 100);
              const color = riskColor(level);

              return (
                <div
                  key={level}
                  onClick={() => navigate(`/transactions?risk=${level}`)}
                  className="p-2.5 rounded-sm border border-line bg-surface/40 hover:bg-surface cursor-pointer transition-colors space-y-1.5"
                >
                  <div className="flex justify-between text-3xs">
                    <span style={{ color }} className="font-bold">{level}</span>
                    <span className="text-dim tabular">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-sm bg-bg overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DossierPanel>

      {viewMode === "3d" ? (
        /* ── 3D Evidence Universe Viewport ── */
        <section
          className="relative rounded-sm border border-line bg-panel overflow-hidden shadow-modal dossier-panel"
          style={{ height: 600 }}
          aria-label="3D Evidence Universe Viewport"
        >
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Skeleton className="h-12 w-48" />
              </div>
            }
          >
            <EvidenceUniverse3D
              advertisements={ads}
              relationships={relationships}
              clusters={[]}
              selectedNodeId={selectedNode?.id}
              onSelectNode={(node) => {
                setSelectedNode(node);
                setSelectedEdge(null);
              }}
              onSelectEdge={(edge) => {
                setSelectedEdge(edge);
                setSelectedNode(null);
              }}
            />
          </Suspense>

          <EvidenceDossierDrawer
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onClose={() => {
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
            onSelectRelatedAd={(adId) => {
              const found = ads.find((a) => a.id === adId);
              if (found) setSelectedNode(found);
            }}
          />
        </section>
      ) : (
        /* ── Real-Time UPI Intelligence Dashboard ── */
        <div className="space-y-6">
          {/* Active Risk Pattern Constellations Strip */}
          <DossierPanel
            eyebrow="Risk Constellations"
            title="Active UPI Pattern Archetypes & Disturbance Signatures"
            action={
              <Link
                to="/patterns"
                className="font-mono text-2xs text-accent hover:underline flex items-center gap-1"
              >
                View Pattern Catalog <ArrowRight size={11} />
              </Link>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {upiData?.active_patterns?.slice(0, 3).map((pat) => (
                <div
                  key={pat.pattern_id}
                  onClick={() => navigate(`/patterns`)}
                  className="p-3.5 bg-surface/50 border border-line rounded-sm hover:border-accent/40 hover:bg-surface transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-paper group-hover:text-accent transition-colors truncate">
                      {pat.name}
                    </span>
                    <TacticalBadge
                      level={
                        pat.severity_level === "CRITICAL"
                          ? "CRITICAL"
                          : pat.severity_level === "HIGH"
                          ? "HIGH"
                          : "MEDIUM"
                      }
                      text={pat.severity_level}
                    />
                  </div>
                  <p className="text-2xs text-dim line-clamp-2 leading-relaxed font-sans">
                    {pat.description}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-line/40 text-3xs font-mono">
                    <span className="text-dim">
                      Incidents: <strong className="text-paper">{pat.matched_count}</strong>
                    </span>
                    <span className="text-dim">
                      Vol: <strong className="text-paper">₹{pat.flagged_volume_inr.toLocaleString("en-IN")}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </DossierPanel>

          {/* Dual Panel: Recent High-Priority Capsules (Left) vs Attention Queue & Pulse (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Recent High-Risk Anomalies Table */}
            <DossierPanel
              eyebrow="Disturbance Stream"
              title="Recent High-Risk Transaction Capsules"
              className="lg:col-span-8"
              action={
                <Link
                  to="/transactions"
                  className="font-mono text-2xs text-accent hover:underline flex items-center gap-1"
                >
                  Open Monitor <ArrowRight size={11} />
                </Link>
              }
            >
              {upiData?.recent_anomalies && upiData.recent_anomalies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-line text-dim font-mono uppercase text-3xs tracking-wider">
                        <th className="py-2.5 px-3">Transaction ID</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Sender VPA</th>
                        <th className="py-2.5 px-3">Receiver VPA</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3 text-center">Score</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40 font-mono text-xs">
                      {upiData.recent_anomalies.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() =>
                            navigate(`/transactions/${encodeURIComponent(tx.transaction_id)}`)
                          }
                          className="cursor-pointer hover:bg-surface/60 transition-colors group"
                        >
                          <td className="py-2.5 px-3 text-paper font-medium group-hover:text-accent">
                            {tx.transaction_id}
                          </td>
                          <td className="py-2.5 px-3 uppercase text-3xs text-sub">
                            <span
                              className={`px-1.5 py-0.5 rounded-sm border ${
                                tx.transaction_type === "collect"
                                  ? "border-warn/30 bg-warn/10 text-warn"
                                  : "border-line bg-surface text-sub"
                              }`}
                            >
                              {tx.transaction_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-sub truncate max-w-[130px]">
                            {tx.sender_upi_handle}
                          </td>
                          <td className="py-2.5 px-3 text-sub truncate max-w-[130px]">
                            {tx.receiver_upi_handle}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-paper tabular">
                            ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <TacticalBadge
                              level={tx.risk_score >= 75 ? "CRITICAL" : "HIGH"}
                              text={String(tx.risk_score)}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-dim group-hover:text-accent text-3xs inline-flex items-center gap-1 transition-colors">
                              Inspect <ArrowRight size={11} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-xs font-mono text-dim">
                  No high-risk anomalies currently recorded. Run the stream simulator to generate activity.
                </div>
              )}
            </DossierPanel>

            {/* Right: Attention Queue Beacons & Live Evidence Pulse */}
            <div className="lg:col-span-4 space-y-6">
              {/* Attention Queue */}
              <DossierPanel
                eyebrow="Beacon Queue"
                title={`Attention Queue (${upiData?.recent_alerts?.length || 0})`}
                action={
                  <Link
                    to="/alerts"
                    className="font-mono text-2xs text-accent hover:underline"
                  >
                    View All →
                  </Link>
                }
              >
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {upiData?.recent_alerts && upiData.recent_alerts.length > 0 ? (
                    upiData.recent_alerts.slice(0, 4).map((al) => (
                      <div
                        key={al.id}
                        onClick={() => {
                          if (al.transaction_id) {
                            navigate(`/transactions/${encodeURIComponent(al.transaction_id)}`);
                          }
                        }}
                        className="p-2.5 bg-surface/50 border border-line rounded-sm hover:border-accent/40 hover:bg-surface cursor-pointer transition-colors text-xs space-y-1 group"
                      >
                        <div className="flex items-center justify-between font-mono text-3xs">
                          <span className="text-warn font-semibold group-hover:text-accent">
                            {al.alert_type}
                          </span>
                          <span className="text-dim">
                            {new Date(al.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-paper/90 text-3xs line-clamp-2 leading-relaxed">
                          {al.reason}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-3xs font-mono text-dim">
                      Attention queue clear.
                    </div>
                  )}
                </div>
              </DossierPanel>

              {/* Evidence Pulse Timeline */}
              <DossierPanel
                eyebrow="Activity Trail"
                title="Evidence Pulse Timeline"
              >
                <div className="space-y-3 font-mono text-2xs">
                  <div className="flex items-start gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-accent mt-1 shrink-0" />
                    <div>
                      <p className="text-paper font-semibold">Real-Time Ingestion Bus</p>
                      <p className="text-3xs text-dim">Simulating Indian digital payment transactions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-ok mt-1 shrink-0" />
                    <div>
                      <p className="text-paper font-semibold">Unsupervised Baseline</p>
                      <p className="text-3xs text-dim">180 synthetic samples calibrated via RobustScaler</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-warn mt-1 shrink-0" />
                    <div>
                      <p className="text-paper font-semibold">Hardware Rings Monitored</p>
                      <p className="text-3xs text-dim">Tracking cross-account terminal sharing</p>
                    </div>
                  </div>
                </div>
              </DossierPanel>
            </div>
          </div>
        </div>
      )}

      {/* Methodology notice */}
      <MethodologyNotice />
    </div>
  );
}
