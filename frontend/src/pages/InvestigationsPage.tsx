import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  FolderSearch,
  LayoutList,
  Table2,
  Filter,
  FileText,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { Skeleton } from "../components/Skeleton";
import { DossierPanel } from "../components/DossierPanel";
import { TacticalBadge, SpotlightCard } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { formatDateShort, riskColor } from "../lib/format";
import { api } from "../services/api";

const RISK_OPTIONS = ["", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const PAGE_SIZE = 15;

export function InvestigationsPage() {
  const [params, setParams] = useSearchParams();
  const q    = params.get("q")    ?? "";
  const risk = params.get("risk") ?? "";
  const page = Number(params.get("page") ?? "1");
  const [search, setSearch] = useState(q);
  const [view, setView] = useState<"dossier" | "matrix">("dossier");

  useEffect(() => {
    const id = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (search) next.set("q", search); else next.delete("q");
        next.set("page", "1");
        return next;
      });
    }, 350);
    return () => clearTimeout(id);
  }, [search, setParams]);

  const { data, error, loading, reload } = useAsync(
    () => api.ads({ q, risk, page, page_size: PAGE_SIZE }),
    [q, risk, page]
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  function setParam(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      next.set("page", "1");
      return next;
    });
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-cyan animate-pulse" />
            <p className="eyebrow">Evidence Observatory</p>
          </div>
          <h1 className="display-face text-2xl sm:text-3xl text-paper tracking-tight">
            Case Archive & Triage Ledger
          </h1>
          <p className="mt-1 text-xs text-sub font-mono max-w-2xl leading-relaxed">
            Forensic directory of analyzed financial advertisements and solicitations.
            Each case maps deterministic entity extractions, signal contributions, and cross-campaign links.
          </p>
        </div>

        {data && (
          <div className="flex items-center gap-3 border border-line bg-panel px-3.5 py-2 font-mono text-2xs text-sub shrink-0">
            <span>Total Cases: <strong className="text-paper">{data.total.toLocaleString()}</strong></span>
            <span className="text-line">|</span>
            <span>Page <strong className="text-paper">{data.page}</strong> of <strong className="text-paper">{totalPages}</strong></span>
          </div>
        )}
      </div>

      {/* ── Filter & Search Toolbar (SpotlightCard) ────────────────── */}
      <SpotlightCard className="p-3.5 border-line bg-panel/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search copy, extracted phone, VPA, domain…"
              aria-label="Search investigations"
              className="w-full border border-line bg-surface/50 py-2 pl-8 pr-8 text-xs font-mono text-paper placeholder:text-dim outline-none focus:border-accent transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-paper transition-colors"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Risk Filters */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Filter by risk category">
            <Filter size={12} className="text-dim mr-1 hidden sm:block" />
            {RISK_OPTIONS.map((opt) => {
              const isActive = risk === opt;
              const color = opt ? riskColor(opt) : undefined;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setParam("risk", opt)}
                  aria-pressed={isActive}
                  className={`border px-3 py-1.5 text-3xs font-mono font-semibold tracking-wider transition-all uppercase ${
                    isActive
                      ? "border-accent bg-accent/10 text-accent shadow-[0_0_8px_rgba(88,199,217,0.15)]"
                      : "border-line text-sub hover:bg-surface hover:text-paper"
                  }`}
                  style={isActive && color ? { borderColor: `${color}60`, backgroundColor: `${color}14`, color } : {}}
                >
                  {opt || "ALL SEVERITY"}
                </button>
              );
            })}
          </div>

          {/* View mode toggle */}
          <div className="ml-auto flex border border-line font-mono text-3xs overflow-hidden" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setView("dossier")}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                view === "dossier" ? "bg-accent/15 text-accent font-semibold" : "text-dim hover:text-paper"
              }`}
              aria-pressed={view === "dossier"}
            >
              <LayoutList size={11} /> DOSSIER
            </button>
            <button
              type="button"
              onClick={() => setView("matrix")}
              className={`flex items-center gap-1.5 border-l border-line px-3 py-1.5 transition-colors ${
                view === "matrix" ? "bg-accent/15 text-accent font-semibold" : "text-dim hover:text-paper"
              }`}
              aria-pressed={view === "matrix"}
            >
              <Table2 size={11} /> MATRIX
            </button>
          </div>
        </div>
      </SpotlightCard>

      {/* ── Content States ─────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[96px] w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No case records match criteria"
          body="Adjust your search query or risk filter. New investigations are cataloged automatically when advertisements are submitted."
          icon={<FolderSearch size={22} />}
        />
      ) : (
        <>
          {view === "dossier" ? (
            /* ── Dossier List View ─────────────────────────────────── */
            <div className="space-y-2.5" role="list">
              {data.items.map((ad) => {
                const color = riskColor(ad.risk_category);
                return (
                  <Link
                    key={ad.id}
                    to={`/investigations/${ad.id}`}
                    className="group relative flex border border-line bg-panel hover:bg-surface/70 transition-all hover:border-accent/40 block overflow-hidden artifact-corner"
                    role="listitem"
                  >
                    {/* Left severity indicator bar */}
                    <div
                      className="w-1.5 shrink-0"
                      style={{ backgroundColor: color }}
                    />

                    {/* Main content body */}
                    <div className="flex-1 min-w-0 p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2 font-mono text-3xs">
                        <span className="text-accent font-semibold">CASE / {ad.id.slice(0, 8)}</span>
                        {ad.is_seed && (
                          <span className="border border-line/80 px-1.5 py-0.2 text-dim">
                            SYNTHETIC DEMO
                          </span>
                        )}
                        <span className="text-dim">·</span>
                        <span className="text-sub">{ad.source || "Direct Ingestion"}</span>
                        <span className="text-dim">·</span>
                        <span className="text-dim">{formatDateShort(ad.created_at)}</span>
                      </div>

                      <p className="line-clamp-2 text-xs leading-relaxed text-paper/90 group-hover:text-paper font-sans">
                        {ad.text}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-3xs font-mono text-dim">
                        <span className="flex items-center gap-1">
                          <Layers size={10} className="text-dim" />
                          <strong className="text-paper/80">{ad.entity_count}</strong> entities
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText size={10} className="text-dim" />
                          <strong className="text-paper/80">{ad.related_count}</strong> links
                        </span>
                        <span className="uppercase text-sub">
                          Status: <strong className="text-paper/90">{ad.review_status.replace("_", " ")}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Right score block */}
                    <div className="flex flex-col items-end justify-center gap-2 border-l border-line px-5 py-4 shrink-0 bg-surface/30 group-hover:bg-surface/60 transition-colors">
                      <div className="text-right">
                        <span className="text-3xs font-mono text-dim uppercase block">Risk Score</span>
                        <p className="evidence-mono text-2xl font-bold leading-none text-paper mt-0.5" style={{ color }}>
                          {ad.risk_score}
                        </p>
                      </div>
                      <TacticalBadge
                        level={ad.risk_category}
                        text={ad.risk_category}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* ── Matrix Dense Table View ────────────────────────────── */
            <DossierPanel className="p-0 overflow-hidden" artifactCorner={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono" aria-label="Investigations tabular matrix">
                  <thead>
                    <tr className="border-b border-line bg-surface/60 text-3xs uppercase tracking-wider text-dim">
                      <th className="px-4 py-3 text-left font-semibold">Case Reference / Copy</th>
                      <th className="px-4 py-3 text-right font-semibold w-24">Triage Score</th>
                      <th className="px-4 py-3 text-left font-semibold w-32">Severity</th>
                      <th className="px-4 py-3 text-right font-semibold w-20">Entities</th>
                      <th className="px-4 py-3 text-right font-semibold w-20">Linked</th>
                      <th className="px-4 py-3 text-left font-semibold w-32">Disposition</th>
                      <th className="px-4 py-3 text-left font-semibold w-32">Cataloged</th>
                      <th className="px-4 py-3 text-center font-semibold w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {data.items.map((ad) => {
                      const color = riskColor(ad.risk_category);
                      return (
                        <tr
                          key={ad.id}
                          className="hover:bg-surface/50 transition-colors group"
                        >
                          <td className="px-4 py-2.5 max-w-sm">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <Link
                                to={`/investigations/${ad.id}`}
                                className="line-clamp-1 text-paper/90 group-hover:text-accent transition-colors font-sans"
                              >
                                {ad.text}
                              </Link>
                              {ad.is_seed && (
                                <span className="border border-line/60 px-1 text-3xs text-dim shrink-0">
                                  synthetic
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums" style={{ color }}>
                            {ad.risk_score}
                          </td>
                          <td className="px-4 py-2.5">
                            <TacticalBadge level={ad.risk_category} text={ad.risk_category} />
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-sub">
                            {ad.entity_count}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-sub">
                            {ad.related_count}
                          </td>
                          <td className="px-4 py-2.5 text-3xs uppercase text-dim">
                            {ad.review_status.replace("_", " ")}
                          </td>
                          <td className="px-4 py-2.5 text-3xs text-dim whitespace-nowrap">
                            {formatDateShort(ad.created_at)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Link
                              to={`/investigations/${ad.id}`}
                              className="text-dim hover:text-accent transition-colors inline-block"
                              aria-label={`Open case ${ad.id}`}
                            >
                              <ArrowUpRight size={13} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DossierPanel>
          )}

          {/* ── Pagination Bar ──────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 font-mono text-xs text-sub">
              <div>
                Showing page <strong className="text-paper">{data.page}</strong> of <strong className="text-paper">{totalPages}</strong> ({data.total.toLocaleString()} total entries)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setParam("page", String(page - 1))}
                  className="flex items-center gap-1 border border-line bg-panel px-3 py-1.5 text-xs text-sub hover:bg-surface hover:text-paper transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setParam("page", String(page + 1))}
                  className="flex items-center gap-1 border border-line bg-panel px-3 py-1.5 text-xs text-sub hover:bg-surface hover:text-paper transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
