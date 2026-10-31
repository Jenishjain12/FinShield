import { ArrowRight, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { relationshipLabel } from "../lib/format";
import type { Relationship } from "../types/api";

export function RelationshipPathway({ relationships, currentAdId }: { relationships: Relationship[]; currentAdId: string }) {
  if (!relationships.length) return <p className="py-5 text-sm text-sub">No related records were observed.</p>;
  const groups = relationships.reduce<Record<string, Relationship[]>>((acc, relationship) => { (acc[relationship.relationship_type] ??= []).push(relationship); return acc; }, {});
  return <div className="space-y-3">{Object.entries(groups).map(([type, relations]) => <div key={type} className="border-l border-accent/50 pl-4"><div className="flex items-center gap-2"><Link2 size={13} className={type === "text_similarity" ? "text-warn" : "text-accent"}/><p className="text-xs font-semibold text-paper">{relationshipLabel(type)}</p><span className="evidence-mono text-2xs text-dim">×{relations.length}</span></div>{relations.map((rel) => { const relatedId = rel.source_ad_id === currentAdId ? rel.target_ad_id : rel.source_ad_id; return <div key={rel.id} className="mt-2 flex items-center gap-3 text-xs"><span className="min-w-0 flex-1 truncate font-mono text-sub">{rel.evidence || rel.explanation}</span><ArrowRight size={12} className="text-dim"/><Link to={`/investigations/${relatedId}`} className="shrink-0 text-accent hover:underline">Open case</Link></div>; })}</div>)}</div>;
}
