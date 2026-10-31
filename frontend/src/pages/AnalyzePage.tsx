import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, ArrowRight, X, Info, AlertTriangle, FileText, Fingerprint
} from "lucide-react";
import { EntityPanel } from "../components/EntityPanel";
import { ErrorBanner } from "../components/ErrorBanner";
import { ProcessingOverlay } from "../components/ProcessingOverlay";
import { SignalCard } from "../components/SignalCard";
import { RiskComposition } from "../components/RiskComposition";
import { EvidenceDocument } from "../components/EvidenceDocument";
import { SpotlightCard, TacticalBadge, ShimmerButton } from "../components/ui";
import { useToast } from "../components/Toast";
import { api } from "../services/api";
import { ApiError, type AdvertisementDetail } from "../types/api";

const SOURCE_CHANNELS = [
  { value: "",           label: "Select source channel…" },
  { value: "social",     label: "Social media" },
  { value: "messaging",  label: "Messaging app" },
  { value: "website",    label: "Website / landing page" },
  { value: "sms",        label: "SMS / text message" },
  { value: "email",      label: "Email" },
  { value: "print_scan", label: "Print scan / photograph" },
  { value: "other",      label: "Other" },
];

const INTAKE_STEPS = [
  { n: "01", title: "Record", body: "Submitted text and optional image are retained as an evidence artifact." },
  { n: "02", title: "Extract", body: "Observable identifiers and configured phrases are extracted from submitted content." },
  { n: "03", title: "Triage", body: "Configured rules compose an explainable score; this is not a fraud probability." },
  { n: "04", title: "Relate", body: "Stored evidence is compared for shared identifiers and conservative text similarity." },
];

