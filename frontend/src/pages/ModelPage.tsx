import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { SpotlightCard, TacticalBadge, ShimmerButton } from "../components/ui";
import { api } from "../services/api";
import type { ModelTelemetry } from "../types/api";

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  amount: "Nominal transaction value in INR. Scaled via RobustScaler to handle heavy-tailed financial distributions.",
  hour_of_day: "Local 24-hour timestamp (0-23). Captures cyclical daytime vs nocturnal payment spikes.",
  is_night: "Binary flag (11 PM - 4 AM). Higher probability window for automated fraud and credential stuffing.",
  is_weekend: "Binary flag indicating Saturday or Sunday. Catches off-business batch drain operations.",
  sender_velocity_1h: "Number of outbound transactions initiated by sender in the preceding 60 minutes.",
  sender_velocity_24h: "Number of outbound transactions initiated by sender in the preceding 24 hours.",
  receiver_velocity_1h: "Number of inbound transfers received by payee in the preceding 60 minutes.",
  receiver_velocity_24h: "Number of inbound transfers received by payee in the preceding 24 hours.",
  amount_deviation_from_baseline: "Multiplicative ratio of current transfer amount relative to account historical average.",
  is_new_beneficiary: "Binary indicator: 1 if sender has never previously transacted with receiver VPA.",
  device_reuse_count: "Count of distinct customer accounts observed originating transfers from this device fingerprint.",
  ip_reuse_count: "Count of distinct customer accounts transacting from the same synthetic IP subnet.",
  is_collect_request: "Binary indicator: 1 if transaction is a pull (collect) request rather than a push (pay) transfer.",
  rapid_in_out_flag: "Mule indicator: 1 if account received recent funds and immediately transfers >70% outbound.",
  is_round_number: "Binary flag: 1 if amount is rounded (e.g. ₹5,000, ₹10,000, ₹50,000).",
  geo_discrepancy_flag: "Binary indicator: 1 if synthetic IP location diverges from account registered home region.",
  failed_attempts_1h: "Count of failed PIN / insufficient funds attempts in the preceding hour prior to transaction.",
};

export function ModelPage() {
  const [model, setModel] = useState<ModelTelemetry | null>(null);
  const [training, setTraining] = useState(false);
  const [trainMessage, setTrainMessage] = useState<string | null>(null);

  const fetchModel = async () => {
    try {
      const res = await api.modelStatus();
      setModel(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchModel();
  }, []);

  const handleRetrain = async () => {
    setTraining(true);
    setTrainMessage(null);
    try {
      const res = await api.modelTrain();
      setTrainMessage(
        `Isolation Forest model retrained successfully: ${res.sample_count || res.training_sample_count || 180} samples incorporated.`
      );
      fetchModel();
    } catch (err: any) {
      alert("Failed to retrain model: " + err?.message);
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-bold tracking-tight text-white">
              Model Health & Explainability
            </h1>
            <TacticalBadge level="NOMINAL" text="Active Pipeline" pulse />
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Telemetry and feature architecture for the unsupervised Isolation Forest multivariate anomaly engine.
          </p>
        </div>

        <ShimmerButton
          onClick={handleRetrain}
          disabled={training}
          variant="primary"
          size="md"
        >
          <RefreshCw size={13} className={training ? "animate-spin text-cyan-400" : ""} />
          {training ? "Fitting Trees..." : "Retrain on Synthetic Baseline"}
        </ShimmerButton>
      </div>

      {trainMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-mono text-emerald-400 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <CheckCircle2 size={14} />
          {trainMessage}
        </div>
      )}

      {/* Model Specs KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SpotlightCard className="p-4 border-line bg-panel artifact-corner" contentClassName="space-y-1">
          <span className="text-3xs font-mono uppercase text-dim block tracking-wider">Algorithm</span>
          <span className="text-sm font-mono font-bold text-paper block">Isolation Forest</span>
          <span className="text-3xs font-mono text-dim">Tree Partitioning (Ensemble)</span>
        </SpotlightCard>

        <SpotlightCard className="p-4 border-line bg-panel artifact-corner" contentClassName="space-y-1">
          <span className="text-3xs font-mono uppercase text-dim block tracking-wider">Model Version</span>
          <span className="text-sm font-mono font-bold text-signal-cyan block">
            {model?.model_version || "isolation_forest_v1.0"}
          </span>
          <span className="text-3xs font-mono text-dim">Joblib Persistent Pipeline</span>
        </SpotlightCard>

        <SpotlightCard className="p-4 border-line bg-panel artifact-corner" contentClassName="space-y-1">
          <span className="text-3xs font-mono uppercase text-dim block tracking-wider">Training Samples</span>
          <span className="text-2xl font-mono font-bold text-paper">
            {model?.training_sample_count?.toLocaleString() || 180}
          </span>
          <span className="text-3xs font-mono text-dim block">Synthetic Indian UPI Baseline</span>
        </SpotlightCard>

        <SpotlightCard className="p-4 border-line bg-panel artifact-corner" contentClassName="space-y-1">
          <span className="text-3xs font-mono uppercase text-dim block tracking-wider">Contamination Rate</span>
          <span className="text-2xl font-mono font-bold text-burnished-amber">
            {(model?.contamination_rate || 0.08) * 100}%
          </span>
          <span className="text-3xs font-mono text-dim block">Expected Outlier Ratio</span>
        </SpotlightCard>
      </div>

      {/* Feature Architecture Matrix */}
      <SpotlightCard className="p-5 border-white/[0.08] space-y-4 tactical-corner">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-cyan-400" />
            <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
              Feature Vector Architecture ({model?.features_used?.length || 17} Parameters)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Normalized with RobustScaler</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(model?.features_used || Object.keys(FEATURE_DESCRIPTIONS)).map((feat, idx) => (
            <div key={feat} className="p-3 bg-black/40 border border-white/[0.06] rounded-lg space-y-1 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-white flex items-center gap-1.5">
                  <span className="text-[10px] text-cyan-400">#{idx + 1}</span> {feat}
                </span>
                <span className="text-[10px] font-mono text-cyan-400 uppercase">Numeric</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                {FEATURE_DESCRIPTIONS[feat] || "Continuous multivariate statistical parameter."}
              </p>
            </div>
          ))}
        </div>
      </SpotlightCard>

      {/* Methodology & Explainability Policy */}
      <SpotlightCard className="p-5 border-white/[0.08] space-y-3 text-xs font-sans tactical-corner">
        <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-300">
          Explainability & Guardrail Architecture
        </h3>
        <p className="text-slate-300 leading-relaxed">
          The Isolation Forest model isolates anomalies by randomly selecting a feature and splitting the value. Because
          anomalies require fewer splits to isolate, their path lengths in the trees are substantially shorter. This yields
          an unsupervised statistical distance score normalized between 0 and 100.
        </p>
        <p className="text-slate-400 leading-relaxed text-[11px] font-mono bg-black/40 p-3 rounded-lg border border-white/[0.06]">
          COMPLIANCE NOTICE: Anomaly scores are combined 40% with 60% deterministic rule contributions to produce the final
          triage score. Neither the Isolation Forest nor the rule hits provide legal or definitive proof of criminal fraud;
          all scores serve exclusively as operational prioritization indicators for human risk analysts.
        </p>
      </SpotlightCard>
    </div>
  );
}
