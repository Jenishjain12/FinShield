import { useState } from "react";
import { CheckCheck, ShieldAlert, Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { Skeleton } from "../components/Skeleton";
import { SpotlightCard, TacticalBadge } from "../components/ui";
import { useToast } from "../components/Toast";
import { useAsync } from "../hooks/useAsync";
import { formatDateShort } from "../lib/format";
import { api } from "../services/api";

export function AlertsPage() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAsync(
    () => api.alerts(),
    []
  );
  const [filter, setFilter] = useState<"all" | "unread">("all");

  async function markRead(id: string) {
    if (!data) return;
    try {
      const updated = await api.markAlert(id, true);
      setData(data.map((a) => (a.id === id ? updated : a)));
    } catch {
      toast("Failed to update alert.", "err");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!data) return null;

  const unreadCount = data.filter((a) => !a.is_read).length;
  const filtered = filter === "unread" ? data.filter((a) => !a.is_read) : data;

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in pb-12">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.08] pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              <span className="font-mono text-[10px] text-cyan-400 tracking-wider uppercase">
                Attention & Triage Signals
              </span>
            </div>
            <h1 className="font-mono text-2xl font-bold text-white tracking-tight">
              Attention Queue
            </h1>
            <p className="mt-1.5 text-xs text-slate-400 max-w-lg leading-relaxed font-sans">
              Rule-generated attention signals ordered for investigator triage.
              Duplicate suppression applied via synthetic idempotency keys.
            </p>
          </div>

          {/* Unread badge */}
          {unreadCount > 0 ? (
            <div className="shrink-0 mt-1 flex flex-col items-end gap-1">
              <TacticalBadge
                level="HIGH"
                text={`${unreadCount} UNREAD`}
                pulse
              />
              <span className="text-[10px] font-mono text-slate-500">of {data.length} total</span>
            </div>
          ) : (
            <TacticalBadge level="NOMINAL" text="Queue Clear" />
          )}
        </div>
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-0 rounded-lg border border-white/[0.08] overflow-hidden w-fit bg-[#0E151C]/90 p-0.5"
        role="tablist"
        aria-label="Alert filter"
      >
        {(["all", "unread"] as const).map((opt) => (
          <button
            key={opt}
            role="tab"
            type="button"
            aria-selected={filter === opt}
            onClick={() => setFilter(opt)}
            className={`px-4 py-1.5 text-xs font-mono rounded-md transition-all ${
              filter === opt
                ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30 shadow-[0_0_12px_rgba(0,242,254,0.15)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {opt === "all"
              ? `All signals (${data.length})`
              : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* ── Alert list ───────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        filter === "unread" ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-[#0E151C]/80 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400">
              <CheckCheck size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white font-mono">Attention queue clear</p>
              <p className="mt-1 text-xs text-slate-400">
                All signals have been reviewed. Switch to "All" for the full audit record.
              </p>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No alerts generated"
            body="Alerts are generated when the analysis engine detects high-risk or anomalous content."
            icon={<ShieldAlert size={20} />}
          />
        )
      ) : (
        <div className="space-y-3" role="list" aria-label="Alert list">
          {filtered.map((alert) => {
            const isCritical = alert.severity === "CRITICAL";

            return (
              <SpotlightCard
                key={alert.id}
                spotlightColor={isCritical ? "rgba(244, 63, 94, 0.12)" : "rgba(0, 242, 254, 0.08)"}
                className={`p-4 border-white/[0.08] transition-all tactical-corner ${
                  alert.is_read ? "bg-[#0E151C]/60 opacity-80" : "bg-[#0E151C]/90"
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <TacticalBadge
                      level={
                        alert.severity === "CRITICAL"
                          ? "CRITICAL"
                          : alert.severity === "HIGH"
                          ? "HIGH"
                          : alert.severity === "MEDIUM"
                          ? "MEDIUM"
                          : "LOW"
                      }
                      text={alert.severity}
                    />

                    {/* Alert type chip */}
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-black/40 border border-white/[0.08] px-2.5 py-0.5 text-[10px] font-mono font-semibold text-slate-200 tracking-wide">
                      <AlertTriangle size={10} className="text-amber-400 shrink-0" />
                      {alert.alert_type.replaceAll("_", " ").toUpperCase()}
                    </span>

                    {!alert.is_read && (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500 whitespace-nowrap font-mono flex items-center gap-1">
                    <Clock size={10} />
                    {formatDateShort(alert.created_at)}
                  </span>
                </div>

                {/* Reason */}
                <p className="mt-2.5 text-xs leading-relaxed text-slate-300 font-sans">
                  {alert.reason}
                </p>

                {/* Actions row */}
                <div className="mt-3.5 flex flex-wrap items-center gap-4 text-xs border-t border-white/[0.06] pt-2.5 font-mono">
                  {alert.advertisement_id && (
                    <Link
                      to={`/investigations/${alert.advertisement_id}`}
                      className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline"
                    >
                      Open Case Dossier →
                    </Link>
                  )}
                  {alert.campaign_id && (
                    <Link
                      to={`/campaigns/${alert.campaign_id}`}
                      className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline"
                    >
                      Open Campaign Cluster →
                    </Link>
                  )}
                  {alert.transaction_id && (
                    <Link
                      to={`/transactions/${encodeURIComponent(alert.transaction_id)}`}
                      className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline"
                    >
                      Inspect Transaction ({alert.transaction_id}) →
                    </Link>
                  )}

                  {!alert.is_read ? (
                    <button
                      type="button"
                      onClick={() => markRead(alert.id)}
                      className="text-slate-400 hover:text-white transition-colors ml-auto text-[10px] flex items-center gap-1"
                    >
                      <CheckCheck size={11} />
                      Mark as read
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 ml-auto flex items-center gap-1">
                      <CheckCheck size={10} className="text-emerald-400" /> Reviewed
                    </span>
                  )}
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      )}

      {/* ── Methodology notice ───────────────────────────────────────── */}
      <p className="text-[11px] text-slate-500 leading-relaxed border-t border-white/[0.06] pt-4 font-mono">
        Alerts are deterministically generated by configured rule conditions, not by a statistical fraud-probability model.
        Each alert references an observable triage signal and does not constitute a finding of fraud or criminal conduct.
      </p>
    </div>
  );
}
