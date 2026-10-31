import {
  CreditCard,
  Globe,
  Landmark,
  Link,
  Mail,
  Phone,
  Quote,
  Tag,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { maskValue } from "../lib/format";
import type { Entity } from "../types/api";

function EntityIcon({ type }: { type: string }) {
  const props = { size: 13, "aria-hidden": true, className: "shrink-0 text-dim" } as const;
  switch (type) {
    case "phone":        return <Phone        {...props} />;
    case "url":          return <Link         {...props} />;
    case "domain":       return <Globe        {...props} />;
    case "email":        return <Mail         {...props} />;
    case "upi":          return <CreditCard   {...props} />;
    case "account_like": return <Landmark     {...props} />;
    case "phrase":       return <Quote        {...props} />;
    default:             return <Tag          {...props} />;
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-dim hover:text-sub p-0.5"
      aria-label={`Copy ${value}`}
      title="Copy to clipboard"
    >
      {copied
        ? <Check size={12} className="text-ok" />
        : <Copy size={12} />
      }
    </button>
  );
}

interface Props {
  entities: Entity[];
}

const ORDERED_TYPES = [
  "phone", "upi", "account_like", "url", "domain", "email", "phrase",
];

/** Groups extracted entities by type and renders them in a structured panel.
 *  Excludes phrases by default — they are rarely actionable. */
export function EntityPanel({ entities }: Props) {
  const [showPhrases, setShowPhrases] = useState(false);

  const actionable = entities.filter((e) => e.entity_type !== "phrase");
  const phrases    = entities.filter((e) => e.entity_type === "phrase");

  const grouped: Record<string, Entity[]> = {};
  for (const type of ORDERED_TYPES) {
    const group = actionable.filter((e) => e.entity_type === type);
    if (group.length > 0) grouped[type] = group;
  }

  if (actionable.length === 0 && phrases.length === 0) {
    return (
      <p className="text-sm text-sub">
        No entities were extracted from this advertisement.
      </p>
    );
  }

  const TYPE_LABELS: Record<string, string> = {
    phone:        "Phone numbers",
    url:          "URLs",
    domain:       "Domains",
    email:        "Email addresses",
    upi:          "UPI / payment handles",
    account_like: "Account references",
    phrase:       "Notable phrases",
  };

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, group]) => (
        <div key={type}>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-sub">
            {TYPE_LABELS[type] ?? type}
          </p>
          <ul className="space-y-1" aria-label={TYPE_LABELS[type]}>
            {group.map((entity) => (
              <li
                key={entity.id}
                className="group flex items-center gap-2 rounded bg-surface border border-line/60 px-3 py-1.5"
              >
                <EntityIcon type={entity.entity_type} />
                <span className="flex-1 min-w-0 font-mono text-xs text-paper/80 truncate">
                  {maskValue(entity.entity_type, entity.normalized_value || entity.raw_value)}
                </span>
                <CopyButton value={entity.normalized_value || entity.raw_value} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {phrases.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowPhrases((v) => !v)}
            className="text-2xs text-dim hover:text-sub transition-colors"
          >
            {showPhrases ? "Hide" : "Show"} {phrases.length} extracted phrase
            {phrases.length !== 1 ? "s" : ""}
          </button>
          {showPhrases ? (
            <ul className="mt-2 space-y-1">
              {phrases.map((entity) => (
                <li
                  key={entity.id}
                  className="rounded bg-surface border border-line/60 px-3 py-1.5 text-xs text-sub italic"
                >
                  &ldquo;{entity.raw_value}&rdquo;
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
