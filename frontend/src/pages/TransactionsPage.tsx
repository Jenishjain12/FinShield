import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  RefreshCw,
  Search,
  Zap,
} from "lucide-react";
import { SpotlightCard, TacticalBadge, ShimmerButton } from "../components/ui";
import { api, API_BASE_URL } from "../services/api";
import type { PaginatedTransactions, ReviewStatus, TransactionSummary } from "../types/api";

const REVIEW_BADGES: Record<ReviewStatus, { bg: string; text: string }> = {
  unreviewed: { bg: "bg-slate-800/80 text-slate-400 border border-white/5", text: "Unreviewed" },
  under_review: { bg: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20", text: "In Review" },
  escalated: { bg: "bg-rose-500/10 text-rose-300 border border-rose-500/25", text: "Escalated" },
  closed: { bg: "bg-slate-900/60 text-slate-500 border border-white/5", text: "Closed" },
};

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [data, setData] = useState<PaginatedTransactions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const q = searchParams.get("q") || "";
  const risk = searchParams.get("risk") || "";
  const type = searchParams.get("type") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);

  const [searchInput, setSearchInput] = useState(q);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.transactions({
        q: q || undefined,
        risk: risk || undefined,
        transaction_type: type || undefined,
        page,
        page_size: 25,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [q, risk, type, page]);

  // Live SSE listener for real-time transactions
  useEffect(() => {
    const sse = new EventSource(`${API_BASE_URL}/api/stream/events`);
    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.event_type === "transaction_scored" && payload?.data?.transaction) {
          const newTx = payload.data.transaction as TransactionSummary;
          setData((prev) => {
            if (!prev) return prev;
            // Add to items if page is 1
            if (page === 1) {
              const exists = prev.items.some((i) => i.id === newTx.id);
              if (!exists) {
                return {
                  ...prev,
                  total: prev.total + 1,
                  items: [newTx, ...prev.items.slice(0, 24)],
                };
              }
            }
            return { ...prev, total: prev.total + 1 };
          });
        }
      } catch {
        // ignore parse error
      }
    };
    return () => {
      sse.close();
    };
  }, [page]);

  const updateFilter = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v) next.delete(k);
      else next.set(k, v);
    });
    if (!updates.page && updates.page !== "1") {
      next.set("page", "1");
    }
    setSearchParams(next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter({ q: searchInput });
  };

  return (
    <div className="space-y-6 animate-fade-in relative pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-bold tracking-tight text-white">
              Real-Time Transaction Monitor
            </h1>
            <TacticalBadge level="LOW" text="Live Ingestion" pulse />
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Multivariate anomaly triage and deterministic risk signal observatory for simulated UPI streams.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchTransactions()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg border border-white/[0.1] bg-[#0E151C]/80 text-slate-300 hover:text-white hover:border-white/[0.2] transition-colors"
            title="Refresh transactions"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-cyan-400" : ""} />
            Refresh
          </button>
          <Link to="/stream">
            <ShimmerButton variant="primary" size="sm">
              <Zap size={12} />
              Simulator Console
            </ShimmerButton>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar (Spotlight Card) */}
      <SpotlightCard className="p-3.5 border-white/[0.08] tactical-corner">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="md:col-span-5 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search VPA, Account, Transaction ID, Device, City..."
              className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 font-mono"
            />
          </form>

          {/* Risk Filter */}
          <div className="md:col-span-3">
            <select
              value={risk}
              onChange={(e) => updateFilter({ risk: e.target.value })}
              className="w-full px-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-md text-xs text-slate-200 focus:outline-none focus:border-cyan-400/60 font-mono"
            >
              <option value="">All Risk Tiers</option>
              <option value="CRITICAL">Critical Risk (≥75)</option>
              <option value="HIGH">High Risk (50-74)</option>
              <option value="MEDIUM">Medium Risk (25-49)</option>
              <option value="LOW">Low Risk (&lt;25)</option>
            </select>
          </div>

          {/* Transaction Type Filter */}
          <div className="md:col-span-2">
            <select
              value={type}
              onChange={(e) => updateFilter({ type: e.target.value })}
              className="w-full px-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-md text-xs text-slate-200 focus:outline-none focus:border-cyan-400/60 font-mono"
            >
              <option value="">All Types</option>
              <option value="pay">Pay (Push)</option>
              <option value="collect">Collect (Pull)</option>
              <option value="transfer">Transfer</option>
              <option value="refund">Refund</option>
            </select>
          </div>

          {/* Reset */}
          <div className="md:col-span-2 flex items-center justify-end">
            {(q || risk || type) && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearchParams({});
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 underline font-mono cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </SpotlightCard>

      {/* Transaction Table (Dense Forensic CodyHouse Styling) */}
      <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0E151C]/75 backdrop-blur-md shadow-2xl tactical-corner">
        {loading && !data ? (
          <div className="py-20 text-center text-xs text-slate-400 font-mono animate-pulse">
            Querying simulated transactions ledger...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-xs text-rose-400 font-mono">
            {error}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 font-mono">
            No simulated transactions found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-black/30 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3.5">Transaction ID</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3.5">Sender VPA / Account</th>
                  <th className="py-2.5 px-3.5">Receiver VPA</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-3 text-center">Triage Score</th>
                  <th className="py-2.5 px-3">Review</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.items.map((tx) => {
                  const revStyle = REVIEW_BADGES[tx.review_status] || REVIEW_BADGES.unreviewed;
                  const isCritical = tx.risk_category === "CRITICAL";

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => navigate(`/transactions/${encodeURIComponent(tx.transaction_id)}`)}
                      className={`cursor-pointer transition-colors hover:bg-white/[0.03] group ${
                        isCritical ? "bg-rose-500/[0.04]" : ""
                      }`}
                    >
                      <td className="py-2 px-3.5 font-mono font-medium text-slate-200 flex items-center gap-2">
                        {isCritical && (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                          </span>
                        )}
                        <span className="group-hover:text-cyan-300 transition-colors">
                          {tx.transaction_id}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono whitespace-nowrap text-[11px]">
                        {new Date(tx.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-3 font-mono uppercase text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded border ${
                            tx.transaction_type === "collect"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              : "border-white/10 bg-white/[0.04] text-slate-300"
                          }`}
                        >
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="py-2 px-3.5 max-w-[200px] truncate">
                        <div className="font-mono text-slate-200 truncate group-hover:text-cyan-200">
                          {tx.sender_upi_handle}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          {tx.sender_account_id} • {tx.synthetic_geo_region}
                        </div>
                      </td>
                      <td className="py-2 px-3.5 max-w-[200px] truncate">
                        <div className="font-mono text-slate-200 truncate">
                          {tx.receiver_upi_handle}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          {tx.receiver_account_id}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-white tabular-nums">
                        ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <TacticalBadge
                          level={tx.risk_category}
                          text={`${tx.risk_score} • ${tx.risk_category}`}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono ${revStyle.bg}`}>
                          {revStyle.text}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-slate-400 group-hover:text-cyan-300 transition-colors inline-flex items-center gap-1 font-mono text-[11px]">
                          Inspect <ArrowRight size={11} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-white/[0.08] bg-black/20 text-xs font-mono">
            <span className="text-slate-400">
              Showing {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total} records
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={data.page <= 1}
                onClick={() => updateFilter({ page: String(data.page - 1) })}
                className="px-2.5 py-1 rounded border border-white/[0.08] bg-white/[0.03] disabled:opacity-30 hover:bg-white/[0.08] text-slate-300"
              >
                Previous
              </button>
              <span className="text-slate-200 px-2">Page {data.page} of {data.total_pages}</span>
              <button
                disabled={data.page >= data.total_pages}
                onClick={() => updateFilter({ page: String(data.page + 1) })}
                className="px-2.5 py-1 rounded border border-white/[0.08] bg-white/[0.03] disabled:opacity-30 hover:bg-white/[0.08] text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
