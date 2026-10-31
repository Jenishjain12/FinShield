import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { useMemo, useState, useEffect } from "react";
import { Focus, RotateCcw, ZoomIn, ZoomOut, Layers } from "lucide-react";
import type { AdvertisementSummary, Relationship } from "../types/api";
import { riskColor } from "../lib/format";

// ── Types ─────────────────────────────────────────────────────────────────
type Point = { ad: AdvertisementSummary; position: [number, number, number] };

interface Props {
  advertisements: AdvertisementSummary[];
  relationships: Relationship[];
  showSimilarity: boolean;
  onSelect: (ad: AdvertisementSummary) => void;
  onEdgeSelect: (rel: Relationship) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function category(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const RISK_DOT_COLORS: Record<string, string> = {
  LOW: "#3DAB6E",
  MEDIUM: "#D4923D",
  HIGH: "#C94040",
  CRITICAL: "#9E2B2B",
};

// ── PointNode ─────────────────────────────────────────────────────────────
function PointNode({
  point,
  selected,
  connected,
  focusMode,
  onSelect,
  relCount,
}: {
  point: Point;
  selected: boolean;
  connected: boolean;
  focusMode: boolean;
  onSelect: (ad: AdvertisementSummary) => void;
  relCount: number;
}) {
  const [hovered, setHovered] = useState(false);
  const color = riskColor(category(point.ad.risk_score));
  const size = 0.14 + Math.min(point.ad.related_count, 6) * 0.024;

  // Opacity logic
  let opacity = 1;
  if (focusMode) {
    opacity = selected || connected ? 1 : 0.08;
  } else {
    opacity = selected || connected ? 1 : 0.22;
  }

  const ringOpacity = selected ? 1 : hovered ? 0.9 : 0.35 * opacity;
  const ringInner = selected ? size * 1.5 : size * 1.35;
  const ringOuter = selected ? size * 1.8 : size * 1.55;

  return (
    <group position={point.position}>
      {/* Outer focus halo if selected */}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 2.0, size * 2.2, 48]} />
          <meshBasicMaterial color="#4DB8D4" transparent opacity={0.7} />
        </mesh>
      )}

      {/* Core sphere */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(point.ad);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.25 : selected ? 1.15 : 1}
      >
        <sphereGeometry args={[size, 28, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : hovered ? color : "#000000"}
          emissiveIntensity={selected ? 0.4 : hovered ? 0.25 : 0}
          transparent
          opacity={opacity}
          roughness={0.25}
          metalness={0.35}
        />
      </mesh>

      {/* Orbit ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringInner, ringOuter, 40]} />
        <meshBasicMaterial color={color} transparent opacity={ringOpacity} />
      </mesh>

      {/* Localized point light */}
      {(selected || hovered) && (
        <pointLight color={color} intensity={selected ? 2.0 : 1.2} distance={2.5} decay={2} />
      )}

      {/* Tooltip */}
      {(hovered || selected) && (
        <Html distanceFactor={8.5} center zIndexRange={[100, 0]}>
          <div
            style={{ minWidth: 220, maxWidth: 260 }}
            className="border border-line bg-panel/95 shadow-modal rounded p-3 backdrop-blur-md pointer-events-none select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-line/60">
              <span className="evidence-mono text-3xs text-accent font-semibold tracking-widest">
                CASE {point.ad.id.slice(0, 8).toUpperCase()}
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-3xs font-mono font-bold"
                style={{
                  color: color,
                  background: color + "1a",
                  border: `1px solid ${color}44`,
                }}
              >
                {category(point.ad.risk_score)} · {point.ad.risk_score}
              </span>
            </div>
            {/* Text excerpt */}
            <p className="text-2xs leading-relaxed text-paper/85 line-clamp-2 mb-2 font-sans">
              {point.ad.text || "No copy text recorded"}
            </p>
            {/* Footer stats */}
            <div className="flex items-center justify-between text-3xs text-sub font-mono pt-1 border-t border-line/40">
              <span>{point.ad.entity_count} entities</span>
              <span>{relCount} link{relCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Ambient scene light ───────────────────────────────────────────────────
function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.65} />
      <pointLight position={[0, 0, 0]} intensity={0.45} color="#4db8d4" distance={8} decay={2} />
      <directionalLight position={[6, 9, 6]} intensity={0.55} />
      <directionalLight position={[-6, -4, -6]} intensity={0.2} color="#1E2535" />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function EvidenceField3D({
  advertisements,
  relationships,
  showSimilarity,
  onSelect,
  onEdgeSelect,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [riskFilter, setRiskFilter] = useState<Record<string, boolean>>({
    LOW: true,
    MEDIUM: true,
    HIGH: true,
    CRITICAL: true,
  });
  const [cameraDistance, setCameraDistance] = useState(7.2);
  const [cameraVersion, setCameraVersion] = useState(0);

  // Check reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const visibleAds = advertisements.filter((ad) => riskFilter[category(ad.risk_score)]);

  const points = useMemo<Point[]>(
    () =>
      visibleAds.map((ad, i) => {
        const count = Math.max(1, visibleAds.length);
        const angle = (i / count) * Math.PI * 2;
        const layer = i % 3;
        const radius = 2.4 + (i % 2) * 0.5;
        return {
          ad,
          position: [
            Math.cos(angle) * radius,
            (layer - 1) * 0.85,
            Math.sin(angle) * radius,
          ],
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleAds.map((a) => a.id).join(",")]
  );

  const byId = new Map(points.map((p) => [p.ad.id, p]));

  const visible = relationships.filter(
    (r) =>
      (showSimilarity || r.relationship_type !== "text_similarity") &&
      byId.has(r.source_ad_id) &&
      byId.has(r.target_ad_id)
  );

  // Connected set
  const connected = new Set(
    visible
      .filter((r) => !selected || r.source_ad_id === selected || r.target_ad_id === selected)
      .flatMap((r) => [r.source_ad_id, r.target_ad_id])
  );

  // Relationship count per node
  const relCountById = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of visible) {
      counts[r.source_ad_id] = (counts[r.source_ad_id] ?? 0) + 1;
      counts[r.target_ad_id] = (counts[r.target_ad_id] ?? 0) + 1;
    }
    return counts;
  }, [visible]);

  function resetView() {
    setSelected(null);
    setFocusMode(false);
    setCameraDistance(7.2);
    setCameraVersion((v) => v + 1);
  }

  function zoom(delta: number) {
    setCameraDistance((v) => Math.min(13, Math.max(3.2, v + delta)));
    setCameraVersion((v) => v + 1);
  }

  function toggleFocus() {
    if (!selected) return;
    setFocusMode((v) => !v);
  }

  return (
    <div
      className="trace-bg relative h-full min-h-[520px] select-none"
      role="region"
      aria-label="Interactive 3D evidence field"
    >
      {/* ── Controls overlay ───────────────────────────────────────────── */}
      <div
        className="absolute left-3 top-3 z-10 flex flex-col gap-2 pointer-events-auto"
        aria-label="Evidence field controls"
      >
        {/* Risk filter panel */}
        <div className="rounded border border-line bg-panel/92 backdrop-blur-md p-1.5 flex flex-wrap gap-1 shadow-lg">
          {RISK_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() =>
                setRiskFilter((f) => ({ ...f, [level]: !f[level] }))
              }
              aria-pressed={riskFilter[level]}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-2xs font-semibold transition-all"
              style={{
                color: riskFilter[level] ? RISK_DOT_COLORS[level] : "var(--c-dim)",
                background: riskFilter[level] ? RISK_DOT_COLORS[level] + "1a" : "transparent",
                border: `1px solid ${riskFilter[level] ? RISK_DOT_COLORS[level] + "4d" : "transparent"}`,
                opacity: riskFilter[level] ? 1 : 0.5,
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{ background: RISK_DOT_COLORS[level] }}
                aria-hidden="true"
              />
              {level}
            </button>
          ))}
        </div>

        {/* Action button toolbar */}
        <div className="rounded border border-line bg-panel/92 backdrop-blur-md p-1 flex items-center gap-1 shadow-lg w-fit">
          <button
            type="button"
            onClick={() => zoom(-1)}
            className="flex h-7 w-7 items-center justify-center rounded text-sub hover:text-paper hover:bg-surface transition-colors"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            onClick={() => zoom(1)}
            className="flex h-7 w-7 items-center justify-center rounded text-sub hover:text-paper hover:bg-surface transition-colors"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="w-px h-4 bg-line" aria-hidden="true" />
          <button
            type="button"
            onClick={toggleFocus}
            disabled={!selected}
            className="flex h-7 w-7 items-center justify-center rounded transition-colors"
            aria-label="Focus connected evidence"
            title={selected ? "Focus connected evidence" : "Select a node to focus"}
            aria-pressed={focusMode}
            style={{
              color: focusMode ? "#4db8d4" : "var(--c-sub)",
              background: focusMode ? "#4db8d424" : "transparent",
              opacity: selected ? 1 : 0.4,
              cursor: selected ? "pointer" : "not-allowed",
            }}
          >
            <Focus size={13} />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="flex h-7 w-7 items-center justify-center rounded text-sub hover:text-paper hover:bg-surface transition-colors"
            aria-label="Reset orientation"
            title="Reset orientation"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* ── Top-right hint indicator ────────────────────────────────────── */}
      <div className="absolute right-3 top-3 z-10 pointer-events-none hidden sm:flex items-center gap-2 rounded border border-line/60 bg-panel/80 px-2.5 py-1 text-3xs font-mono text-dim backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse_subtle" />
        <span>Rotate: Drag · Pan: Shift+Drag · Zoom: Scroll</span>
      </div>

      {/* ── Three.js Canvas ────────────────────────────────────────────── */}
      <Canvas
        key={`${cameraDistance}-${cameraVersion}`}
        camera={{ position: [0, 3.2, cameraDistance], fov: 46 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={["#080d14"]} />
        <SceneLights />

        {/* Coordinate ring ground grid */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
          <ringGeometry args={[1.5, 4.2, 32]} />
          <meshBasicMaterial color="#1a2332" transparent opacity={0.15} wireframe />
        </mesh>

        {/* Relationship Edges */}
        {visible.map((rel) => {
          const a = byId.get(rel.source_ad_id);
          const b = byId.get(rel.target_ad_id);
          if (!a || !b) return null;
          const isSimilarity = rel.relationship_type === "text_similarity";

          let edgeOpacity: number;
          if (focusMode) {
            const active = rel.source_ad_id === selected || rel.target_ad_id === selected;
            edgeOpacity = active ? 0.88 : 0.05;
          } else {
            const active = !selected || rel.source_ad_id === selected || rel.target_ad_id === selected;
            edgeOpacity = active ? 0.75 : 0.1;
          }

          return (
            <Line
              key={rel.id}
              points={[a.position, b.position]}
              color={isSimilarity ? "#d4923d" : "#4db8d4"}
              transparent
              opacity={edgeOpacity}
              lineWidth={isSimilarity ? 1.0 : 1.6}
              dashed={isSimilarity}
              dashSize={0.15}
              gapSize={0.1}
              onClick={(e) => {
                e.stopPropagation();
                onEdgeSelect(rel);
              }}
            />
          );
        })}

        {/* Nodes */}
        {points.map((point) => (
          <PointNode
            key={point.ad.id}
            point={point}
            selected={point.ad.id === selected}
            connected={connected.has(point.ad.id)}
            focusMode={focusMode}
            relCount={relCountById[point.ad.id] ?? 0}
            onSelect={(ad) => {
              setSelected(ad.id);
              onSelect(ad);
            }}
          />
        ))}

        <OrbitControls
          enablePan
          enableZoom
          minDistance={3.0}
          maxDistance={14}
          autoRotate={false}
          enableDamping={!prefersReducedMotion}
          dampingFactor={0.06}
        />
      </Canvas>

      {/* ── Accessible Keyboard Fallback Index ──────────────────────────── */}
      <details className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded border border-line bg-panel/95 text-xs text-sub backdrop-blur-sm">
        <summary className="cursor-pointer px-3 py-1.5 text-accent select-none font-mono text-2xs flex items-center gap-1.5">
          <Layers size={11} /> Accessible Case Index ({visibleAds.length})
        </summary>
        <div
          className="max-h-44 overflow-auto border-t border-line p-1.5 space-y-1"
          aria-label="Select advertisement record without 3D canvas"
        >
          {visibleAds.map((ad) => (
            <button
              key={ad.id}
              type="button"
              onClick={() => {
                setSelected(ad.id);
                onSelect(ad);
              }}
              className="w-full px-2 py-1 text-left hover:bg-surface focus-visible:bg-surface rounded text-2xs flex items-center justify-between gap-2"
            >
              <span
                className="evidence-mono text-3xs font-semibold"
                style={{ color: riskColor(category(ad.risk_score)) }}
              >
                {ad.risk_score} [{category(ad.risk_score)}]
              </span>
              <span className="truncate flex-1 text-paper/80 font-sans">{ad.text || "Untitled"}</span>
              <span className="text-3xs text-dim font-mono">{ad.id.slice(0, 6)}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

export function supportsWebGL(): boolean {
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
