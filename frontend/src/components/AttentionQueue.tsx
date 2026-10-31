import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCheck, Clock } from "lucide-react";
import { formatDateShort, riskColor } from "../lib/format";
import type { AlertItem } from "../types/api";

interface AttentionQueueProps {
  alerts: AlertItem[];
  onMarkRead?: (id: string) => void;
  className?: string;
  maxItems?: number;
}

export function AttentionQueue({
  alerts,
  onMarkRead,
  className = "",
  maxItems,
}: AttentionQueueProps) {
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const filtered = filter === "unread" ? alerts.filter((a) => !a.is_read) : alerts;
  const displayItems = maxItems ? filtered.slice(0, maxItems) : filtered;

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Header with filter tabs */}
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warn opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-warn" />
          </span>
          <h3 className="font-mono text-xs uppercase tracking-wider text-paper font-semibold">
            Attention Beacons ({alerts.length})
          </h3>
        </div>

        <div className="flex items-center rounded-sm border border-line bg-surface p-0.5 text-3xs font-mono">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2 py-0.5 rounded-sm transition-colors ${
              filter === "all" ? "bg-accent/20 text-accent font-bold" : "text-dim hover:text-paper"
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`px-2 py-0.5 rounded-sm transition-colors ${
              filter === "unread" ? "bg-accent/20 text-accent font-bold" : "text-dim hover:text-paper"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {displayItems.length === 0 ? (
        <div className="p-8 text-center text-xs font-mono text-dim border border-line rounded-sm bg-panel">
          {filter === "unread" ? "Attention queue clear — all beacons reviewed." : "No beacons generated."}
        </div>
      ) : (
        <div className="space-y-2">
          {displayItems.map((alert) => {
            const color = riskColor(alert.severity);

            return (
              <article
                key={alert.id}
                className={`relative overflow-hidden rounded-sm border p-3 transition-colors ${
                  alert.is_read
                    ? "border-line/70 bg-panel opacity-75"
                    : "border-line bg-surface/50 hover:border-line-hover"
                }`}
              >
                {/* Left urgency rail */}
                <span
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />

                <div className="pl-1 space-y-1.5">
                  <div className="flex items-center justify-between text-3xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-1.5 py-0.2 rounded-sm font-bold uppercase border"
                        style={{
                          color,
                          borderColor: `${color}40`,
                          backgroundColor: `${color}14`,
                        }}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-paper font-semibold tracking-wide flex items-center gap-1">
                        <AlertTriangle size={9} style={{ color }} />
                        {alert.alert_type.replaceAll("_", " ").toUpperCase()}
                      </span>
                    </div>

                    <span className="text-dim flex items-center gap-1">
                      <Clock size={9} />
                      {formatDateShort(alert.created_at)}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-sub font-sans line-clamp-2">
                    {alert.reason}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-line/40 text-3xs font-mono">
                    <div className="flex items-center gap-3">
                      {alert.transaction_id && (
                        <Link
                          to={`/transactions/${encodeURIComponent(alert.transaction_id)}`}
                          className="text-accent hover:underline"
                        >
                          Inspect Transaction →
                        </Link>
                      )}
                      {alert.advertisement_id && (
                        <Link
                          to={`/investigations/${alert.advertisement_id}`}
                          className="text-accent hover:underline"
                        >
                          Open Dossier →
                        </Link>
                      )}
                      {alert.campaign_id && (
                        <Link
                          to={`/campaigns/${alert.campaign_id}`}
                          className="text-accent hover:underline"
                        >
                          Focus Constellation →
                        </Link>
                      )}
                    </div>

                    {!alert.is_read && onMarkRead ? (
                      <button
                        type="button"
                        onClick={() => onMarkRead(alert.id)}
                        className="text-dim hover:text-paper transition-colors flex items-center gap-1"
                      >
                        <CheckCheck size={10} /> Mark reviewed
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

