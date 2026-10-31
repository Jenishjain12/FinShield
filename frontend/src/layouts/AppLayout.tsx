import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Command,
  Crosshair,
  Menu,
  Search,
  X,
} from "lucide-react";
import { CommandBar } from "../components/CommandBar";
import { OperationsRail } from "../components/OperationsRail";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export function AppLayout() {
  const [expanded, setExpanded] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();

  const { data: alerts } = useAsync(() => api.alerts(), []);
  const unreadCount = alerts ? alerts.filter((a) => !a.is_read).length : 0;

  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);

  // Global Keyboard Shortcut: Cmd/Ctrl + K opens Command Console
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Context bar label
  const context = location.pathname.startsWith("/transactions/")
    ? "TRANSACTION DOSSIER"
    : location.pathname.startsWith("/transactions")
    ? "TRANSACTION MONITOR"
    : location.pathname.startsWith("/patterns")
    ? "RISK CONSTELLATIONS"
    : location.pathname.startsWith("/entities")
    ? "ENTITY TRACE GRAPH"
    : location.pathname.startsWith("/model")
    ? "MODEL CALIBRATION"
    : location.pathname.startsWith("/stream")
    ? "STREAM OPERATIONS"
    : location.pathname.startsWith("/investigations/")
    ? "CASE DOSSIER"
    : location.pathname.startsWith("/investigations")
    ? "CASE ARCHIVE"
    : location.pathname.startsWith("/campaigns")
    ? "EVIDENCE FIELD"
    : location.pathname.startsWith("/analyze")
    ? "EVIDENCE INTAKE"
    : location.pathname.startsWith("/discovery")
    ? "DISCOVERY OPS"
    : location.pathname.startsWith("/copilot")
    ? "BRIEFING ROOM"
    : location.pathname.startsWith("/alerts")
    ? "ATTENTION QUEUE"
    : null;

  return (
    <div className="app-grain min-h-screen bg-bg text-paper">
      {/* ── Operations Rail (Desktop) ────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-panel transition-[width] duration-200 lg:flex ${
          expanded ? "w-60" : "w-[68px]"
        }`}
      >
        <OperationsRail
          expanded={expanded}
          unreadCount={unreadCount}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="absolute -right-3 top-[72px] flex h-6 w-6 items-center justify-center rounded-full border border-line bg-panel text-dim hover:text-paper hover:border-accent/40 hover:shadow-glow transition-all"
          aria-label="Toggle operations rail"
          title={expanded ? "Collapse rail" : "Expand rail"}
        >
          {expanded ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </aside>

      {/* ── Operations Rail (Mobile Drawer) ──────────────────────── */}
      {mobile && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-panel lg:hidden shadow-modal animate-slide-right">
            <button
              className="absolute right-3 top-4 text-dim hover:text-paper transition-colors p-1"
              onClick={() => setMobile(false)}
              aria-label="Close navigation"
            >
              <X size={16} />
            </button>
            <OperationsRail
              expanded
              onNavigate={() => setMobile(false)}
              unreadCount={unreadCount}
            />
          </aside>
        </>
      )}

      {/* ── Main Viewport Canvas ─────────────────────────────────── */}
      <div className={`min-h-screen transition-[margin] duration-200 ${expanded ? "lg:ml-60" : "lg:ml-[68px]"}`}>
        {/* Top Operational Command Bar */}
        <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1640px] items-center gap-3 px-4 lg:px-6">
            {/* Mobile menu trigger */}
            <button
              className="ink-button flex h-9 w-9 items-center justify-center rounded-sm lg:hidden"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={15} />
            </button>

            {/* System Status Beacon */}
            <div className="hidden items-center gap-2 text-2xs text-dim sm:flex shrink-0 font-mono">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
              </span>
              <span className="tracking-[.14em] font-semibold text-ok/90">OBSERVATORY ACTIVE</span>
              {context && (
                <>
                  <span className="text-line mx-1">·</span>
                  <Crosshair size={11} className="text-accent/70" />
                  <span className="text-sub tracking-[.10em] uppercase">{context}</span>
                </>
              )}
            </div>

            {/* Quick Command Console Trigger */}
            <div
              onClick={() => setCommandOpen(true)}
              className="command-surface relative mx-auto flex h-9 w-full max-w-lg cursor-pointer items-center justify-between rounded-sm border border-line px-3 text-xs text-dim transition-colors hover:border-accent/40 hover:text-sub"
              title="Open Command Console (⌘K / Ctrl+K)"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Search size={13} className="text-dim shrink-0" />
                <span className="truncate font-mono text-2xs text-dim">
                  Search cases, entities, alerts, or commands…
                </span>
              </div>
              <div className="flex items-center gap-1 border border-line/60 bg-surface/80 px-1.5 py-0.5 rounded-sm font-mono text-3xs text-dim">
                <Command size={10} />
                <span>K</span>
              </div>
            </div>

            {/* Synthetic Demonstration Data Badge */}
            <div
              className="hidden items-center gap-1.5 border border-warn/30 bg-warn/[0.06] px-2.5 py-1 text-3xs text-warn sm:flex shrink-0 font-mono tracking-wider"
              title="Demonstration data is synthetic for regulatory and safety compliance."
            >
              <AlertTriangle size={11} className="text-warn shrink-0" />
              SYNTHETIC DEMO
            </div>
          </div>
        </header>

        {/* Primary Page Canvas */}
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1640px] px-4 py-6 lg:px-6"
        >
          <Outlet />
        </main>
      </div>

      {/* Global Command Console Modal */}
      <CommandBar
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
      />
    </div>
  );
}
