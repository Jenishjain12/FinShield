import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Square,
  Terminal,
  Zap,
} from "lucide-react";
import { SpotlightCard, NumberTicker, ShimmerButton, TacticalBadge } from "../components/ui";
import { api, API_BASE_URL } from "../services/api";
import type { StreamTelemetry } from "../types/api";

interface StreamEventItem {
  id: string;
  time: string;
  eventType: string;
  data: any;
}

export function StreamPage() {
  const [telemetry, setTelemetry] = useState<StreamTelemetry | null>(null);
  const [rate, setRate] = useState<number>(2.0);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<StreamEventItem[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastPulse, setLastPulse] = useState<number>(Date.now());

  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    try {
      const res = await api.streamStatus();
      setTelemetry(res);
      setRate(res.rate_per_second);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Connect to SSE event stream
  useEffect(() => {
    const sse = new EventSource(`${API_BASE_URL}/api/stream/events`);

    sse.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        const item: StreamEventItem = {
          id: Math.random().toString(36).substring(2, 9),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          eventType: payload?.event_type || "event",
          data: payload?.data || {},
        };
        setEvents((prev) => [item, ...prev.slice(0, 99)]);
        setLastPulse(Date.now());
      } catch {
        // ignore
      }
    };

    return () => {
      sse.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, autoScroll]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await api.streamStart(rate);
      setTelemetry(res);
    } catch (err: any) {
      alert("Failed to start stream: " + err?.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);
    try {
      const res = await api.streamPause();
      setTelemetry(res);
    } catch (err: any) {
      alert("Failed to pause stream: " + err?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      const res = await api.streamResume();
      setTelemetry(res);
    } catch (err: any) {
      alert("Failed to resume stream: " + err?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await api.streamStop();
      setTelemetry(res);
    } catch (err: any) {
      alert("Failed to stop stream: " + err?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset simulator telemetry counters to zero?")) return;
    setLoading(true);
    try {
      const res = await api.streamReset();
      setTelemetry(res);
      setEvents([]);
    } catch (err: any) {
      alert("Failed to reset stream: " + err?.message);
    } finally {
      setLoading(false);
    }
  };

  const isRunning = telemetry?.status === "running";
  const isPaused = telemetry?.status === "paused";
  const isStopped = !telemetry || telemetry?.status === "stopped";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-bold tracking-tight text-white">
              Transaction Stream Simulator
            </h1>
            <TacticalBadge
              level={isRunning ? "NOMINAL" : isPaused ? "HIGH" : "INFO"}
              text={telemetry?.status || "STOPPED"}
              pulse={isRunning}
            />
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Simulates realistic Indian digital-payment transaction flow with synthetic anomaly injections over an abstract event bus.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/transactions"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg border border-white/[0.1] bg-[#0E151C]/80 text-slate-300 hover:text-white hover:border-white/[0.2] transition-colors"
          >
            Transaction Monitor <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Control Console (Spotlight Card) */}
      <SpotlightCard className="p-5 border-line bg-panel artifact-corner">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {isRunning ? (
              <ShimmerButton
                disabled={loading}
                onClick={handlePause}
                variant="warning"
                size="md"
              >
                <Pause size={13} /> Pause Simulator
              </ShimmerButton>
            ) : isPaused ? (
              <ShimmerButton
                disabled={loading}
                onClick={handleResume}
                variant="primary"
                size="md"
              >
                <Play size={13} /> Resume Simulator
              </ShimmerButton>
            ) : (
              <ShimmerButton
                disabled={loading}
                onClick={handleStart}
                variant="primary"
                size="md"
              >
                <Play size={13} /> Start Stream
              </ShimmerButton>
            )}

            {!isStopped && (
              <button
                disabled={loading}
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] text-slate-300 hover:text-white hover:border-white/[0.2] text-xs font-mono transition-colors"
              >
                <Square size={12} /> Stop
              </button>
            )}

            <button
              disabled={loading}
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] text-slate-300 hover:text-white hover:border-white/[0.2] text-xs font-mono transition-colors"
              title="Reset metrics"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>

          {/* Rate Slider */}
          <div className="flex items-center gap-3 bg-black/40 p-2 px-3.5 rounded-lg border border-white/[0.08]">
            <Sliders size={14} className="text-slate-400" />
            <span className="text-[10px] font-mono uppercase text-slate-400">Emission Rate:</span>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="w-28 accent-cyan-400 cursor-pointer"
            />
            <span className="text-xs font-mono text-cyan-300 font-bold w-12 text-right">
              {rate.toFixed(1)}/s
            </span>
          </div>
        </div>

        {/* Telemetry KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="p-3.5 bg-black/40 border border-white/[0.06] rounded-lg space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider">
              Transactions Emitted
            </span>
            <div className="text-2xl font-mono font-bold text-white tracking-tight">
              <NumberTicker value={telemetry?.transactions_emitted || 0} />
            </div>
          </div>

          <div className="p-3.5 bg-black/40 border border-white/[0.06] rounded-lg space-y-1">
            <span className="text-[10px] font-mono uppercase text-amber-400/90 block tracking-wider">
              Anomalies Detected
            </span>
            <div className="text-2xl font-mono font-bold text-amber-400 tracking-tight">
              <NumberTicker value={telemetry?.anomalies_detected || 0} />
            </div>
          </div>

          <div className="p-3.5 bg-black/40 border border-white/[0.06] rounded-lg space-y-1">
            <span className="text-[10px] font-mono uppercase text-cyan-400/90 block tracking-wider">
              Anomaly Ratio
            </span>
            <div className="text-2xl font-mono font-bold text-cyan-300 tracking-tight">
              <NumberTicker
                value={telemetry?.anomaly_rate_pct || 0}
                decimalPlaces={1}
                suffix="%"
              />
            </div>
          </div>

          <div className="p-3.5 bg-black/40 border border-white/[0.06] rounded-lg space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider">
              Engine Bus
            </span>
            <div className="text-xs font-mono text-slate-200 truncate font-semibold">
              Async Queue Protocol
            </div>
            <span className="text-[10px] font-mono text-slate-500 block">
              Kafka-compatible interface
            </span>
          </div>
        </div>
        </div>
      </SpotlightCard>

      {/* Kinetic Telemetry Activity Strip */}
      <div className="p-3 bg-[#0E151C]/75 border border-white/[0.08] rounded-xl flex items-center justify-between font-mono text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Zap size={14} className={isRunning ? "text-cyan-400 animate-pulse" : "text-slate-500"} />
          <span>Stream Pulse Status:</span>
          <span className={isRunning ? "text-cyan-300 font-bold" : "text-slate-400"}>
            {isRunning ? "Receiving live events" : "Bus suspended"}
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          Last event receipt: {new Date(lastPulse).toLocaleTimeString()}
        </div>
      </div>

      {/* Live SSE Event Stream Viewport */}
      <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#070b10] shadow-2xl tactical-corner">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0E151C] border-b border-white/[0.06] text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Terminal size={14} className="text-cyan-400" />
            <span>Server-Sent Events Stream (SSE: /api/stream/events)</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-cyan-400"
              />
              Stick to Recent
            </label>
            <button
              onClick={() => setEvents([])}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 underline"
            >
              Clear Log
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-2 select-text bg-[#06090e]">
          {events.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-[11px]">
              Waiting for stream emissions. Start the simulator above to observe live transaction evaluations.
            </div>
          ) : (
            events.map((ev) => {
              const isAnomaly = ev.data?.transaction?.risk_score >= 25;
              const isCritical = ev.data?.transaction?.risk_category === "CRITICAL";

              return (
                <div
                  key={ev.id}
                  className={`p-2.5 rounded-lg border text-[11px] transition-all ${
                    isCritical
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]"
                      : isAnomaly
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-300"
                      : "bg-white/[0.02] border-white/[0.04] text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-cyan-400 font-semibold">{ev.time}</span>
                    <span className="uppercase text-[9px] tracking-wider">{ev.eventType}</span>
                  </div>

                  {ev.data?.transaction && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-white font-bold">{ev.data.transaction.transaction_id}</span>
                      <span className="text-slate-200">₹{ev.data.transaction.amount?.toLocaleString("en-IN")}</span>
                      <span className="text-slate-400">
                        {ev.data.transaction.sender_upi_handle} → {ev.data.transaction.receiver_upi_handle}
                      </span>
                      <span className="font-bold">
                        Score: {ev.data.transaction.risk_score} ({ev.data.transaction.risk_category})
                      </span>
                    </div>
                  )}

                  {ev.data?.assessment?.rule_hits && ev.data.assessment.rule_hits.length > 0 && (
                    <div className="mt-1 text-slate-400 text-[10px]">
                      Triggered Rules: {ev.data.assessment.rule_hits.map((r: any) => r.rule_id).join(", ")}
                    </div>
                  )}

                  {ev.data?.ml_explanations && ev.data.ml_explanations.length > 0 && (
                    <div className="mt-1 text-cyan-300/90 text-[10px] flex flex-wrap items-center gap-1.5 font-mono">
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-800/40 text-cyan-400 font-semibold">
                        ML Deviation
                      </span>
                      <span>
                        {ev.data.ml_explanations.slice(0, 2).map((e: any) => e.human_text).join(" • ")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
