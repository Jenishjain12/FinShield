import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Shield,
  Sliders,
  Sparkles,
  X,
  XCircle,
  Radar,
  Activity,
} from "lucide-react";
import { api, API_BASE_URL } from "../services/api";
import type {
  DiscoveryCandidate,
  DiscoveryRun,
  DiscoveryRunDetail,
  DiscoverySSEEvent,
  CandidateAnalysis,
  SourceInfo,
} from "../types/api";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/Skeleton";
import { ErrorBanner } from "../components/ErrorBanner";
import { riskClass } from "../lib/format";

const BASE = API_BASE_URL;

// ── Status helpers ────────────────────────────────────────────────────────

function runStatusLabel(status: string) {
  switch (status) {
    case "pending":     return "Pending";
    case "searching":   return "Searching…";
    case "processing":  return "Processing…";
    case "completed":   return "Completed";
    case "failed":      return "Failed";
    case "cancelled":   return "Cancelled";
    default:            return status;
  }
}

function runStatusColor(status: string) {
  switch (status) {
    case "completed":  return "text-ok";
    case "failed":     return "text-danger";
    case "searching":
    case "processing": return "text-accent";
    default:           return "text-sub";
  }
}

function runStatusDot(status: string) {
  switch (status) {
    case "completed":  return "bg-ok";
    case "failed":     return "bg-danger";
    case "searching":
    case "processing": return "bg-accent animate-pulse_subtle";
    default:           return "bg-dim";
  }
}

function candidateStatusIcon(status: string) {
  switch (status) {
    case "analyzed":  return <CheckCircle2 size={14} className="text-ok" />;
    case "captured":  return <ImageIcon size={14} className="text-accent" />;
    case "failed":    return <XCircle size={14} className="text-danger" />;
    case "skipped":   return <XCircle size={14} className="text-dim" />;
    case "duplicate": return <RefreshCw size={14} className="text-warn" />;
    default:          return <Clock size={14} className="text-sub" />;
  }
}

function sseLineClass(eventType: string) {
  switch (eventType) {
    case "candidate_found": return "text-accent font-semibold";
    case "error":           return "text-danger";
    case "done":            return "text-ok";
    case "source_status":   return "text-warn";
    default:                return "text-sub";
  }
}

