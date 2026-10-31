import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  MarkerType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ExternalLink,
  Eye,
  EyeOff,
  GitFork,
  Info,
  Layers,
  Network,
  Share2,
  Shield,
  Box,
} from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { RiskScore } from "../components/RiskGauge";
import { Skeleton } from "../components/Skeleton";
import { useAsync } from "../hooks/useAsync";
import { relationshipLabel, riskColor } from "../lib/format";
import { api } from "../services/api";
import type {
  AdvertisementSummary,
  CampaignDetail,
  Relationship,
} from "../types/api";

const EvidenceField3D = lazy(() =>
  import("../components/EvidenceField3D").then((module) => ({
    default: module.EvidenceField3D,
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

function riskCat(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function buildGraph(
  campaign: CampaignDetail,
  showSimilarity: boolean,
  nodeBg: string,
  nodeText: string
): { nodes: Node[]; edges: Edge[] } {
  const count = campaign.advertisements.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const spacing = 240;

  const nodes: Node[] = campaign.advertisements.map((ad, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const cat = riskCat(ad.risk_score);
    const color = riskColor(cat);

    return {
      id: ad.id,
      position: { x: col * spacing, y: row * spacing },
      data: { label: `${cat} · ${ad.risk_score}`, ad },
      style: {
        background: nodeBg,
        border: `1.5px solid ${color}66`,
        borderRadius: "6px",
        padding: "8px 12px",
        color: nodeText,
        fontSize: "11px",
        fontFamily: "DM Mono, monospace",
        fontWeight: 500,
        minWidth: "120px",
        textAlign: "center" as const,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });

  const edges: Edge[] = [];
  const seen = new Set<string>();

  for (const rel of campaign.relationships) {
    const isSimilarity = rel.relationship_type === "text_similarity";
    if (isSimilarity && !showSimilarity) continue;

    const key = [rel.source_ad_id, rel.target_ad_id].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({
      id: rel.id,
      source: rel.source_ad_id,
      target: rel.target_ad_id,
      type: "default",
      animated: isSimilarity,
      style: {
        stroke: isSimilarity ? "#D4923D" : "#4DB8D4",
        strokeWidth: isSimilarity ? 1.2 : 1.8,
        opacity: 0.75,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isSimilarity ? "#D4923D" : "#4DB8D4",
        width: 10,
        height: 10,
      },
      data: { rel },
    });
  }

  return { nodes, edges };
}

type InspectorData =
  | { kind: "node"; ad: AdvertisementSummary }
  | { kind: "edge"; rel: Relationship };

export function CampaignsPage() {
  const { campaignId } = useParams();
  const { theme } = useTheme();
  const { data: campaigns, error, loading, reload } = useAsync(
    () => api.campaigns(),
    []
  );

  const [selectedId, setSelectedId] = useState<string | null>(campaignId ?? null);
  const [showSimilarity, setShowSimilarity] = useState(false);
  const [inspector, setInspector] = useState<InspectorData | null>(null);
  const [webgl] = useState(() => supportsWebGL());
  const [viewMode, setViewMode] = useState<"3d" | "2d">(webgl ? "3d" : "2d");

  const { data: detail, loading: detailLoading } = useAsync(
    () => (selectedId ? api.campaign(selectedId) : Promise.resolve(null)),
    [selectedId]
  );

  useEffect(() => {
    if (campaigns?.length && !selectedId) setSelectedId(campaigns[0].id);
  }, [campaigns, selectedId]);

  const nodeBg =
    getComputedStyle(document.documentElement).getPropertyValue("--c-panel").trim() ||
    "#0E1219";
  const nodeText =
    getComputedStyle(document.documentElement).getPropertyValue("--c-paper").trim() ||
    "#DFE3EA";
  const rfDot =
    getComputedStyle(document.documentElement).getPropertyValue("--rf-dot").trim() ||
    "#1E2535";

  const { nodes: initNodes, edges: initEdges } = useMemo(() => {
    if (!detail) return { nodes: [], edges: [] };
    return buildGraph(detail, showSimilarity, nodeBg, nodeText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, showSimilarity, theme]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    setNodes(initNodes);
    setEdges(initEdges);
  }, [initNodes, initEdges, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    setInspector({ kind: "node", ad: node.data.ad as AdvertisementSummary });
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_e, edge) => {
    if (edge.data?.rel)
      setInspector({ kind: "edge", rel: edge.data.rel as Relationship });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-52" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
        <Skeleton className="h-[520px]" />
      </div>
    );
  }
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!campaigns) return null;

  if (campaigns.length === 0) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="border-b border-line pb-4">
          <p className="eyebrow flex items-center gap-1.5">
            <Network size={10} /> Forensic Graph
          </p>
          <h1 className="display-face text-2xl text-paper">Campaign Intelligence</h1>
          <p className="text-2xs text-sub mt-1">
            Clusters are derived strictly from observable shared identifiers and conservative text similarity.
          </p>
        </div>
        <EmptyState
          title="No coordinated campaign clusters found"
          body="Clusters appear when the deterministic engine detects shared contact handles, account identifiers, or similar text across multiple advertisements. Submit advertisements to build relationship evidence."
          icon={<GitFork size={20} />}
        />
      </div>
    );
  }

  const selectedCampaign = campaigns.find((c) => c.id === selectedId);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="border-b border-line pb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <Network size={10} /> Coordinated Network Analysis
          </p>
          <h1 className="display-face text-2xl text-paper tracking-wide">
            Campaign Intelligence
          </h1>
          <p className="text-2xs text-sub mt-1 max-w-xl leading-relaxed">
            Connected graph components derived from stored forensic evidence. Edges require
            verified shared contact identifiers or conservative text similarity.
          </p>
        </div>

        {selectedCampaign && (
          <div className="flex items-center gap-3 text-2xs font-mono bg-panel border border-line rounded px-3 py-1.5">
            <span className="text-dim">Active Cluster:</span>
            <span className="text-accent font-semibold">
              {selectedCampaign.member_count} ads
            </span>
            <span className="text-dim">·</span>
            <span className="text-paper">
              Max Risk:{" "}
              <strong style={{ color: riskColor(riskCat(selectedCampaign.max_risk_score)) }}>
                {selectedCampaign.max_risk_score}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* ── Cluster Selector Bar ───────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Select campaign cluster"
      >
        {campaigns.map((c, i) => {
          const isSelected = selectedId === c.id;
          const maxRiskColor = riskColor(riskCat(c.max_risk_score));
          return (
            <button
              key={c.id}
              role="tab"
              type="button"
              aria-selected={isSelected}
              onClick={() => {
                setSelectedId(c.id);
                setInspector(null);
              }}
              className={`rounded border px-3.5 py-2 text-xs font-medium transition-all text-left flex items-center gap-2.5 ${
                isSelected
                  ? "border-accent/50 bg-accent/[0.08] text-paper shadow-sm"
                  : "border-line bg-panel/70 text-sub hover:bg-surface hover:text-paper"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: maxRiskColor }}
                aria-hidden="true"
              />
              <span className="font-semibold">Cluster {i + 1}</span>
              <span className="text-3xs font-mono opacity-70">
                {c.member_count} ads · max {c.max_risk_score}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Main Graph Canvas + Inspector ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr,300px]">
        {/* Graph Panel */}
        <div className="rounded border border-line bg-panel overflow-hidden dossier-panel flex flex-col">
          {/* Canvas Toolbar */}
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5 bg-surface/40">
            {/* Visual Legend */}
            <div className="flex items-center gap-4 text-2xs text-sub">
              <span className="flex items-center gap-1.5 font-mono">
                <span className="h-0.5 w-4 bg-[#4DB8D4] inline-block rounded" />
                <span className="text-paper">Shared Identifier</span>
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <span
                  className="h-0.5 w-4 inline-block border-t-2 border-dashed border-[#D4923D]"
                  style={{ height: 1 }}
                />
                <span className="text-paper">Text Similarity</span>
              </span>
            </div>

            {/* View Mode & Filter Toggles */}
            <div className="flex items-center gap-2">
              {webgl && (
                <div className="flex items-center rounded border border-line bg-surface p-0.5 text-3xs font-mono">
                  <button
                    type="button"
                    onClick={() => setViewMode("3d")}
                    className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                      viewMode === "3d"
                        ? "bg-accent/20 text-accent font-semibold"
                        : "text-dim hover:text-sub"
                    }`}
                  >
                    <Box size={10} /> 3D Field
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("2d")}
                    className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                      viewMode === "2d"
                        ? "bg-accent/20 text-accent font-semibold"
                        : "text-dim hover:text-sub"
                    }`}
                  >
                    <Layers size={10} /> 2D Map
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowSimilarity((v) => !v)}
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-2xs font-medium transition-colors ${
                  showSimilarity
                    ? "border-warn/40 bg-warn/10 text-warn"
                    : "border-line text-sub hover:bg-surface hover:text-paper"
                }`}
                aria-pressed={showSimilarity}
              >
                {showSimilarity ? (
                  <>
                    <EyeOff size={11} aria-hidden="true" /> Hide similarity traces
                  </>
                ) : (
                  <>
                    <Eye size={11} aria-hidden="true" /> Show similarity traces
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Canvas Viewport */}
          <div style={{ height: 530 }} aria-label="Relationship graph" role="img" className="relative">
            {detailLoading ? (
              <div className="flex h-full items-center justify-center">
                <Skeleton className="h-10 w-44" />
              </div>
            ) : detail && webgl && viewMode === "3d" ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <Skeleton className="h-10 w-44" />
                  </div>
                }
              >
                <EvidenceField3D
                  advertisements={detail.advertisements}
                  relationships={detail.relationships}
                  showSimilarity={showSimilarity}
                  onSelect={(ad) => setInspector({ kind: "node", ad })}
                  onEdgeSelect={(rel) => setInspector({ kind: "edge", rel })}
                />
              </Suspense>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                fitView
                fitViewOptions={{ padding: 0.35 }}
                proOptions={{ hideAttribution: true }}
                minZoom={0.25}
                maxZoom={2}
              >
                <Background gap={22} size={1} color={rfDot} />
                <Controls showInteractive={false} />
              </ReactFlow>
            )}
          </div>
        </div>

        {/* ── Evidence Inspector Panel ─────────────────────────────────── */}
        <div
          className="rounded border border-line bg-panel p-4 dossier-panel flex flex-col justify-between"
          aria-label="Evidence inspector"
          aria-live="polite"
        >
          <div>
            <div className="flex items-center justify-between border-b border-line pb-2.5 mb-3.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-paper flex items-center gap-1.5">
                <Shield size={12} className="text-accent" />
                Evidence Inspector
              </h3>
              <span className="text-3xs font-mono text-dim">
                {viewMode === "3d" ? "Spatial Node" : "Topology Edge"}
              </span>
            </div>

            {!inspector ? (
              <div className="flex flex-col items-center justify-center gap-2.5 py-14 text-center">
                <div className="h-10 w-10 rounded-full border border-line bg-surface/60 flex items-center justify-center text-dim">
                  <Info size={16} />
                </div>
                <p className="text-xs text-paper font-medium">Select Graph Entity</p>
                <p className="text-2xs text-sub max-w-[220px] leading-relaxed">
                  Click any advertisement node to view case dossier, or click a trace line
                  to review relationship evidence.
                </p>
              </div>
            ) : inspector.kind === "node" ? (
              <div className="space-y-4 animate-fade-in">
                {/* Risk score block */}
                <RiskScore
                  score={inspector.ad.risk_score}
                  category={inspector.ad.risk_category}
                  variant="block"
                />

                {/* Case ID */}
                <div className="bg-surface/60 border border-line/60 rounded p-2 text-2xs space-y-0.5">
                  <span className="text-3xs font-mono uppercase text-dim block">
                    Case Identifier
                  </span>
                  <span className="evidence-mono text-accent font-semibold">
                    {inspector.ad.id.toUpperCase()}
                  </span>
                </div>

                {/* Advertisement text snippet */}
                <div>
                  <p className="text-3xs font-semibold uppercase tracking-[0.08em] text-sub mb-1">
                    Observed Copy Excerpt
                  </p>
                  <p className="text-xs leading-relaxed text-paper/80 bg-surface/50 border border-line/60 rounded p-2.5 line-clamp-5 font-sans">
                    {inspector.ad.text || "No copy text recorded"}
                  </p>
                </div>

                {/* Entity & status counters */}
                <div className="flex items-center justify-between text-2xs border-t border-line/60 pt-2 font-mono">
                  <span className="text-sub">Extracted Entities:</span>
                  <span className="text-paper font-semibold">
                    {inspector.ad.entity_count}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 animate-fade-in">
                {/* Relationship type */}
                <div>
                  <p className="text-3xs font-semibold uppercase tracking-[0.08em] text-sub mb-1">
                    Relationship Link
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        inspector.rel.relationship_type === "text_similarity"
                          ? "bg-warn"
                          : "bg-accent"
                      }`}
                    />
                    <p className="text-sm text-paper font-semibold">
                      {relationshipLabel(inspector.rel.relationship_type)}
                    </p>
                  </div>
                </div>

                {inspector.rel.explanation && (
                  <div>
                    <p className="text-3xs font-semibold uppercase tracking-[0.08em] text-sub mb-1">
                      Signal Explanation
                    </p>
                    <p className="text-2xs text-paper/85 leading-relaxed bg-surface/50 border border-line/60 rounded p-2.5">
                      {inspector.rel.explanation}
                    </p>
                  </div>
                )}

                {inspector.rel.evidence && (
                  <div>
                    <p className="text-3xs font-semibold uppercase tracking-[0.08em] text-sub mb-1">
                      Shared Observable Value
                    </p>
                    <div className="font-mono text-2xs text-accent bg-bg rounded px-3 py-2 border border-line break-all">
                      {inspector.rel.evidence}
                    </div>
                  </div>
                )}

                {inspector.rel.similarity_score != null && (
                  <div>
                    <p className="text-3xs font-semibold uppercase tracking-[0.08em] text-sub mb-1">
                      Computed Text Overlap
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
                        <div
                          className="h-full rounded-full bg-warn"
                          style={{
                            width: `${Math.round(inspector.rel.similarity_score * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono font-semibold text-warn">
                        {(inspector.rel.similarity_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-3xs text-dim block mt-0.5">
                      Conservative heuristic estimate; not a guarantee of joint authorship.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Inspector Footer Link */}
          {inspector && inspector.kind === "node" && (
            <div className="pt-3 border-t border-line mt-4">
              <Link
                to={`/investigations/${inspector.ad.id}`}
                className="w-full flex items-center justify-center gap-1.5 rounded bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent/90 transition-colors"
                aria-label="Open full investigation case dossier"
              >
                Open Full Case Dossier <ExternalLink size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Accessible Text Summary ─────────────────────────────────── */}
      {selectedCampaign && (
        <details className="rounded border border-line bg-panel text-xs">
          <summary className="cursor-pointer px-4 py-2.5 text-sub hover:text-paper transition-colors select-none font-mono text-2xs flex items-center gap-2">
            <Share2 size={12} className="text-accent" />
            Text summary of selected campaign cluster ({selectedCampaign.member_count} nodes)
          </summary>
          <div className="border-t border-line px-4 py-3 text-sub space-y-1.5 text-2xs leading-relaxed">
            <p>
              Cluster contains <strong className="text-paper">{selectedCampaign.member_count}</strong>{" "}
              advertisements linked by deterministic shared phone numbers, payment accounts, URLs, or text similarity.
            </p>
            <p>
              Peak triage score within cluster:{" "}
              <strong className="text-paper font-mono">{selectedCampaign.max_risk_score}</strong>.
            </p>
            <p className="text-dim">
              Note: Shared identifiers alone do not prove common criminal control. Legitimate brands and platforms may share infrastructure or standard templates.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
