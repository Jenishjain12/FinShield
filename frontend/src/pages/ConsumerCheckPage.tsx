import { useState, useEffect } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  Lock,
  RefreshCw,
  Sliders,
  ExternalLink,
  ChevronDown,
  Info,
  Sparkles,
} from "lucide-react";
import { SpotlightCard, ShimmerButton } from "../components/ui";
import { api } from "../services/api";
import type { ConsumerAdviceResponse, ConsumerCheckRequest, TransactionSummary } from "../types/api";

const PRESETS: Array<{
  name: string;
  desc: string;
  data: ConsumerCheckRequest;
}> = [
  {
    name: "Fake Collect Request (Scam)",
    desc: "Collect request pretending to refund electricity bill",
    data: {
      amount: 9999,
      sender_upi_handle: "payer@oksbi",
      receiver_upi_handle: "electricity.refund.desk@paytm",
      channel: "collect_request",
      transaction_type: "collect",
      reference_note: "Electricity Bill Disconnection Avoid Fast Refund",
      synthetic_geo_region: "Mumbai, MH",
    },
  },
  {
    name: "Phishing UPI Handle (High Risk)",
    desc: "Deceptive official-looking VPA claiming KYC fee",
    data: {
      amount: 14500,
      sender_upi_handle: "payer@okhdfcbank",
      receiver_upi_handle: "sbi.kyc.verification@paytm",
      channel: "web_portal",
      transaction_type: "pay",
      reference_note: "KYC Verification Token Deposit",
      synthetic_geo_region: "Delhi, DL",
    },
  },
  {
    name: "Normal Grocery Payment (Safe)",
    desc: "Standard daily purchase at neighborhood store",
    data: {
      amount: 450,
      sender_upi_handle: "payer@oksbi",
      receiver_upi_handle: "kirana.store@okaxis",
      channel: "upi_app",
      transaction_type: "pay",
      reference_note: "Weekly groceries and milk",
      synthetic_geo_region: "Bengaluru, KA",
    },
  },
];

