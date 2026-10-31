import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import { SpotlightCard, TacticalBadge, ShimmerButton } from "../components/ui";
import { DossierPanel } from "../components/DossierPanel";
import { api } from "../services/api";
import type { CustomerAccount, DeviceFingerprint, NetworkGraphData } from "../types/api";

export function EntitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") || "";

  const [inputVal, setInputVal] = useState(qParam);
  const [activeAccount, setActiveAccount] = useState<CustomerAccount | null>(null);
  const [activeDevice, setActiveDevice] = useState<DeviceFingerprint | null>(null);
  const [graphData, setGraphData] = useState<NetworkGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchGraph = async () => {
    try {
      const res = await api.networkGraph();
      setGraphData(res);
    } catch {
      // ignore
    }
  };

  const performLookup = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearchError(null);
    setActiveAccount(null);
    setActiveDevice(null);

    let found = false;

    // Check if device format
    if (trimmed.startsWith("DEV_") || trimmed.includes("DEV")) {
      try {
        const dev = await api.entityDevice(trimmed);
        setActiveDevice(dev);
        found = true;
      } catch {
        // try account next
      }
    }

    if (!found) {
      try {
        const acc = await api.entityAccount(trimmed);
        setActiveAccount(acc);
        found = true;
      } catch {
        // failed
      }
    }

    if (!found) {
      setSearchError(`No account or device entity found matching identifier "${trimmed}".`);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchGraph();
    if (qParam) {
      performLookup(qParam);
    }
  }, [qParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      setSearchParams({ q: inputVal.trim() });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in relative">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-cyan animate-pulse" />
            <p className="eyebrow">Topology & Entity Resolution</p>
          </div>
          <h1 className="display-face text-2xl sm:text-3xl text-paper tracking-tight">
            Entity & Terminal Intelligence
          </h1>
          <p className="mt-1 text-xs text-sub font-mono max-w-2xl leading-relaxed">
            Correlate synthetic customer accounts, shared device fingerprints, and money-movement counterparties across the transaction ledger.
          </p>
        </div>

        <button
          onClick={fetchGraph}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-line bg-panel text-sub hover:text-paper hover:bg-surface transition-colors self-start"
        >
          <RefreshCw size={12} className="text-signal-cyan" /> Refresh Graph
        </button>
      </div>

      {/* ── Search Bar ─────────────────────────────────────────────── */}
      <SpotlightCard className="p-3 border-line bg-panel/80 artifact-corner">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Lookup by Account ID (e.g. ACC_IND_1045) or Device ID (e.g. DEV_IND_253860)..."
              className="w-full pl-9 pr-3 py-2 bg-surface/50 border border-line text-xs text-paper placeholder:text-dim focus:outline-none focus:border-accent font-mono"
            />
          </div>
          <ShimmerButton type="submit" variant="primary" size="md">
            Inspect Entity
          </ShimmerButton>
        </form>
      </SpotlightCard>

      {/* ── Loading / Error State ───────────────────────────────────── */}
      {loading && (
        <div className="py-8 text-center text-xs font-mono text-dim animate-pulse">
          Querying entity registry and topology links…
        </div>
      )}

      {searchError && !loading && (
        <div className="p-3.5 bg-signal-red/10 border border-signal-red/30 text-xs font-mono text-signal-red">
          {searchError}
        </div>
      )}

      {/* ── Account Profile Card ────────────────────────────────────── */}
      {activeAccount && !loading && (
        <DossierPanel
          eyebrow="Account Record"
          title={activeAccount.holder_name}
          subtitle={`Account ID: ${activeAccount.account_id} · ${activeAccount.bank_name}`}
          badge={<TacticalBadge level="INFO" text={`Tier: ${activeAccount.risk_tier}`} />}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono mt-3">
            <div className="p-3 bg-surface/60 border border-line">
              <span className="text-3xs text-dim block uppercase">Primary VPA Handle</span>
              <span className="text-accent font-semibold truncate block mt-0.5">{activeAccount.primary_upi_handle}</span>
            </div>
            <div className="p-3 bg-surface/60 border border-line">
              <span className="text-3xs text-dim block uppercase">Masked Account</span>
              <span className="text-paper mt-0.5 block">{activeAccount.account_number_masked}</span>
            </div>
            <div className="p-3 bg-surface/60 border border-line">
              <span className="text-3xs text-dim block uppercase">Baseline Avg Transfer</span>
              <span className="text-paper font-semibold mt-0.5 block">₹{activeAccount.baseline_avg_amount.toLocaleString("en-IN")}</span>
            </div>
            <div className="p-3 bg-surface/60 border border-line">
              <span className="text-3xs text-dim block uppercase">Baseline Velocity</span>
              <span className="text-paper mt-0.5 block">{activeAccount.baseline_daily_velocity} txns/day</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-mono text-sub">
            <span className="flex items-center gap-1.5 text-2xs">
              <MapPin size={12} className="text-signal-cyan" /> Region: {activeAccount.primary_geo_region}
            </span>
            <Link
              to={`/transactions?q=${encodeURIComponent(activeAccount.account_id)}`}
              className="text-signal-cyan hover:underline flex items-center gap-1 text-2xs"
            >
              View Transactions <ArrowRight size={11} />
            </Link>
          </div>
        </DossierPanel>
      )}

      {/* ── Device Profile Card ─────────────────────────────────────── */}
      {activeDevice && !loading && (
        <DossierPanel
          eyebrow="Hardware Profile"
          title={`Terminal / ${activeDevice.device_id}`}
          subtitle={`Hardware: ${activeDevice.device_model} (${activeDevice.os_version})`}
          badge={
            activeDevice.associated_accounts_count >= 3 ? (
              <TacticalBadge
                level="CRITICAL"
                text={`Mule Sharing Ring (${activeDevice.associated_accounts_count} accounts)`}
                pulse
              />
            ) : undefined
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono mt-3">
            <div className="p-3 bg-surface/60 border border-line">
              <span className="text-3xs text-dim block uppercase">Associated Accounts</span>
              <span className="text-paper font-bold text-base mt-0.5 block">{activeDevice.associated_accounts_count}</span>
            </div>
            <div className="p-3 bg-surface/60 border border-line">
              <span className="text-3xs text-dim block uppercase">App Client Version</span>
              <span className="text-paper mt-0.5 block">{activeDevice.app_version}</span>
            </div>
            <div className="p-3 bg-surface/60 border border-line">
              <span className="text-3xs text-dim block uppercase">First Observed</span>
              <span className="text-paper text-2xs mt-0.5 block">{new Date(activeDevice.first_seen).toLocaleDateString()}</span>
            </div>
            <div className="p-3 bg-surface/60 border border-line">
              <span className="text-3xs text-dim block uppercase">Last Activity</span>
              <span className="text-paper text-2xs mt-0.5 block">{new Date(activeDevice.last_seen).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line text-right">
            <Link
              to={`/transactions?q=${encodeURIComponent(activeDevice.device_id)}`}
              className="text-signal-cyan hover:underline inline-flex items-center gap-1 text-2xs font-mono"
            >
              Inspect Transactions From This Device <ArrowRight size={11} />
            </Link>
          </div>
        </DossierPanel>
      )}

      {/* ── Network Topology Graph Overview ─────────────────────────── */}
      <DossierPanel
        eyebrow="Topology Map"
        title={`Entity Link Graph (${graphData?.nodes?.length || 0} nodes · ${graphData?.edges?.length || 0} links)`}
        subtitle="Synthetically generated financial counterparty connections"
      >
        {graphData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {/* Cluster Nodes */}
            <div className="p-3.5 bg-surface/40 border border-line space-y-2">
              <div className="text-3xs font-mono uppercase text-dim flex items-center justify-between">
                <span>Active Entities Sample</span>
                <span>Type</span>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-2xs">
                {graphData.nodes.slice(0, 20).map((node) => (
                  <div
                    key={node.id}
                    onClick={() => {
                      setInputVal(node.id);
                      performLookup(node.id);
                    }}
                    className="flex items-center justify-between p-1.5 hover:bg-surface cursor-pointer border border-transparent hover:border-line transition-colors"
                  >
                    <span className="text-paper/90 truncate max-w-[220px]">{node.label}</span>
                    <span className="text-dim uppercase text-3xs px-1.5 py-0.5 bg-panel border border-line">
                      {node.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Relationship Edges */}
            <div className="p-3.5 bg-surface/40 border border-line space-y-2">
              <div className="text-3xs font-mono uppercase text-dim flex items-center justify-between">
                <span>Relationship Edges</span>
                <span>Evidence Type</span>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto font-mono text-2xs">
                {graphData.edges.slice(0, 20).map((edge) => (
                  <div key={edge.id} className="p-2 bg-panel border border-line/60 space-y-0.5">
                    <div className="flex items-center justify-between text-paper text-2xs">
                      <span className="truncate max-w-[140px] font-semibold">{edge.source}</span>
                      <span className="text-dim">→</span>
                      <span className="truncate max-w-[140px] font-semibold">{edge.target}</span>
                    </div>
                    <div className="text-sub flex items-center justify-between text-3xs">
                      <span className="uppercase text-signal-cyan font-semibold">{edge.relationship_type}</span>
                      <span className="truncate max-w-[200px] text-dim">{edge.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DossierPanel>
    </div>
  );
}
