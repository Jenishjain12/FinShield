import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Cpu,
  RefreshCw,
  BarChart3,
  Layers,
  ShieldCheck,
  Zap,
  TrendingUp,
  Activity,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { SpotlightCard, TacticalBadge, ShimmerButton } from "../components/ui";
import { api } from "../services/api";
import type { ModelTelemetry, ModelEvaluationData } from "../types/api";

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
  const [evalData, setEvalData] = useState<ModelEvaluationData | null>(null);
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

  const fetchEval = async () => {
    try {
      const res = await api.modelEvaluation();
      if (res && res.model_comparison) {
        setEvalData(res);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchModel();
    fetchEval();
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

      {/* Two-Layer Explainability Architecture */}
      <SpotlightCard className="p-5 border-line bg-panel artifact-corner space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-signal-cyan" />
            <h2 className="text-sm font-bold font-mono text-paper uppercase tracking-wider">
              Dual-Layer Explainability Engine Architecture
            </h2>
          </div>
          <span className="text-3xs font-mono text-dim">Transparent + Statistical</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Layer 1: Deterministic Rules */}
          <div className="p-4 bg-surface/50 border border-line rounded space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-burnished-amber flex items-center gap-1.5">
                <ShieldCheck size={14} />
                Layer 1: Deterministic Policy Rules
              </span>
              <span className="px-2 py-0.5 rounded text-3xs font-mono bg-burnished-amber/10 text-burnished-amber font-semibold">
                60% Weight
              </span>
            </div>
            <p className="text-xs text-sub font-sans leading-relaxed">
              Domain-authored financial intelligence rules evaluating known UPI attack vectors
              (phishing VPAs, collect scam requests, rapid pass-through velocity, and device sharing).
              Produces exact contribution points and observable case evidence.
            </p>
            <div className="pt-2 border-t border-line/40 text-3xs font-mono text-dim flex items-center justify-between">
              <span>Attribution Type: Exact Rule ID</span>
              <span className="text-paper">Zero Ambiguity</span>
            </div>
          </div>

          {/* Layer 2: Statistical Anomaly Deviations */}
          <div className="p-4 bg-surface/50 border border-line rounded space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-signal-cyan flex items-center gap-1.5">
                <Activity size={14} />
                Layer 2: Statistical Anomaly Deviations
              </span>
              <span className="px-2 py-0.5 rounded text-3xs font-mono bg-signal-cyan/10 text-signal-cyan font-semibold">
                40% Weight
              </span>
            </div>
            <p className="text-xs text-sub font-sans leading-relaxed">
              Unsupervised Isolation Forest measuring multivariate statistical distance. When an anomaly
              is flagged, the pipeline calculates empirical deviation z-scores:
              <code className="text-signal-cyan px-1 bg-panel border border-line rounded ml-1">
                z = (x - median) / IQR
              </code>
              against fitted customer baselines.
            </p>
            <div className="pt-2 border-t border-line/40 text-3xs font-mono text-dim flex items-center justify-between">
              <span>Attribution Type: Robust Z-Score Bar</span>
              <span className="text-paper">Generalizes to Zero-Days</span>
            </div>
          </div>
        </div>
      </SpotlightCard>

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

      {/* ── Offline Evaluation & Benchmarks Suite (Task 3) ──────────── */}
      {evalData && (
        <div className="space-y-6 pt-4 border-t border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-3xs font-mono bg-signal-cyan/10 text-signal-cyan border border-signal-cyan/30 uppercase font-bold">
                  Benchmarking Observatory
                </span>
                <span className="text-3xs font-mono text-dim">
                  n = {evalData.metadata.n_samples.toLocaleString()} Transactions • Seed {evalData.metadata.seed}
                </span>
              </div>
              <h2 className="text-lg font-bold font-mono text-paper mt-1">
                Empirical Evaluation: Isolation Forest, Rules, Blend & XGBoost
              </h2>
            </div>
            <span className="text-3xs font-mono text-dim">
              Evaluated: {new Date(evalData.metadata.evaluation_date).toLocaleDateString()}
            </span>
          </div>

          {/* Model Comparison Table */}
          <SpotlightCard className="p-5 border-line bg-panel artifact-corner space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-dim flex items-center gap-2">
              <BarChart3 size={14} className="text-signal-cyan" />
              Multi-Model Test Metric Matrix (30% Stratified Holdout)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-line text-dim text-3xs uppercase">
                    <th className="py-2.5 px-3">Detector Architecture</th>
                    <th className="py-2.5 px-3 text-right">ROC-AUC</th>
                    <th className="py-2.5 px-3 text-right">PR-AUC</th>
                    <th className="py-2.5 px-3 text-right">Prec @ 5%</th>
                    <th className="py-2.5 px-3 text-right">Recall @ 5%</th>
                    <th className="py-2.5 px-3 text-right">Prec @ 10%</th>
                    <th className="py-2.5 px-3 text-right">Recall @ 10%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {evalData.model_comparison.map((row, idx) => {
                    const isBlend = row.model.includes("Blend");
                    const isXgb = row.model.includes("XGBoost");

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-surface/50 transition-colors ${
                          isBlend ? "bg-signal-cyan/[0.04]" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-paper flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isBlend
                                ? "bg-signal-cyan"
                                : isXgb
                                ? "bg-burnished-amber"
                                : "bg-dim"
                            }`}
                          />
                          {row.model}
                          {isBlend && (
                            <span className="text-3xs text-signal-cyan font-bold uppercase ml-1">
                              (Production)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-signal-cyan">
                          {row.roc_auc.toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-paper">
                          {row.pr_auc.toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sub">
                          {(row.precision_at_5 * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-sub">
                          {(row.recall_at_5 * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-paper">
                          {(row.precision_at_10 * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-paper">
                          {(row.recall_at_10 * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SpotlightCard>

          {/* Leave-One-Typology-Out Zero-Day Experiment */}
          <SpotlightCard className="p-5 border-line bg-panel artifact-corner space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-paper font-semibold flex items-center gap-2">
                  <TrendingUp size={14} className="text-signal-red" />
                  Leave-One-Typology-Out Zero-Day Generalization
                </h3>
                <p className="text-3xs font-mono text-dim mt-0.5">
                  XGBoost trained excluding each attack vector vs Unsupervised Isolation Forest & Blend
                </p>
              </div>
              <span className="text-3xs font-mono text-dim">Generalization Test</span>
            </div>

            {/* Recharts Zero-Day Chart */}
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={evalData.leave_one_typology_out.map((lo) => ({
                    typology: lo.unseen_typology.replace("_", " "),
                    "Hybrid Blend": Math.round(lo.blend_recall * 100),
                    "Isolation Forest": Math.round(lo.isolation_forest_recall * 100),
                    "XGBoost (Zero-Day)": Math.round(lo.xgboost_zero_day_recall * 100),
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(181, 211, 218, 0.1)" />
                  <XAxis
                    dataKey="typology"
                    tick={{ fill: "#74828B", fontSize: 10, fontFamily: "DM Mono" }}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis
                    unit="%"
                    tick={{ fill: "#74828B", fontSize: 10, fontFamily: "DM Mono" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0C1219",
                      borderColor: "rgba(181, 211, 218, 0.2)",
                      fontFamily: "DM Mono",
                      fontSize: 11,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: "DM Mono", paddingTop: 8 }}
                  />
                  <Bar dataKey="Hybrid Blend" fill="#58C7D9" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Isolation Forest" fill="#D9A34C" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="XGBoost (Zero-Day)" fill="#B9383A" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Zero Day Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-line text-dim text-3xs uppercase">
                    <th className="py-2 px-3">Unseen Fraud Typology</th>
                    <th className="py-2 px-3 text-center">Cases</th>
                    <th className="py-2 px-3 text-right">XGBoost (Zero-Day)</th>
                    <th className="py-2 px-3 text-right">Isolation Forest</th>
                    <th className="py-2 px-3 text-right">Hybrid Blend</th>
                    <th className="py-2 px-3 text-right">Unsupervised Advantage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40 text-xs">
                  {evalData.leave_one_typology_out.map((lo, idx) => (
                    <tr key={idx} className="hover:bg-surface/50">
                      <td className="py-2 px-3 text-paper font-semibold">
                        <code>{lo.unseen_typology}</code>
                      </td>
                      <td className="py-2 px-3 text-center text-dim">{lo.test_cases}</td>
                      <td className="py-2 px-3 text-right text-signal-red">
                        {(lo.xgboost_zero_day_recall * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-right text-burnished-amber">
                        {(lo.isolation_forest_recall * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-signal-cyan">
                        {(lo.blend_recall * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        <span
                          className={
                            lo.unsupervised_advantage >= 0
                              ? "text-mineral-green"
                              : "text-dim"
                          }
                        >
                          {lo.unsupervised_advantage >= 0 ? "+" : ""}
                          {(lo.unsupervised_advantage * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SpotlightCard>

          {/* Sweeps & Ablation Grid (2 columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Blend Sensitivity Calibration */}
            <SpotlightCard className="p-4 border-line bg-panel artifact-corner space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-dim flex items-center gap-1.5">
                <Zap size={13} className="text-signal-cyan" />
                Blend Calibration Sensitivity
              </h4>
              <div className="space-y-1.5 text-xs font-mono">
                {evalData.parameter_sweeps.blend_weight_sweep.map((b, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded border ${
                      b.ml_weight === 0.4
                        ? "bg-signal-cyan/10 border-signal-cyan/30 text-paper font-semibold"
                        : "bg-surface/30 border-line text-sub"
                    }`}
                  >
                    <span>
                      {b.ml_weight * 100}% ML / {b.rule_weight * 100}% Rules
                      {b.ml_weight === 0.4 && " (Production)"}
                    </span>
                    <span>ROC: {b.roc_auc.toFixed(4)} • Rec: {(b.recall_at_10 * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </SpotlightCard>

            {/* Feature Ablation */}
            <SpotlightCard className="p-4 border-line bg-panel artifact-corner space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-dim flex items-center gap-1.5">
                <Layers size={13} className="text-signal-cyan" />
                Feature Ablation Impact
              </h4>
              <div className="space-y-1.5 text-xs font-mono">
                {evalData.feature_ablation.map((a, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded border bg-surface/30 border-line text-sub"
                  >
                    <span className="truncate pr-2">{a.feature_set}</span>
                    <span className="text-paper shrink-0">
                      Rec: {(a.recall_at_10 * 100).toFixed(1)}% (
                      <span className={a.delta_recall_vs_baseline < 0 ? "text-signal-red" : "text-mineral-green"}>
                        {a.delta_recall_vs_baseline >= 0 ? "+" : ""}
                        {(a.delta_recall_vs_baseline * 100).toFixed(1)}%
                      </span>
                      )
                    </span>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </div>

          {/* Leakage Risk & Methodology Disclosures */}
          <div className="p-4 bg-surface/40 border border-line rounded space-y-2 text-xs font-mono text-dim">
            <div className="flex items-center gap-2 text-burnished-amber font-semibold">
              <Info size={14} />
              Methodological Rigor & Synthetic Leakage Disclosure
            </div>
            <p className="leading-relaxed">
              {evalData.methodology_disclosures.leakage_risk_statement}
            </p>
            <p className="leading-relaxed pt-1 border-t border-line/40">
              {evalData.methodology_disclosures.zero_day_generalization}
            </p>
          </div>
        </div>
      )}

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
