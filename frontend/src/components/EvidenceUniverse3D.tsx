import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { useMemo, useState, useEffect, useRef } from "react";
import * as THREE from "three";
import {
  Focus,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  Network,
  Tag,
  Eye,
  EyeOff,
} from "lucide-react";
import type { AdvertisementSummary, Relationship } from "../types/api";
import { riskColor } from "../lib/format";

// ── Types ─────────────────────────────────────────────────────────────────
export interface UniversePoint {
  ad: AdvertisementSummary;
  position: [number, number, number];
  clusterIndex: number;
}

export interface EntityHubPoint {
  id: string;
  type: string;
  value: string;
  position: [number, number, number];
  connectedAdIds: string[];
}

interface Props {
  advertisements: AdvertisementSummary[];
  relationships: Relationship[];
  clusters?: { id: string; member_ids: string[]; max_risk_score: number }[];
  showSimilarity?: boolean;
  onSelectNode: (ad: AdvertisementSummary) => void;
  onSelectEdge: (rel: Relationship) => void;
  selectedNodeId?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function category(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

const RISK_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const RISK_COLORS: Record<string, string> = {
  LOW: "#3DAB6E",
  MEDIUM: "#D4923D",
  HIGH: "#C94040",
  CRITICAL: "#9E2B2B",
};

// ── 3D Node Mesh ──────────────────────────────────────────────────────────
function UniverseNode({
  point,
  selected,
  connected,
  focusMode,
  onSelect,
  relCount,
}: {
  point: UniversePoint;
  selected: boolean;
  connected: boolean;
  focusMode: boolean;
  onSelect: (ad: AdvertisementSummary) => void;
  relCount: number;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const cat = category(point.ad.risk_score);
  const color = riskColor(cat);
  const baseSize = 0.15 + Math.min(point.ad.related_count, 8) * 0.022;

  // Gentle pulse on selected node
  useFrame((state) => {
    if (selected && ringRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
      ringRef.current.scale.set(s, s, s);
    }
  });

  // Calculate opacity based on focus state
  let opacity = 1;
  if (focusMode) {
    opacity = selected || connected ? 1 : 0.07;
  } else {
    opacity = selected || connected ? 1 : 0.25;
  }

  const ringRadius = baseSize * 1.55;

  return (
    <group position={point.position}>
      {/* Outer Halo Target Ring when Selected */}
      {selected && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringRadius * 1.3, ringRadius * 1.5, 48]} />
          <meshBasicMaterial color="#4DB8D4" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Main Core Node */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(point.ad);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.3 : selected ? 1.18 : 1}
      >
        <sphereGeometry args={[baseSize, 28, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : hovered ? color : "#000000"}
          emissiveIntensity={selected ? 0.6 : hovered ? 0.4 : 0.05}
          roughness={0.2}
          metalness={0.4}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Risk Orbit Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringRadius, ringRadius * 1.15, 36]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 1 : hovered ? 0.9 : 0.35 * opacity}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Dynamic Point Light */}
      {(selected || hovered) && (
        <pointLight color={color} intensity={selected ? 2.5 : 1.4} distance={3.2} decay={2} />
      )}