function sseLinePrefix(eventType: string) {
  switch (eventType) {
    case "candidate_found": return "►";
    case "error":           return "✖";
    case "done":            return "✔";
    case "source_status":   return "◆";
    default:                return "·";
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────

export function DiscoveryPage() {
  const [query, setQuery] = useState("");
  const [maxCandidates, setMaxCandidates] = useState(5);
  const [minRiskThreshold, setMinRiskThreshold] = useState(0);
  const [selectedSources, setSelectedSources] = useState<string[]>(["web", "synthetic_testbed"]);
  const [availableSources, setAvailableSources] = useState<SourceInfo[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [activeRun, setActiveRun] = useState<DiscoveryRun | null>(null);
  const [runDetail, setRunDetail] = useState<DiscoveryRunDetail | null>(null);
  const [sseMessages, setSseMessages] = useState<DiscoverySSEEvent[]>([]);

  const [pastRuns, setPastRuns] = useState<DiscoveryRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadSources = useCallback(async () => {
    try {
      const sources = await api.discoverySources();
      setAvailableSources(sources);
    } catch { /* ignore */ }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const runs = await api.discoveryRuns();
      setPastRuns(runs);
      const active = runs.find((r) =>
        ["pending", "searching", "processing"].includes(r.status)
      );
      if (active && !activeRun) {
        setActiveRun(active);
        connectSSE(active.id);
      }
    } catch { /* ignore */ }
    finally { setLoadingRuns(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadSources();
    loadRuns();
    return () => { eventSourceRef.current?.close(); };
  }, [loadSources, loadRuns]);

  function connectSSE(runId: string) {
    eventSourceRef.current?.close();
    const es = new EventSource(`${BASE}/api/discovery/runs/${runId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as DiscoverySSEEvent;
        setSseMessages((prev) => [...prev, data]);
        requestAnimationFrame(() => {
          logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
        });
        if (data.event_type === "done" || data.status === "completed" || data.status === "failed") {
          es.close();
          api.discoveryRun(runId).then((detail) => {
            setRunDetail(detail);
            setActiveRun((prev) => prev ? {
              ...prev,
              status: detail.status,
              candidates_found: detail.candidates_found,
              candidates_analyzed: detail.candidates_analyzed,
            } : null);
          });
          loadRuns();
        } else {
          setActiveRun((prev) => prev ? {
            ...prev,
            status: data.status || prev.status,
            progress_message: data.message,
            candidates_found: data.candidates_found ?? prev.candidates_found,
            candidates_analyzed: data.candidates_analyzed ?? prev.candidates_analyzed,
          } : null);
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
      api.discoveryRun(runId).then((detail) => {
        setRunDetail(detail);
        setActiveRun((prev) => prev ? { ...prev, status: detail.status } : null);
      }).catch(() => {});
    };
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || selectedSources.length === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSseMessages([]);
    setRunDetail(null);
    try {
      const sourcesParam = selectedSources.join(",");
      const run = await api.startDiscovery(query.trim(), sourcesParam, maxCandidates, minRiskThreshold);
      setActiveRun(run);
      connectSSE(run.id);
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to start discovery run.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleSource(sourceId: string) {
    setSelectedSources((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]
    );
  }

  async function viewRun(runId: string) {
    try {
      const detail = await api.discoveryRun(runId);
      setRunDetail(detail);
      setActiveRun(detail);
      setSseMessages([]);
    } catch { /* ignore */ }
  }

  function getAnalysis(candidateId: string): CandidateAnalysis | undefined {
    return runDetail?.candidate_analyses?.find((a) => a.candidate_id === candidateId);
  }

  const isActive = activeRun && ["pending", "searching", "processing"].includes(activeRun.status);

  const candidatesToDisplay = runDetail?.candidates.filter((c) => {
    if (minRiskThreshold <= 0) return true;
    const ad = getAnalysis(c.id)?.advertisement;
    return !ad || ad.risk_score >= minRiskThreshold;
  }) ?? [];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="border-b border-line pb-4">
        <p className="eyebrow mb-1.5 flex items-center gap-1.5">
          <Radar size={10} />
          Autonomous Intelligence
        </p>
        <h1 className="display-face text-2xl text-paper">Discovery Operations</h1>
        <p className="mt-1.5 text-xs text-sub max-w-xl leading-relaxed">
          Configure a transparent discovery run. Source status, candidate capture, analysis, and
          relationship checks remain visible as a full audit trail.
        </p>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div className="flex gap-6 items-start flex-col xl:flex-row">

        {/* ════════════════════ LEFT — Configuration Form ════════════════════ */}
        <div className="xl:w-[45%] shrink-0 w-full">
          <form onSubmit={handleStart} className="rounded border border-line bg-panel overflow-hidden">

            {/* Form header */}
            <div className="flex items-center gap-2 border-b border-line px-5 py-3 bg-surface/40">
              <div className="flex h-7 w-7 items-center justify-center rounded border border-accent/40 bg-accent/10 text-accent shrink-0">
                <Bot size={14} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-paper">Configure Discovery Run</h2>
                <p className="text-2xs text-sub mt-0.5">Set objective, choose adapters, and prioritize by risk.</p>
              </div>
              <span className="ml-auto text-2xs font-mono text-dim shrink-0 hidden sm:block">Playwright · Headless</span>
            </div>

            <div className="p-5 space-y-5">

              {/* Query input */}
              <div>
                <label htmlFor="discovery-query" className="block text-2xs font-medium uppercase tracking-[0.08em] text-sub mb-1.5">
                  Search Objective / Financial Promotion Topic
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                  <input
                    id="discovery-query"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='e.g. "guaranteed 30% monthly returns double money India"'
                    className="w-full rounded border border-line bg-surface pl-9 pr-3 py-2 text-sm text-paper
                               placeholder:text-dim focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
                    disabled={!!isActive}
                    maxLength={500}
                  />
                </div>
              </div>

              {/* Source Selection Adapters */}
              <div>
                <label className="block text-2xs font-medium uppercase tracking-[0.08em] text-sub mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Layers size={12} className="text-accent" />
                    Supported Source Adapters
                  </span>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableSources.length === 0 ? (
                    <div className="col-span-full text-2xs text-dim">Loading sources…</div>
                  ) : (
                    availableSources.map((source) => {
                      const isChecked = selectedSources.includes(source.source_id);
                      const isAvailable = source.status === "available";
                      return (
                        <button
                          key={source.source_id}
                          type="button"
                          disabled={!!isActive}
                          onClick={() => {
                            if (!isAvailable) {
                              setSubmitError(`${source.name} requires platform credentials. ${source.notes}`);
                              return;
                            }
                            setSubmitError(null);
                            toggleSource(source.source_id);
                          }}
                          className={`text-left rounded border p-2.5 transition-all ${
                            isChecked
                              ? "border-accent/50 bg-accent/[0.08]"
                              : isAvailable
                              ? "border-line bg-surface/50 hover:border-line-hover"
                              : "border-line/60 bg-surface/30 opacity-60 cursor-pointer"
                          } ${isActive ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-paper flex items-center gap-1.5">
                              {source.source_id === "synthetic_testbed" ? (
                                <Sparkles size={12} className="text-accent" />
                              ) : (
                                <Globe size={12} className="text-sub" />
                              )}
                              {source.name}
                            </span>
                            {isAvailable ? (
                              <span className="inline-flex items-center rounded-full bg-ok/10 px-1.5 py-0.5 text-3xs font-medium text-ok">
                                Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-warn/10 px-1.5 py-0.5 text-3xs font-medium text-warn">
                                <KeyRound size={8} /> Auth Required
                              </span>
                            )}
                          </div>
                          <p className="text-3xs text-dim line-clamp-2 leading-relaxed">
                            {isAvailable ? source.description : source.notes}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Limits and Thresholds */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="max-candidates" className="block text-2xs font-medium uppercase tracking-[0.08em] text-sub mb-1.5">
                    Max Candidates
                  </label>
                  <select
                    id="max-candidates"
                    value={maxCandidates}
                    onChange={(e) => setMaxCandidates(Number(e.target.value))}
                    className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-paper
                               focus:outline-none focus:border-accent/50"
                    disabled={!!isActive}
                  >
                    {[1, 2, 3, 5, 10, 15, 20].map((n) => (
                      <option key={n} value={n}>{n} candidate{n !== 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="min-risk" className="block text-2xs font-medium uppercase tracking-[0.08em] text-sub mb-1.5">
                    <span className="flex items-center gap-1">
                      <Sliders size={11} className="text-accent" />
                      Risk Threshold
                    </span>
                  </label>
                  <select
                    id="min-risk"
                    value={minRiskThreshold}
                    onChange={(e) => setMinRiskThreshold(Number(e.target.value))}
                    className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-paper
                               focus:outline-none focus:border-accent/50"
                    disabled={!!isActive}
                  >
                    <option value={0}>All candidates (0+)</option>
                    <option value={25}>Medium risk and above (25+)</option>
                    <option value={50}>High risk and above (50+)</option>
                    <option value={75}>Critical priority only (75+)</option>
                  </select>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!!isActive || isSubmitting || !query.trim() || selectedSources.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-sm font-medium text-white
                           hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                {isActive ? "Discovery in progress…" : "Start discovery run"}
              </button>

              {submitError && <ErrorBanner message={submitError} />}

              {/* Security notice */}
              <div className="flex items-start gap-2 pt-1 border-t border-line/60">
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warn/80" />
                <p className="text-2xs text-dim leading-relaxed">
                  <strong>Security &amp; Compliance:</strong> Browsing strictly enforces SSRF protection, loopback/private-IP blocking, and DNS pre-resolution.
                  Webpage content is treated strictly as data. The agent respects platform access controls and does not bypass CAPTCHAs or authentication walls.
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* ════════════════════ RIGHT — Results / Audit Trail ════════════════════ */}
        <div className="xl:flex-1 w-full space-y-4">

          {/* ── Active Run Live Progress ─────────────────────────────── */}
          {activeRun && (
            <div className="rounded border border-line bg-panel overflow-hidden">
              {/* Run header */}
              <div className="flex items-center justify-between border-b border-line px-5 py-3 bg-surface/40">
                <div className="flex items-center gap-3 min-w-0">
                  {isActive ? (
                    <Loader2 size={16} className="animate-spin text-accent shrink-0" />
                  ) : activeRun.status === "completed" ? (
                    <CheckCircle2 size={16} className="text-ok shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-danger shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-paper flex items-center gap-2 flex-wrap">
                      <span className="truncate">{activeRun.query}</span>
                      <span className="text-2xs font-normal text-dim font-mono shrink-0">[{activeRun.sources}]</span>
                    </p>
                    <p className="text-2xs text-sub mt-0.5">
                      <span className={runStatusColor(activeRun.status)}>{runStatusLabel(activeRun.status)}</span>
                      {" · "}
                      {activeRun.candidates_found} captured
                      {" · "}
                      {activeRun.candidates_analyzed} analyzed
                    </p>
                  </div>
                </div>
                {!isActive && (
                  <button
                    type="button"
                    onClick={() => { setActiveRun(null); setRunDetail(null); setSseMessages([]); }}
                    className="text-2xs text-dim hover:text-sub transition-colors shrink-0 ml-2"
                  >
                    Dismiss
                  </button>
                )}
              </div>

              {/* Live Audit Log */}
              {sseMessages.length > 0 && (
                <div className="border-b border-line">
                  <div className="flex items-center gap-2 px-5 py-2 bg-bg/60 border-b border-line/60">
                    <Activity size={11} className="text-dim" />
                    <span className="text-3xs font-semibold uppercase tracking-[0.1em] text-dim">Live Audit Log</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse_subtle" />
                    )}
                    <span className="ml-auto text-3xs text-dim font-mono">{sseMessages.length} events</span>
                  </div>
                  <div
                    ref={logRef}
                    className="max-h-52 overflow-y-auto bg-bg px-5 py-3 space-y-0.5 font-mono text-2xs"
                  >
                    {sseMessages.map((msg, i) => (
                      <div key={i} className="flex items-start gap-2.5 py-0.5">
                        <span className="shrink-0 text-dim tabular-nums select-none w-7 text-right">
                          {String(i + 1).padStart(3, "0")}
                        </span>
                        <span className="shrink-0 text-dim w-3">{sseLinePrefix(msg.event_type)}</span>
                        <span className={sseLineClass(msg.event_type)}>{msg.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discovered Candidates Grid */}
              {runDetail && candidatesToDisplay.length > 0 && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-sub">
                      Discovered Candidates ({candidatesToDisplay.length})
                    </h3>
                    {minRiskThreshold > 0 && (
                      <span className="text-2xs text-accent">
                        Filtered: risk ≥ {minRiskThreshold}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {candidatesToDisplay.map((candidate) => (
                      <CandidateCard
                        key={candidate.id}
                        candidate={candidate}
                        analysis={getAnalysis(candidate.id)}
                        onOpenPreview={(filename) => setPreviewImage(filename)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Discovery History ────────────────────────────────────── */}
          <div className="rounded border border-line bg-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-sub" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-paper">Discovery History</h2>
              </div>
              <button
                type="button"
                onClick={loadRuns}
                className="text-2xs text-dim hover:text-sub transition-colors flex items-center gap-1"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            {loadingRuns ? (
              <div className="p-5 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : pastRuns.length === 0 ? (
              <div className="p-8 text-center">
                <Globe size={28} className="mx-auto text-dim mb-3" />
                <p className="text-sm text-sub">No discovery runs recorded</p>
                <p className="text-2xs text-dim mt-1">
                  Launch the autonomous agent to search public web sources.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {pastRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => viewRun(run.id)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-3
                               hover:bg-surface/50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${runStatusDot(run.status)}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-paper truncate group-hover:text-accent transition-colors">
                          {run.query}
                        </p>
                        <p className="text-2xs text-dim mt-0.5 font-mono">
                          {new Date(run.created_at).toLocaleString()}
                          {" · "}
                          <span className="text-sub">{run.sources}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-2xs text-sub font-mono tabular-nums">
                        {run.candidates_found}↓ {run.candidates_analyzed}✔
                      </span>
                      <span className={`text-2xs font-medium ${runStatusColor(run.status)}`}>
                        {runStatusLabel(run.status)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Image Preview Modal ─────────────────────────────────────── */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-surface rounded border border-line overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/90 transition-colors"
            >
              <X size={18} />
            </button>
            <img
              src={`${BASE}/uploads/${previewImage}`}
              alt="High resolution captured screenshot evidence"
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Candidate Card ───────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  analysis,
  onOpenPreview,
}: {
  candidate: DiscoveryCandidate;
  analysis?: CandidateAnalysis;
  onOpenPreview: (filename: string) => void;
}) {
  const ad = analysis?.advertisement;
  const relationships = ad?.relationships ?? [];

  return (
    <div className="rounded border border-line bg-surface overflow-hidden flex flex-col justify-between">
      <div>
        {/* Screenshot preview */}
        {candidate.screenshot_filename ? (
          <div className="relative border-b border-line bg-bg group">
            <img
              src={`${BASE}/uploads/${candidate.screenshot_filename}`}
              alt={`Screenshot evidence for ${candidate.page_title || candidate.source_url}`}
              className="w-full h-44 object-cover object-top"
              loading="lazy"
            />
            <button
              type="button"
              onClick={() => onOpenPreview(candidate.screenshot_filename!)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium gap-1.5 backdrop-blur-sm"
            >
              <Eye size={14} /> Enlarge screenshot
            </button>
            <div className="absolute top-2 right-2 flex gap-1.5">
              {candidate.source_type && (
                <span className="rounded bg-black/60 backdrop-blur px-1.5 py-0.5 text-3xs font-mono text-white/90 uppercase">
                  {candidate.source_type}
                </span>
              )}
              {ad && (
                <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-2xs font-semibold ${riskClass(ad.risk_category)}`}>
                  <Shield size={11} />
                  Risk: {ad.risk_score}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="h-24 bg-bg border-b border-line flex items-center justify-center text-dim text-xs">
            <ImageIcon size={18} className="mr-1.5" /> No screenshot available
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* Title and source link */}
          <div>
            <p className="text-sm font-semibold text-paper truncate" title={candidate.page_title || "Untitled"}>
              {candidate.page_title || "Discovered Promotion Page"}
            </p>
            <a
              href={candidate.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-accent hover:underline mt-0.5 truncate max-w-full"
            >
              <ExternalLink size={10} className="shrink-0" />
              <span className="truncate">{candidate.source_url}</span>
            </a>
          </div>

          {/* Selection reason */}
          <div className="rounded bg-bg/80 border border-line p-2 text-2xs text-sub leading-relaxed">
            <span className="text-dim font-medium uppercase tracking-wider text-3xs block mb-0.5">Selection Reason</span>
            {candidate.selection_reason}
          </div>

          {/* Relevance score */}
          <div className="flex items-center gap-2">
            <span className="text-2xs text-sub">Relevance:</span>
            <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.round(candidate.ad_relevance_score * 100)}%` }}
              />
            </div>
            <span className="text-2xs font-mono text-sub">{Math.round(candidate.ad_relevance_score * 100)}%</span>
          </div>

          {/* Pipeline Status Badges */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1 rounded bg-panel border border-line px-2 py-0.5 text-3xs text-sub">
              {candidateStatusIcon(candidate.status)}
              Capture: {candidate.status}
            </span>
            {ad && (
              <>
                <span className="inline-flex items-center gap-1 rounded bg-panel border border-line px-2 py-0.5 text-3xs text-sub">
                  <FileText size={10} className="text-accent" />
                  OCR: {ad.ocr_status}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-panel border border-line px-2 py-0.5 text-3xs text-sub">
                  <Shield size={10} className="text-ok" />
                  Pipeline: Analyzed
                </span>
              </>
            )}
          </div>

          {/* Risk analysis */}
          {ad && (
            <div className="border-t border-line pt-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-semibold uppercase tracking-wider text-sub">Risk Assessment</span>
                <StatusBadge value={ad.risk_category} />
              </div>

              {ad.signals.length > 0 && (
                <div className="space-y-1">
                  {ad.signals.slice(0, 3).map((s) => (
                    <div key={s.id} className="rounded bg-panel/70 border border-line p-1.5 text-2xs space-y-0.5">
                      <div className="flex items-center justify-between text-paper font-medium">
                        <span className="flex items-center gap-1">
                          <AlertTriangle size={11} className="text-warn shrink-0" />
                          {s.title}
                        </span>
                        <span className="text-3xs text-dim">+{s.contribution}</span>
                      </div>
                      <p className="text-3xs text-dim leading-snug">{s.explanation}</p>
                    </div>
                  ))}
                  {ad.signals.length > 3 && (
                    <p className="text-3xs text-sub">+{ad.signals.length - 3} additional risk indicator(s)</p>
                  )}
                </div>
              )}

              {ad.entities.length > 0 && (
                <div className="text-2xs">
                  <span className="text-dim text-3xs block mb-1">Observable Identifiers:</span>
                  <div className="flex flex-wrap gap-1">
                    {ad.entities.slice(0, 4).map((ent) => (
                      <span key={ent.id} className="rounded border border-line bg-surface px-1.5 py-0.5 text-3xs font-mono text-paper">
                        {ent.entity_type}: {ent.normalized_value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {relationships.length > 0 && (
                <div className="rounded border border-accent/30 bg-accent/[0.05] p-2 text-2xs space-y-1">
                  <span className="font-semibold text-accent flex items-center gap-1">
                    <Link2 size={11} /> Coordinated Campaign Anomaly:
                  </span>
                  <p className="text-3xs text-sub">
                    Linked to {relationships.length} other advertisement(s) via shared contact or text similarity.
                  </p>
                </div>
              )}

              {ad.ocr_text && (
                <details className="text-2xs">
                  <summary className="text-sub cursor-pointer hover:text-paper transition-colors py-0.5">
                    View extracted copy ({ad.ocr_text.length} chars)
                  </summary>
                  <p className="mt-1 rounded bg-bg border border-line p-2 text-dim font-mono whitespace-pre-wrap max-h-24 overflow-y-auto text-3xs">
                    {ad.ocr_text}
                  </p>
                </details>
              )}
            </div>
          )}

          {candidate.error_message && (
            <p className="text-2xs text-danger">{candidate.error_message}</p>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="border-t border-line px-4 py-2.5 bg-panel/50 flex items-center justify-between">
        <span className="text-3xs text-dim font-mono">
          {candidate.captured_at ? new Date(candidate.captured_at).toLocaleTimeString() : ""}
        </span>
        {ad ? (
          <Link
            to={`/investigations/${ad.id}`}
            className="inline-flex items-center gap-1 text-2xs font-medium text-accent hover:underline"
          >
            Open Investigation →
          </Link>
        ) : (
          <span className="text-3xs text-dim">Analysis pending</span>
        )}
      </div>
    </div>
  );
}
