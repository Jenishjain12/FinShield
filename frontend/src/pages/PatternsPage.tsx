import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  TrendingUp,
  UserX,
  Zap,
} from "lucide-react";
import { SpotlightCard, TacticalBadge } from "../components/ui";
import { api } from "../services/api";
import type { PatternSummary, TransactionSummary } from "../types/api";

const PATTERN_ICONS: Record<string, any> = {
  FAKE_COLLECT_REQUEST: Zap,
  PHISHING_PAYMENT_HANDLE: AlertTriangle,
  MULE_ACCOUNT_FAN_OUT: TrendingUp,
  RAPID_REPEATED_TRANSFERS: RefreshCw,
  DEVICE_SHARING_RING: Smartphone,
  NEW_PAYEE_HIGH_VALUE: UserX,
};

export function PatternsPage() {
  const navigate = useNavigate();

  const [patterns, setPatterns] = useState<PatternSummary[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [patternTxns, setPatternTxns] = useState<TransactionSummary[]>([]);
  const [loadingPatterns, setLoadingPatterns] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(false);

  const fetchPatterns = async () => {
    setLoadingPatterns(true);
    try {
      const res = await api.patterns();
      setPatterns(res);
      if (res.length > 0 && !selectedPattern) {
        setSelectedPattern(res[0].pattern_id);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPatterns(false);
    }
  };

  useEffect(() => {
    fetchPatterns();
  }, []);

  useEffect(() => {
    if (!selectedPattern) return;
    const fetchTxns = async () => {
      setLoadingTxns(true);
      try {
        const res = await api.patternTransactions(selectedPattern);
        setPatternTxns(res);
      } catch {
        setPatternTxns([]);
      } finally {
        setLoadingTxns(false);
      }
    };
    fetchTxns();
  }, [selectedPattern]);

  const activePat = patterns.find((p) => p.pattern_id === selectedPattern);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-bold tracking-tight text-white">
              UPI Risk Pattern Intelligence
            </h1>
            <TacticalBadge level="LOW" text="Deterministic Rule Archetypes" />
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Signatures for deceptive collect requests, brand impersonation handles, mule fan-out transit, and device rings.
          </p>
        </div>

        <button
          onClick={fetchPatterns}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg border border-white/[0.1] bg-[#0E151C]/80 text-slate-300 hover:text-white hover:border-white/[0.2] transition-colors self-start"
        >
          <RefreshCw size={13} className={loadingPatterns ? "animate-spin text-cyan-400" : ""} /> Refresh Metrics
        </button>
      </div>

      {/* Grid of Pattern Archetypes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patterns.map((pat) => {
          const isSelected = pat.pattern_id === selectedPattern;
          const Icon = PATTERN_ICONS[pat.pattern_id] || ShieldAlert;
          const isCritical = pat.severity_level === "CRITICAL";

          return (
            <SpotlightCard
              key={pat.pattern_id}
              onClick={() => setSelectedPattern(pat.pattern_id)}
              spotlightColor={isCritical ? "rgba(244, 63, 94, 0.12)" : "rgba(0, 242, 254, 0.08)"}
              className={`p-4 rounded-xl border cursor-pointer transition-all tactical-corner ${
                isSelected
                  ? "bg-cyan-500/[0.08] border-cyan-400/60 shadow-[0_0_20px_rgba(0,242,254,0.15)]"
                  : "bg-[#0E151C]/80 border-white/[0.08] hover:border-white/[0.2]"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-black/40 border border-white/[0.08] text-cyan-400">
                  <Icon size={16} />
                </div>
                <TacticalBadge
                  level={isCritical ? "CRITICAL" : "HIGH"}
                  text={pat.severity_level}
                />
              </div>

              <div className="mt-3 space-y-1">
                <h3 className="font-semibold text-sm text-white font-mono">{pat.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans">
                  {pat.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Flagged Volume</span>
                  <span className="text-white font-semibold">₹{pat.flagged_volume_inr.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Incidents</span>
                  <span className="text-cyan-300 font-bold">{pat.matched_count}</span>
                </div>
              </div>
            </SpotlightCard>
          );
        })}
      </div>

      {/* Selected Pattern Incident Drilldown */}
      {activePat && (
        <SpotlightCard className="p-5 border-white/[0.08] space-y-4 tactical-corner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">{activePat.name}</h2>
                <span className="text-[10px] font-mono text-slate-400">({activePat.pattern_id})</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-sans">{activePat.description}</p>
            </div>
            <span className="text-xs font-mono text-cyan-300">
              {patternTxns.length} matching transactions
            </span>
          </div>

          {loadingTxns ? (
            <div className="py-12 text-center text-xs font-mono text-slate-400 animate-pulse">
              Querying incidents linked to {activePat.name}...
            </div>
          ) : patternTxns.length === 0 ? (
            <div className="py-10 text-center text-xs font-mono text-slate-400">
              No recent simulated transactions flagged under this archetype.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-black/30 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Transaction ID</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Sender VPA</th>
                    <th className="py-2.5 px-3">Receiver VPA</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-3 text-center">Triage Score</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-mono">
                  {patternTxns.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => navigate(`/transactions/${encodeURIComponent(tx.transaction_id)}`)}
                      className="cursor-pointer hover:bg-white/[0.03] transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-slate-200 font-medium group-hover:text-cyan-300">
                        {tx.transaction_id}
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[10px] text-slate-400">{tx.transaction_type}</td>
                      <td className="py-2.5 px-3 text-slate-300 truncate max-w-[180px]">{tx.sender_upi_handle}</td>
                      <td className="py-2.5 px-3 text-slate-300 truncate max-w-[180px]">{tx.receiver_upi_handle}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-white">
                        ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <TacticalBadge
                          level={tx.risk_score >= 75 ? "CRITICAL" : "HIGH"}
                          text={String(tx.risk_score)}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-slate-400 group-hover:text-cyan-300 inline-flex items-center gap-1 text-[10px]">
                          Inspect <ArrowRight size={11} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SpotlightCard>
      )}
    </div>
  );
}