export function ConsumerCheckPage() {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [recentTransactions, setRecentTransactions] = useState<TransactionSummary[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string>("");
  const [evaluating, setEvaluating] = useState(false);
  const [advice, setAdvice] = useState<ConsumerAdviceResponse | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // What-If Custom Form State
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [formData, setFormData] = useState<ConsumerCheckRequest>(PRESETS[0].data);

  // Load initial preset on mount and fetch recent transactions for picker
  useEffect(() => {
    runCheck(PRESETS[0].data, lang);
    api.transactions({ page_size: 15 }).then((res) => {
      setRecentTransactions(res.items || []);
    }).catch(() => {});
  }, []);

  // Re-run check when language toggles
  useEffect(() => {
    if (selectedTxId) {
      loadTransactionAdvice(selectedTxId, lang);
    } else {
      runCheck(formData, lang);
    }
  }, [lang]);

  const runCheck = async (payload: ConsumerCheckRequest, l: "en" | "hi") => {
    setEvaluating(true);
    try {
      const res = await api.consumerCheck(payload, l);
      setAdvice(res);
      setSelectedTxId("");
    } catch (err: any) {
      showToast(err?.message || "Failed to analyze payer risk");
    } finally {
      setEvaluating(false);
    }
  };

  const loadTransactionAdvice = async (txId: string, l: "en" | "hi") => {
    setEvaluating(true);
    try {
      const res = await api.consumerAdvice(txId, l);
      setAdvice(res);
      setSelectedTxId(txId);
    } catch (err: any) {
      showToast(err?.message || "Failed to load advice for transaction");
    } finally {
      setEvaluating(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setFormData(preset.data);
    runCheck(preset.data, lang);
  };

  const isDecline = advice?.verdict === "DONT_APPROVE";
  const isCareful = advice?.verdict === "BE_CAREFUL";

  const bannerBg = isDecline
    ? "bg-signal-red/15 border-signal-red/30 text-signal-red"
    : isCareful
    ? "bg-burnished-amber/15 border-burnished-amber/30 text-burnished-amber"
    : "bg-mineral-green/15 border-mineral-green/30 text-mineral-green";

  const bannerIcon = isDecline ? (
    <ShieldAlert size={28} className="text-signal-red shrink-0 animate-pulse" />
  ) : isCareful ? (
    <AlertTriangle size={28} className="text-burnished-amber shrink-0" />
  ) : (
    <CheckCircle2 size={28} className="text-mineral-green shrink-0" />
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 animate-fade-in">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-3xs font-mono bg-signal-cyan/15 text-signal-cyan border border-signal-cyan/30 uppercase font-semibold">
              Consumer Protection Shield
            </span>
            <span className="text-3xs font-mono text-dim">Bilingual (English / हिंदी)</span>
          </div>
          <h1 className="text-2xl font-bold font-mono text-paper mt-1">
            Payer Verification & Fraud Warning Screen
          </h1>
          <p className="text-xs text-sub font-mono mt-0.5">
            Real-time advisory screen shown to payers before entering their UPI PIN.
          </p>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center gap-2 bg-panel border border-line p-1 rounded-sm">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
              lang === "en"
                ? "bg-signal-cyan text-ink-950 font-bold"
                : "text-dim hover:text-paper"
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang("hi")}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
              lang === "hi"
                ? "bg-signal-cyan text-ink-950 font-bold"
                : "text-dim hover:text-paper"
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* ── Main Two-Column Layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Controls, Presets & What-If Form (5 cols) ──── */}
        <div className="lg:col-span-5 space-y-5">
          {/* Quick Attack Presets */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-mono uppercase tracking-wider text-dim flex items-center gap-2">
              <Sparkles size={13} className="text-signal-cyan" />
              1-Click Demo Scenarios
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(p)}
                  className="w-full text-left p-3 rounded-sm border border-line bg-panel hover:bg-surface hover:border-line-hover transition-all text-xs font-mono group"
                >
                  <div className="flex items-center justify-between font-semibold text-paper group-hover:text-signal-cyan">
                    <span>{p.name}</span>
                    <span className="text-3xs text-dim">₹{p.data.amount}</span>
                  </div>
                  <div className="text-3xs text-sub mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Historical Transaction Selector */}
          <SpotlightCard className="p-4 border-line bg-panel artifact-corner space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-dim flex items-center gap-2">
              <RefreshCw size={13} className="text-signal-cyan" />
              Inspect Stored Transactions
            </h3>
            <select
              value={selectedTxId}
              onChange={(e) => {
                if (e.target.value) loadTransactionAdvice(e.target.value, lang);
              }}
              className="w-full p-2 bg-surface border border-line rounded text-xs font-mono text-paper focus:outline-none focus:border-signal-cyan"
            >
              <option value="">-- Select from recent monitor queue --</option>
              {recentTransactions.map((tx) => (
                <option key={tx.transaction_id} value={tx.transaction_id}>
                  ₹{tx.amount.toLocaleString()} • {tx.receiver_upi_handle} ({tx.risk_category})
                </option>
              ))}
            </select>
          </SpotlightCard>

          {/* Interactive What-If Simulation Accordion */}
          <SpotlightCard className="p-4 border-line bg-panel artifact-corner space-y-3">
            <button
              type="button"
              onClick={() => setShowWhatIf((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-mono text-paper uppercase tracking-wider font-semibold"
            >
              <span className="flex items-center gap-2">
                <Sliders size={13} className="text-signal-cyan" />
                Custom What-If Check Form
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showWhatIf ? "rotate-180" : ""}`}
              />
            </button>

            {showWhatIf && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runCheck(formData, lang);
                }}
                className="space-y-3 pt-2 text-xs font-mono border-t border-line/60"
              >
                <div>
                  <label className="text-3xs text-dim block uppercase mb-1">
                    Amount (₹ INR)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full p-2 bg-surface border border-line rounded text-paper font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-3xs text-dim block uppercase mb-1">
                    Payee / Receiver UPI ID
                  </label>
                  <input
                    type="text"
                    value={formData.receiver_upi_handle}
                    onChange={(e) =>
                      setFormData({ ...formData, receiver_upi_handle: e.target.value })
                    }
                    className="w-full p-2 bg-surface border border-line rounded text-paper font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-3xs text-dim block uppercase mb-1">
                      Type
                    </label>
                    <select
                      value={formData.transaction_type}
                      onChange={(e) =>
                        setFormData({ ...formData, transaction_type: e.target.value })
                      }
                      className="w-full p-2 bg-surface border border-line rounded text-paper font-mono"
                    >
                      <option value="pay">Pay (Debit)</option>
                      <option value="collect">Collect (Request)</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-3xs text-dim block uppercase mb-1">
                      Channel
                    </label>
                    <select
                      value={formData.channel}
                      onChange={(e) =>
                        setFormData({ ...formData, channel: e.target.value })
                      }
                      className="w-full p-2 bg-surface border border-line rounded text-paper font-mono"
                    >
                      <option value="upi_app">UPI App</option>
                      <option value="collect_request">Collect Request</option>
                      <option value="web_portal">Web Portal</option>
                      <option value="qr_code">QR Code</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-3xs text-dim block uppercase mb-1">
                    Payment Note / Description
                  </label>
                  <input
                    type="text"
                    value={formData.reference_note || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, reference_note: e.target.value })
                    }
                    placeholder="e.g. Electricity Bill Refund"
                    className="w-full p-2 bg-surface border border-line rounded text-paper font-mono"
                  />
                </div>

                <ShimmerButton
                  type="submit"
                  disabled={evaluating}
                  className="w-full py-2 text-xs font-mono font-semibold"
                >
                  {evaluating ? "Evaluating Risk Pipeline…" : "Run Real-Time Pre-Check"}
                </ShimmerButton>
              </form>
            )}
          </SpotlightCard>

          {/* Legal / Regulatory Non-Verdict Disclaimer */}
          <div className="p-3 bg-surface/40 border border-line rounded text-3xs font-mono text-dim space-y-1">
            <div className="flex items-center gap-1.5 text-burnished-amber font-semibold">
              <Info size={12} />
              Investigation Aid Disclaimer
            </div>
            <p>
              FIN-SHIELD advice is an automated real-time heuristic indicator. It does not replace
              bank authorization or constitute a legal verdict. Synthetic demo data.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Mobile-First UPI Payer Screen (7 cols) ───── */}
        <div className="lg:col-span-7 flex justify-center">
          {/* Simulated Mobile Device Frame */}
          <div className="w-full max-w-[420px] rounded-2xl border-2 border-line bg-ink-950 shadow-modal overflow-hidden text-paper flex flex-col relative transition-all">
            {/* Phone Top Status Bar */}
            <div className="px-4 py-2 bg-ink-900 border-b border-line flex items-center justify-between text-3xs font-mono text-dim">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-mineral-green" />
                <span>UPI SAFEGUARD 2.0</span>
              </div>
            </div>

            {/* Payer Request Header */}
            <div className="p-5 bg-panel border-b border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xs font-mono text-dim uppercase">
                  {lang === "hi" ? "भुगतान अनुरोध" : "Incoming Payment Request"}
                </span>
                <span className="px-2 py-0.5 rounded text-3xs font-mono bg-surface border border-line text-sub">
                  {advice?.evidence?.risk_category || "EVALUATING"} RISK
                </span>
              </div>

              <div className="space-y-1 text-center py-1">
                <div className="text-3xs font-mono text-dim uppercase tracking-wider">
                  {lang === "hi" ? "अनुरोधित राशि" : "Requested Amount"}
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-paper tracking-tight">
                  ₹{advice ? advice.evidence.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
                </div>
              </div>

              {/* Payee Info Box */}
              <div className="p-3 bg-surface/70 border border-line rounded space-y-1 text-xs font-mono">
                <div className="text-3xs text-dim uppercase">
                  {lang === "hi" ? "प्राप्तकर्ता यूपीआई आईडी" : "Payee UPI Identifier"}
                </div>
                <div className="text-sm font-semibold text-signal-cyan break-all">
                  {advice?.evidence?.receiver_handle || formData.receiver_upi_handle}
                </div>
                {formData.reference_note && (
                  <div className="text-2xs text-sub pt-1 border-t border-line/40">
                    <span className="text-dim">{lang === "hi" ? "टिप्पणी: " : "Note: "}</span>
                    "{formData.reference_note}"
                  </div>
                )}
              </div>
            </div>

            {/* Simulated Live Advisory Body */}
            <div className="p-5 space-y-4 flex-1">
              {/* Verdict Banner */}
              <div className={`p-4 rounded border flex items-start gap-3 ${bannerBg}`}>
                {bannerIcon}
                <div className="space-y-1 min-w-0">
                  <div className="text-3xs font-mono uppercase font-bold tracking-wider opacity-80">
                    {lang === "hi" ? "सुरक्षा चेतावनी" : "FIN-SHIELD SAFETY NOTICE"}
                  </div>
                  <h3 className="text-sm font-bold font-sans leading-snug">
                    {advice?.headline || "Analyzing transaction security parameters…"}
                  </h3>
                </div>
              </div>

              {/* Reasons Section */}
              {advice && advice.reasons.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-3xs font-mono uppercase tracking-wider text-dim font-semibold">
                    {lang === "hi" ? "हम आपको चेतावनी क्यों दे रहे हैं" : "Why we are warning you"}
                  </h4>
                  <div className="space-y-1.5">
                    {advice.reasons.map((r, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-xs font-sans text-sub bg-surface/40 p-2.5 rounded border border-line/60"
                      >
                        <AlertTriangle size={13} className="text-burnished-amber shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Safe Guidance List */}
              {advice && advice.what_to_do.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-3xs font-mono uppercase tracking-wider text-dim font-semibold">
                    {lang === "hi" ? "अभी क्या करें" : "What you should do right now"}
                  </h4>
                  <div className="space-y-1.5">
                    {advice.what_to_do.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-xs font-sans text-paper/90 bg-ink-900 p-2.5 rounded border border-line"
                      >
                        <Lock size={13} className="text-signal-cyan shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* National Helpline Banner */}
              <div className="p-3 bg-panel border border-line rounded flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <PhoneCall size={14} className="text-signal-cyan" />
                  <div>
                    <span className="text-dim text-3xs block uppercase">Cybercrime Helpline</span>
                    <span className="font-bold text-signal-cyan">Call 1930 / cybercrime.gov.in</span>
                  </div>
                </div>
                <a
                  href="https://cybercrime.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="text-dim hover:text-paper"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>

            {/* Mobile Footer Action Buttons */}
            <div className="p-4 bg-ink-900 border-t border-line space-y-2.5">
              <button
                type="button"
                onClick={() =>
                  showToast(
                    lang === "hi"
                      ? "अनुरोध सफलतापूर्वक अस्वीकार किया गया। सुरक्षित रहने के लिए धन्यवाद!"
                      : "Request successfully declined. You protected your account!"
                  )
                }
                className="w-full py-3 px-4 bg-signal-red hover:bg-signal-red/90 text-white font-mono text-xs font-bold rounded shadow-lg transition-transform active:scale-95"
              >
                {lang === "hi" ? "अनुरोध अस्वीकार करें (अनुशंसित)" : "Decline Payment Request (Recommended)"}
              </button>

              <button
                type="button"
                onClick={() =>
                  showToast(
                    lang === "hi"
                      ? "चेतावनी: आप अपने जोखिम पर आगे बढ़ रहे हैं।"
                      : "Caution: Proceeding against security advisory recommendation."
                  )
                }
                className="w-full py-2 px-4 bg-surface hover:bg-overlay text-dim hover:text-sub font-mono text-3xs rounded border border-line transition-colors"
              >
                {lang === "hi" ? "मैं जोखिम समझता हूँ / आगे बढ़ें" : "I Understand the Risk / Proceed"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-panel border border-signal-cyan/50 text-paper font-mono text-xs rounded shadow-modal animate-slide-up flex items-center gap-3">
          <CheckCircle2 size={16} className="text-signal-cyan shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
