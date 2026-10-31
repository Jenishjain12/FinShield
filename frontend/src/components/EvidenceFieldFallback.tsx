import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { riskColor } from "../lib/format";
import type { AdvertisementSummary, Relationship } from "../types/api";

interface EvidenceFieldFallbackProps {
  advertisements: AdvertisementSummary[];
  relationships: Relationship[];
  selectedNodeId?: string | null;
  onSelectNode?: (ad: AdvertisementSummary) => void;
  onSelectEdge?: (edge: Relationship) => void;
}

export function EvidenceFieldFallback({
  advertisements,
  relationships,
  selectedNodeId,
  onSelectNode,
  onSelectEdge,
}: EvidenceFieldFallbackProps) {
  // Convert advertisements to ReactFlow Nodes
  const nodes: Node[] = useMemo(() => {
    const count = advertisements.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const spacing = 220;

    return advertisements.map((ad, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const cat = ad.risk_score >= 75 ? "CRITICAL" : ad.risk_score >= 50 ? "HIGH" : ad.risk_score >= 25 ? "MEDIUM" : "LOW";
      const color = riskColor(cat);
      const isSelected = selectedNodeId === ad.id;

      return {
        id: ad.id,
        position: { x: col * spacing + 40, y: row * spacing + 40 },
        data: {
          label: (
            <div className="space-y-0.5">
              <div className="font-mono text-3xs font-bold" style={{ color }}>
                {cat} · {ad.risk_score}
              </div>
              <div className="text-3xs text-sub truncate max-w-[120px]">
                {ad.source || "Intake Capsule"}
              </div>
            </div>
          ),
          ad,
        },
        style: {
          background: "var(--c-panel)",
          border: `1.5px solid ${isSelected ? "var(--signal-cyan)" : `${color}66`}`,
          borderRadius: "4px",
          padding: "6px 10px",
          color: "var(--c-paper)",
          fontFamily: "DM Mono, monospace",
          minWidth: "120px",
          boxShadow: isSelected ? "0 0 12px rgba(88,199,217,0.3)" : "var(--shadow-panel)",
          cursor: "pointer",
        },
      };
    });
  }, [advertisements, selectedNodeId]);

  // Convert relationships to ReactFlow Edges
  const edges: Edge[] = useMemo(() => {
    return relationships.map((rel) => {
      const isShared = rel.relationship_type.includes("shared") || rel.relationship_type.includes("direct");
      const edgeColor = isShared ? "#58C7D9" : "#D9A34C";

      return {
        id: `${rel.source_ad_id}-${rel.target_ad_id}`,
        source: rel.source_ad_id,
        target: rel.target_ad_id,
        animated: !isShared,
        label: rel.relationship_type.replaceAll("_", " "),
        style: {
          stroke: edgeColor,
          strokeWidth: isShared ? 2 : 1.5,
          strokeDasharray: isShared ? undefined : "5 5",
        },
        labelStyle: {
          fill: edgeColor,
          fontFamily: "DM Mono, monospace",
          fontSize: 9,
          fontWeight: 600,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 14,
          height: 14,
        },
        data: { rel },
      };
    });
  }, [relationships]);

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        onNodeClick={(_, node) => {
          if (node.data?.ad && onSelectNode) {
            onSelectNode(node.data.ad as AdvertisementSummary);
          }
        }}
        onEdgeClick={(_, edge) => {
          if (edge.data?.rel && onSelectEdge) {
            onSelectEdge(edge.data.rel as Relationship);
          }
        }}
        minZoom={0.2}
        maxZoom={2.5}
      >
        <Background color="var(--c-line)" gap={24} size={1} />
        <Controls
          className="!bg-panel !border !border-line !shadow-panel !rounded-sm [&_button]:!border-b [&_button]:!border-line [&_button]:!fill-sub [&_button:hover]:!fill-paper"
        />
      </ReactFlow>
    </div>
  );
}