export function AnalyzePage() {
  const toast    = useToast();
  const navigate = useNavigate();
  const resultRef = useRef<HTMLDivElement>(null);

  const [text,      setText]      = useState("");
  const [source,    setSource]    = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file,      setFile]      = useState<File | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [result,    setResult]    = useState<AdvertisementDetail | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() && !file) {
      setError("Provide advertisement text or an image file.");
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.set("text", text);
    form.set("source", source);
    form.set("source_url", sourceUrl);
    if (file) form.set("image", file);

    try {
      const analysis = await api.analyze(form);
      setResult(analysis);
      toast("Analysis completed and stored.");
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Analysis failed. Check connection and retry.";
      setError(message);
      toast(message, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div>
        <p className="eyebrow">Evidence Observatory</p>
        <h1 className="display-face mt-2 text-3xl text-paper">Evidence Intake</h1>
        <p className="mt-2 text-sm text-sub leading-relaxed max-w-xl">
          Submit advertisement content for rule-based risk assessment.
          URLs are recorded as text only — they are never fetched.
        </p>
      </div>

      {/* ── Form + Integrity Panel ───────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">

        {/* Form */}
        <form
          onSubmit={onSubmit}
          aria-label="Advertisement analysis form"
          className="dossier-panel artifact-corner space-y-5 p-5"
        >
          <div className="flex items-center gap-2 border-b border-line pb-4">
            <Fingerprint size={16} className="text-accent shrink-0" />
            <div>
              <p className="text-sm font-semibold text-paper">Evidence submission</p>
              <p className="text-2xs text-sub">Complete the intake form below.</p>
            </div>
          </div>

          {/* Text input */}
          <div>
            <label htmlFor="ad-text" className="block text-2xs font-semibold uppercase tracking-[.08em] text-sub mb-2">
              Advertisement text
              <span className="ml-2 normal-case font-normal tracking-normal text-dim">(required if no image)</span>
            </label>
            <textarea
              id="ad-text"
              className="h-36 w-full border border-line bg-bg px-4 py-3 text-sm text-paper placeholder:text-dim outline-none evidence-mono resize-y transition-colors focus:border-accent/60 focus:ring-1 focus:ring-accent/20"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste advertisement copy — include claimed returns, contact numbers, payment handles, and URLs."
              aria-describedby="ad-text-hint"
            />
            <p id="ad-text-hint" className="mt-1 text-2xs text-dim">
              Include the full text of the advertisement as it appears. Do not paraphrase.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Source channel */}
            <div>
              <label htmlFor="source-channel" className="block text-2xs font-semibold uppercase tracking-[.08em] text-sub mb-2">
                Source channel
              </label>
              <select
                id="source-channel"
                className="w-full border border-line bg-bg px-3 py-2.5 text-sm text-paper outline-none focus:border-accent/60 transition-colors"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {SOURCE_CHANNELS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-panel">{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Reference URL */}
            <div>
              <label htmlFor="source-url" className="block text-2xs font-semibold uppercase tracking-[.08em] text-sub mb-2">
                Reference URL
                <span className="ml-2 normal-case font-normal tracking-normal text-dim">(optional — not fetched)</span>
              </label>
              <input
                id="source-url"
                type="text"
                className="w-full border border-line bg-bg px-3 py-2.5 text-sm text-paper placeholder:text-dim outline-none focus:border-accent/60 transition-colors"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/ad"
                aria-describedby="url-hint"
              />
              <p id="url-hint" className="mt-1 text-2xs text-dim">For record purposes only. Never retrieved.</p>
            </div>
          </div>

          {/* Image upload dropzone */}
          <div>
            <p className="block text-2xs font-semibold uppercase tracking-[.08em] text-sub mb-2">
              Advertisement image
              <span className="ml-2 normal-case font-normal tracking-normal text-dim">(optional, PNG / JPEG / WebP, max 5 MB)</span>
            </p>
            {file ? (
              <div className="flex items-center gap-3 border border-line bg-surface px-4 py-3">
                <FileText size={14} className="text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-paper truncate">{file.name}</p>
                  <p className="text-2xs text-dim">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-dim hover:text-paper transition-colors p-1"
                  aria-label="Remove selected image"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="intake-zone flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2.5 text-sm text-sub">
                <Upload size={18} className="text-dim" aria-hidden="true" />
                <span className="text-xs">Drop evidence file here or click to select</span>
                <span className="text-2xs text-dim">PNG · JPEG · WebP · max 5 MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  aria-label="Upload advertisement image"
                />
              </label>
            )}
            <p className="mt-1.5 flex items-center gap-1 text-2xs text-dim">
              <Info size={10} className="shrink-0" />
              OCR is applied only if a local OCR engine is configured on the server.
            </p>
          </div>

          {error && <ErrorBanner message={error} />}

          <div className="flex items-center gap-3 border-t border-white/[0.08] pt-4">
            <ShimmerButton
              type="submit"
              disabled={busy}
              variant="primary"
              size="lg"
            >
              {busy ? "Evaluating Evidence..." : "Run Forensic Analysis"}
            </ShimmerButton>
            {result && !busy && (
              <TacticalBadge level="NOMINAL" text="Analysis Complete" />
            )}
          </div>
        </form>

        {/* Intake integrity panel */}
        <SpotlightCard className="h-fit p-5 border-white/[0.08] tactical-corner" aria-label="Intake integrity">
          <p className="eyebrow">Intake integrity</p>
          <h2 className="mt-2 text-base font-semibold text-paper font-mono">What happens next</h2>
          <ol className="mt-5 space-y-4 border-l border-white/[0.08] pl-4">
            {INTAKE_STEPS.map((step) => (
              <li key={step.n} className="text-xs leading-relaxed text-sub">
                <strong className="block text-paper font-semibold evidence-mono mb-0.5">
                  {step.n} / {step.title}
                </strong>
                {step.body}
              </li>
            ))}
          </ol>
          <div className="mt-5 border-t border-white/[0.08] pt-4 space-y-2 text-2xs text-dim leading-relaxed font-mono">
            <p>URLs are recorded as text only and are never fetched.</p>
            <p>OCR only runs if a local server capability is configured.</p>
            <p>No content is sent to external AI services without explicit configuration.</p>
          </div>
        </SpotlightCard>
      </div>

      {busy && <ProcessingOverlay />}

      {/* ── Results ─────────────────────────────────────────────── */}
      {result && (
        <div ref={resultRef} className="space-y-5 animate-fade-in" aria-label="Analysis results">

          {/* Caveat */}
          <div className="flex items-start gap-3 border border-warn/25 bg-warn/[0.05] px-4 py-3.5" role="note">
            <AlertTriangle size={14} className="mt-px shrink-0 text-warn" />
            <div>
              <p className="text-xs font-semibold text-paper mb-0.5">Methodology notice</p>
              <p className="text-xs leading-relaxed text-paper/70">
                The score below is a configured rules-based triage signal. A high score indicates risk indicators
                warranting review — it does not establish that any crime has been committed.
              </p>
            </div>
          </div>

          {/* Score + Guidance */}
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            <RiskComposition score={result.risk_score} category={result.risk_category} signals={result.signals} />
            {result.recommendation && (
              <div className="dossier-panel p-5">
                <p className="eyebrow mb-2">Investigative guidance</p>
                <p className="text-sm leading-relaxed text-paper/80">{result.recommendation}</p>
              </div>
            )}
          </div>

          {/* Signals + Entities */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-labelledby="signals-heading">
              <div className="flex items-baseline justify-between mb-3">
                <h2 id="signals-heading" className="text-sm font-semibold text-paper">Risk indicators</h2>
                <span className="text-2xs text-sub">{result.signals.length} detected</span>
              </div>
              {result.signals.length === 0 ? (
                <div className="border border-line bg-panel px-4 py-6 text-center">
                  <p className="text-sm text-sub">No elevated rule-based indicators detected.</p>
                  <p className="text-xs text-dim mt-1">Absence of indicators does not confirm the advertisement is legitimate.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {result.signals.map((signal) => (
                    <SignalCard key={signal.id} signal={signal} />
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="entities-heading">
              <div className="flex items-baseline justify-between mb-3">
                <h2 id="entities-heading" className="text-sm font-semibold text-paper">Extracted entities</h2>
                <span className="text-2xs text-sub">{result.entities.length} found</span>
              </div>
              <div className="border border-line bg-panel px-4 py-3">
                <EntityPanel entities={result.entities} />
              </div>
            </section>
          </div>

          <EvidenceDocument text={result.text} entities={result.entities} signals={result.signals} />

          {/* Navigate to full investigation */}
          <div className="flex items-center justify-between border border-line bg-panel px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-paper">Investigation record created</p>
              <p className="text-xs text-sub mt-0.5">
                This analysis has been stored. Open the full record to review related advertisements.
              </p>
            </div>
            <button
              type="button"
              className="flex shrink-0 items-center gap-2 border border-accent/30 bg-accent/[0.07] px-5 py-2.5 text-sm font-semibold text-accent hover:bg-accent/[0.14] transition-colors"
              onClick={() => navigate(`/investigations/${result.id}`)}
            >
              Open investigation
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