      {/* Tactical Tooltip on Hover */}
      {(hovered || selected) && (
        <Html distanceFactor={9} center zIndexRange={[100, 0]}>
          <div className="border border-line bg-panel/95 shadow-2xl rounded p-3 backdrop-blur-md pointer-events-none select-none min-w-[210px] max-w-[250px]">
            <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-1.5 mb-1.5">
              <span className="evidence-mono text-3xs text-accent font-semibold tracking-wider">
                CASE {point.ad.id.slice(0, 8).toUpperCase()}
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-3xs font-mono font-bold"
                style={{
                  color,
                  background: color + "1a",
                  border: `1px solid ${color}4d`,
                }}
              >
                {cat} · {point.ad.risk_score}
              </span>
            </div>
            <p className="text-2xs text-paper/85 line-clamp-2 leading-relaxed font-sans mb-2">
              {point.ad.text || "No copy text recorded."}
            </p>
            <div className="flex items-center justify-between text-3xs text-dim font-mono border-t border-line/40 pt-1">
              <span>{point.ad.entity_count} entities</span>
              <span>{relCount} relationship{relCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Entity Hub Node (Satellite Identifier) ────────────────────────────────
function EntityHubNode({
  hub,
  active,
  onClick,
}: {
  hub: EntityHubPoint;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = hub.type === "shared_phone" ? "#4DB8D4" : hub.type === "shared_upi" ? "#D4923D" : "#8E75C4";

  return (
    <group position={hub.position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.3 : 1}
      >
        <octahedronGeometry args={[0.11, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 0.7 : hovered ? 0.5 : 0.25}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>

      {/* Orbit ring around entity hub */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.19, 24]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.9 : 0.4} side={THREE.DoubleSide} />
      </mesh>

      {hovered && (
        <Html distanceFactor={8} center zIndexRange={[100, 0]}>
          <div className="border border-line bg-panel/95 rounded px-2.5 py-1.5 shadow-xl backdrop-blur-md pointer-events-none font-mono text-3xs space-y-0.5 whitespace-nowrap">
            <span className="text-dim uppercase block">Shared {hub.type.replace("shared_", "")} Hub:</span>
            <span className="text-accent font-semibold block">{hub.value}</span>
            <span className="text-sub block text-4xs">Links {hub.connectedAdIds.length} advertisements</span>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Main Universe Component ───────────────────────────────────────────────
export function EvidenceUniverse3D({
  advertisements,
  relationships,
  clusters = [],
  showSimilarity = true,
  onSelectNode,
  onSelectEdge,
  selectedNodeId,
}: Props) {
  const [selected, setSelected] = useState<string | null>(selectedNodeId ?? null);
  const [focusMode, setFocusMode] = useState(false);
  const [showEntityHubs, setShowEntityHubs] = useState(true);
  const [internalSimilarity, setInternalSimilarity] = useState(showSimilarity);
  const [selectedClusterIdx, setSelectedClusterIdx] = useState<number | null>(null);

  const [riskFilter, setRiskFilter] = useState<Record<string, boolean>>({
    CRITICAL: true,
    HIGH: true,
    MEDIUM: true,
    LOW: true,
  });

  const [cameraDistance, setCameraDistance] = useState(8.5);
  const [cameraVersion, setCameraVersion] = useState(0);

  // Reduced motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (selectedNodeId !== undefined) {
      setSelected(selectedNodeId);
      if (selectedNodeId) setFocusMode(true);
    }
  }, [selectedNodeId]);

  // Map advertisements to cluster constellations
  const clusterMemberMap = useMemo(() => {
    const map = new Map<string, number>();
    clusters.forEach((c, idx) => {
      c.member_ids.forEach((id) => map.set(id, idx));
    });
    return map;
  }, [clusters]);

  // Spatial Constellation layout algorithm
  const points = useMemo<UniversePoint[]>(() => {
    // Generate cluster centroids in 3D space
    const clusterCount = Math.max(clusters.length, 1);
    const clusterCentroids: [number, number, number][] = [];
    for (let c = 0; c < clusterCount; c++) {
      const angle = (c / clusterCount) * Math.PI * 2;
      const dist = 3.6 + (c % 2) * 1.0;
      clusterCentroids.push([
        Math.cos(angle) * dist,
        ((c % 3) - 1) * 1.1,
        Math.sin(angle) * dist,
      ]);
    }

    const clusterMemberCounts = new Map<number, number>();

    return advertisements.map((ad, i) => {
      const clusterIdx = clusterMemberMap.get(ad.id) ?? (i % clusterCount);
      const centroid = clusterCentroids[clusterIdx] || [0, 0, 0];
      const memberNum = clusterMemberCounts.get(clusterIdx) ?? 0;
      clusterMemberCounts.set(clusterIdx, memberNum + 1);

      // Distribute nodes in an orbit shell around their cluster centroid
      const phi = (memberNum * 137.5 * Math.PI) / 180; // Golden angle
      const r = 0.9 + Math.sqrt(memberNum) * 0.45;
      const x = centroid[0] + r * Math.cos(phi);
      const y = centroid[1] + ((memberNum % 4) - 1.5) * 0.55;
      const z = centroid[2] + r * Math.sin(phi);

      return {
        ad,
        position: [x, y, z],
        clusterIndex: clusterIdx,
      };
    });
  }, [advertisements, clusters, clusterMemberMap]);

  const byId = useMemo(() => new Map(points.map((p) => [p.ad.id, p])), [points]);

  // Filter visible nodes by risk and active cluster
  const visiblePoints = useMemo(() => {
    return points.filter((p) => {
      const cat = category(p.ad.risk_score);
      if (!riskFilter[cat]) return false;
      if (selectedClusterIdx !== null && p.clusterIndex !== selectedClusterIdx) return false;
      return true;
    });
  }, [points, riskFilter, selectedClusterIdx]);

  const visibleIds = useMemo(() => new Set(visiblePoints.map((p) => p.ad.id)), [visiblePoints]);

  // Filter visible relationship edges
  const visibleRels = useMemo(() => {
    return relationships.filter((r) => {
      if (!internalSimilarity && r.relationship_type === "text_similarity") return false;
      return visibleIds.has(r.source_ad_id) && visibleIds.has(r.target_ad_id);
    });
  }, [relationships, internalSimilarity, visibleIds]);

  // Compute connected nodes for focus mode
  const connectedNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    visibleRels.forEach((r) => {
      if (r.source_ad_id === selected) set.add(r.target_ad_id);
      if (r.target_ad_id === selected) set.add(r.source_ad_id);
    });
    return set;
  }, [selected, visibleRels]);

  // Relationship counts per node
  const relCountById = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of visibleRels) {
      counts[r.source_ad_id] = (counts[r.source_ad_id] ?? 0) + 1;
      counts[r.target_ad_id] = (counts[r.target_ad_id] ?? 0) + 1;
    }
    return counts;
  }, [visibleRels]);

  // Compute Entity Hubs (shared phone/UPI hubs with degree >= 2)
  const entityHubs = useMemo<EntityHubPoint[]>(() => {
    if (!showEntityHubs) return [];
    const evidenceGroups = new Map<string, { type: string; adIds: Set<string> }>();

    relationships.forEach((r) => {
      if (r.relationship_type !== "text_similarity" && r.evidence) {
        const key = `${r.relationship_type}::${r.evidence}`;
        if (!evidenceGroups.has(key)) {
          evidenceGroups.set(key, { type: r.relationship_type, adIds: new Set() });
        }
        evidenceGroups.get(key)!.adIds.add(r.source_ad_id);
        evidenceGroups.get(key)!.adIds.add(r.target_ad_id);
      }
    });

    const hubs: EntityHubPoint[] = [];
    evidenceGroups.forEach((group, key) => {
      const validAds = Array.from(group.adIds).filter((id) => byId.has(id));
      if (validAds.length >= 2) {
        // Position hub at the centroid of connected ads
        let cx = 0, cy = 0, cz = 0;
        validAds.forEach((id) => {
          const pos = byId.get(id)!.position;
          cx += pos[0];
          cy += pos[1];
          cz += pos[2];
        });
        const n = validAds.length;
        hubs.push({
          id: key,
          type: group.type,
          value: key.split("::")[1],
          position: [cx / n, (cy / n) + 0.25, cz / n],
          connectedAdIds: validAds,
        });
      }
    });
    return hubs.slice(0, 30); // Bound for smooth performance
  }, [relationships, byId, showEntityHubs]);

  function resetView() {
    setSelected(null);
    setFocusMode(false);
    setSelectedClusterIdx(null);
    setCameraDistance(8.5);
    setCameraVersion((v) => v + 1);
  }

  function zoom(delta: number) {
    setCameraDistance((v) => Math.min(14, Math.max(3.2, v + delta)));
    setCameraVersion((v) => v + 1);
  }

  return (
    <div
      className="relative w-full h-full min-h-[580px] bg-[#070b12] overflow-hidden select-none"
      role="region"
      aria-label="Interactive 3D Evidence Universe"
    >
      {/* ── Top Floating Command Bar ───────────────────────────────── */}
      <div className="absolute left-3 top-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
        {/* Left cluster filter chips */}
        <div className="flex items-center gap-1.5 p-1 rounded-md border border-line/80 bg-panel/90 backdrop-blur-md shadow-xl pointer-events-auto">
          <button
            type="button"
            onClick={() => setSelectedClusterIdx(null)}
            className={`px-2.5 py-1 text-2xs font-mono rounded transition-all ${
              selectedClusterIdx === null
                ? "bg-accent/20 border border-accent/40 text-accent font-bold"
                : "text-sub hover:text-paper"
            }`}
          >
            All Constellations ({clusters.length})
          </button>
          {clusters.slice(0, 5).map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedClusterIdx(i)}
              className={`px-2 py-1 text-2xs font-mono rounded transition-all flex items-center gap-1.5 ${
                selectedClusterIdx === i
                  ? "bg-accent/20 border border-accent/40 text-accent font-bold"
                  : "text-dim hover:text-sub border border-transparent"
              }`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: riskColor(category(c.max_risk_score)) }}
              />
              Cluster {i + 1}
            </button>
          ))}
        </div>

        {/* Right HUD status indicator */}
        <div className="flex items-center gap-2 p-1.5 rounded-md border border-line/80 bg-panel/90 backdrop-blur-md shadow-xl pointer-events-auto font-mono text-3xs text-dim">
          <span className="flex items-center gap-1 text-accent font-semibold">
            <Network size={11} />
            {visiblePoints.length} Cases
          </span>
          <span>·</span>
          <span>{visibleRels.length} Threads</span>
          {selected && (
            <>
              <span>·</span>
              <span className="text-ok font-semibold">Focus Active</span>
            </>
          )}
        </div>
      </div>

      {/* ── Left Floating Tool Tray ─────────────────────────────────── */}
      <div className="absolute left-3 top-16 z-10 flex flex-col gap-2 pointer-events-auto">
        {/* Risk Level Toggles */}
        <div className="rounded-md border border-line/80 bg-panel/92 backdrop-blur-md p-1.5 flex flex-col gap-1 shadow-xl">
          {RISK_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setRiskFilter((f) => ({ ...f, [level]: !f[level] }))}
              aria-pressed={riskFilter[level]}
              className="flex items-center gap-2 rounded px-2.5 py-1 text-3xs font-mono font-semibold transition-all"
              style={{
                color: riskFilter[level] ? RISK_COLORS[level] : "var(--c-dim)",
                background: riskFilter[level] ? RISK_COLORS[level] + "1a" : "transparent",
                border: `1px solid ${riskFilter[level] ? RISK_COLORS[level] + "4d" : "transparent"}`,
                opacity: riskFilter[level] ? 1 : 0.45,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: RISK_COLORS[level] }}
              />
              {level}
            </button>
          ))}
        </div>

        {/* Layer Toggles & Camera Controls */}
        <div className="rounded-md border border-line/80 bg-panel/92 backdrop-blur-md p-1 flex flex-col gap-1 shadow-xl w-fit">
          <button
            type="button"
            onClick={() => setInternalSimilarity((v) => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              internalSimilarity ? "text-warn bg-warn/15" : "text-dim hover:text-sub"
            }`}
            title={internalSimilarity ? "Hide text similarity threads" : "Show text similarity threads"}
          >
            {internalSimilarity ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            type="button"
            onClick={() => setShowEntityHubs((v) => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              showEntityHubs ? "text-accent bg-accent/15" : "text-dim hover:text-sub"
            }`}
            title={showEntityHubs ? "Hide shared entity hub satellites" : "Show shared entity hub satellites"}
          >
            <Tag size={13} />
          </button>
          <span className="h-px w-full bg-line/80 my-0.5" />
          <button
            type="button"
            onClick={() => zoom(-1)}
            className="flex h-7 w-7 items-center justify-center rounded text-sub hover:text-paper hover:bg-surface transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            onClick={() => zoom(1)}
            className="flex h-7 w-7 items-center justify-center rounded text-sub hover:text-paper hover:bg-surface transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (selected) setFocusMode((v) => !v);
            }}
            disabled={!selected}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              focusMode && selected ? "text-accent bg-accent/20" : "text-dim"
            }`}
            title="Focus connected evidence"
          >
            <Focus size={13} />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="flex h-7 w-7 items-center justify-center rounded text-sub hover:text-paper hover:bg-surface transition-colors"
            title="Reset universe orientation"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* ── Three.js Canvas ─────────────────────────────────────────── */}
      <Canvas
        key={`${cameraDistance}-${cameraVersion}`}
        camera={{ position: [0, 4.0, cameraDistance], fov: 48 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={["#060a10"]} />
        <ambientLight intensity={0.6} />
        <pointLight position={[0, 0, 0]} intensity={0.5} color="#4DB8D4" distance={9} decay={2} />
        <directionalLight position={[8, 12, 8]} intensity={0.5} />
        <directionalLight position={[-8, -6, -8]} intensity={0.2} color="#1A2433" />

        {/* Deep Spatial Dust / Stardust Field */}
        <Stars radius={45} depth={30} count={1200} factor={3.5} saturation={0.8} fade speed={0.5} />

        {/* Ground Reference Grid */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]}>
          <ringGeometry args={[1.5, 7.5, 48]} />
          <meshBasicMaterial color="#131C2B" transparent opacity={0.25} wireframe />
        </mesh>

        {/* Relationship Evidence Threads */}
        {visibleRels.map((rel) => {
          const a = byId.get(rel.source_ad_id);
          const b = byId.get(rel.target_ad_id);
          if (!a || !b) return null;
          const isSimilarity = rel.relationship_type === "text_similarity";

          let edgeOpacity = 0.75;
          if (focusMode && selected) {
            const active = rel.source_ad_id === selected || rel.target_ad_id === selected;
            edgeOpacity = active ? 0.95 : 0.04;
          } else if (selected) {
            const active = rel.source_ad_id === selected || rel.target_ad_id === selected;
            edgeOpacity = active ? 0.9 : 0.12;
          }

          return (
            <Line
              key={rel.id}
              points={[a.position, b.position]}
              color={isSimilarity ? "#D4923D" : "#4DB8D4"}
              transparent
              opacity={edgeOpacity}
              lineWidth={isSimilarity ? 1.0 : 1.7}
              dashed={isSimilarity}
              dashSize={0.16}
              gapSize={0.1}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(rel);
              }}
            />
          );
        })}

        {/* Entity Hub Satellites & connector spokes */}
        {entityHubs.map((hub) => {
          const isHubActive = selected ? hub.connectedAdIds.includes(selected) : false;
          return (
            <group key={hub.id}>
              <EntityHubNode
                hub={hub}
                active={isHubActive}
                onClick={() => {
                  // Focus first connected ad
                  const firstAdId = hub.connectedAdIds[0];
                  if (firstAdId && byId.has(firstAdId)) {
                    setSelected(firstAdId);
                    onSelectNode(byId.get(firstAdId)!.ad);
                  }
                }}
              />
              {/* Spokes from hub to connected nodes */}
              {hub.connectedAdIds.map((adId) => {
                const node = byId.get(adId);
                if (!node) return null;
                return (
                  <Line
                    key={`${hub.id}-${adId}`}
                    points={[hub.position, node.position]}
                    color="#4DB8D4"
                    transparent
                    opacity={isHubActive ? 0.6 : 0.1}
                    lineWidth={0.8}
                    dashed
                    dashSize={0.08}
                    gapSize={0.08}
                  />
                );
              })}
            </group>
          );
        })}

        {/* Advertisement Constellation Nodes */}
        {visiblePoints.map((point) => (
          <UniverseNode
            key={point.ad.id}
            point={point}
            selected={point.ad.id === selected}
            connected={connectedNodeIds.has(point.ad.id)}
            focusMode={focusMode}
            relCount={relCountById[point.ad.id] ?? 0}
            onSelect={(ad) => {
              setSelected(ad.id);
              onSelectNode(ad);
            }}
          />
        ))}

        <OrbitControls
          enablePan
          enableZoom
          minDistance={2.8}
          maxDistance={16}
          autoRotate={false}
          enableDamping={!prefersReducedMotion}
          dampingFactor={0.05}
        />
      </Canvas>

      {/* ── Accessible Keyboard Fallback Index ────────────────────── */}
      <details className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-2rem)] rounded border border-line bg-panel/95 text-xs text-sub backdrop-blur-md">
        <summary className="cursor-pointer px-3 py-1.5 text-accent select-none font-mono text-2xs flex items-center gap-1.5">
          <Layers size={11} /> Accessible Case Index ({visiblePoints.length} nodes)
        </summary>
        <div className="max-h-44 overflow-auto border-t border-line p-1.5 space-y-1">
          {visiblePoints.map((p) => (
            <button
              key={p.ad.id}
              type="button"
              onClick={() => {
                setSelected(p.ad.id);
                onSelectNode(p.ad);
              }}
              className="w-full px-2 py-1 text-left hover:bg-surface focus-visible:bg-surface rounded text-2xs flex items-center justify-between gap-2"
            >
              <span
                className="evidence-mono text-3xs font-semibold"
                style={{ color: riskColor(category(p.ad.risk_score)) }}
              >
                {p.ad.risk_score} [{category(p.ad.risk_score)}]
              </span>
              <span className="truncate flex-1 text-paper/85">{p.ad.text || "Untitled"}</span>
              <span className="text-3xs text-dim font-mono">{p.ad.id.slice(0, 6)}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
