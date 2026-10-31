import { NavLink } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  Compass,
  Cpu,
  FolderSearch,
  GitFork,
  LayoutDashboard,
  Moon,
  Network,
  ScanSearch,
  Shield,
  ShieldAlert,
  Smartphone,
  Sun,
  Zap,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { MethodologyNotice } from "./MethodologyNotice";

export interface NavItem {
  to: string;
  label: string;
  group?: string;
  icon: any;
  end?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Live Overview", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transaction Monitor", icon: Zap },
  { to: "/stream", label: "Stream Operations", icon: Activity },
  { to: "/patterns", label: "Risk Constellations", icon: ShieldAlert },
  { to: "/entities", label: "Entity Trace Graph", icon: Network },
  { to: "/model", label: "Model Calibration", icon: Cpu },
  { to: "/consumer", label: "Payer Check", icon: Smartphone },
  { to: "/alerts", label: "Attention Queue", icon: Bell },
  { to: "/investigations", label: "Case Dossiers", icon: FolderSearch },
  { to: "/campaigns", label: "Evidence Field", icon: GitFork },
  { to: "/analyze", label: "Evidence Intake", icon: ScanSearch },
  { to: "/discovery", label: "Discovery Ops", icon: Compass },
  { to: "/copilot", label: "Briefing Room", icon: Bot },
];

interface OperationsRailProps {
  expanded: boolean;
  onNavigate?: () => void;
  unreadCount?: number;
}

export function OperationsRail({
  expanded,
  onNavigate,
  unreadCount = 0,
}: OperationsRailProps) {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex h-full flex-col font-sans select-none" role="navigation" aria-label="Operations Rail">
      {/* ── Brand & Instrument Seal ──────────────────────────────── */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-line bg-panel/90 ${
          expanded ? "gap-3 px-4" : "justify-center px-2"
        }`}
      >
        <div
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-accent/40 bg-accent/[0.08] text-accent transition-all duration-300 hover:border-accent hover:shadow-glow"
          title="FIN-SHIELD Signal Cartography"
        >
          <Shield size={17} strokeWidth={1.8} />
          {/* Active instrument beacon */}
          <span
            className="absolute -right-1 -top-1 flex h-2.5 w-2.5"
            title="Telemetry system active"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ok border border-bg" />
          </span>
        </div>

        {expanded && (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold tracking-[.18em] text-paper">
                FIN-SHIELD
              </span>
              <span className="border border-accent/40 bg-accent/10 px-1 py-0.2 text-[8px] font-mono text-accent uppercase font-bold rounded-sm">
                V2.4
              </span>
            </div>
            <p className="font-mono text-[9px] text-dim tracking-[.14em] uppercase">
              Signal Cartography
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation Track ─────────────────────────────────────── */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Telemetry Navigation">
        {MAIN_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            title={expanded ? undefined : item.label}
            className={({ isActive }) =>
              `group relative flex min-h-[38px] items-center gap-3 rounded-sm border px-2.5 text-xs font-mono transition-all duration-150 ${
                isActive
                  ? "border-accent/30 bg-accent/[0.08] text-accent font-semibold shadow-[inset_0_1px_0_rgba(88,199,217,0.1)]"
                  : "border-transparent text-sub hover:border-line hover:bg-surface/60 hover:text-paper"
              } ${expanded ? "" : "justify-center px-2"}`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active Indicator Bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-accent rounded-r"
                    aria-hidden="true"
                  />
                )}

                <item.icon
                  size={15}
                  strokeWidth={1.8}
                  className={`shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                    isActive ? "text-accent" : "text-dim group-hover:text-paper"
                  }`}
                />

                {expanded && (
                  <span className="truncate tracking-wide">{item.label}</span>
                )}

                {item.to === "/alerts" && unreadCount > 0 && (
                  <span
                    className={`${
                      expanded ? "ml-auto" : "absolute -right-1 -top-1"
                    } flex h-4 min-w-4 items-center justify-center rounded-sm bg-danger px-1 text-3xs font-mono font-bold text-white shadow-sm`}
                    aria-label={`${unreadCount} unread attention alerts`}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Instrument Base & Methodology ────────────────────────── */}
      <div className="shrink-0 space-y-2.5 border-t border-line p-3 bg-panel/60">
        {expanded ? (
          <MethodologyNotice compact />
        ) : (
          <div className="flex justify-center" title="Investigation triage aid — not a fraud verdict">
            <AlertTriangle size={14} className="text-warn/80" aria-label="Methodology notice" />
          </div>
        )}

        <div className={`flex items-center ${expanded ? "justify-between" : "flex-col gap-2"}`}>
          {/* Theme switcher */}
          <button
            onClick={toggle}
            type="button"
            className="ink-button flex h-7 w-7 items-center justify-center rounded-sm text-dim hover:text-paper"
            aria-label="Toggle light and dark paper theme"
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
          >
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          {/* System Health Marker */}
          {expanded && (
            <div className="flex items-center gap-1.5 font-mono text-3xs text-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              <span>API ONLINE</span>
            </div>
          )}

          {/* Analyst profile badge */}
          <div
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-line bg-surface font-mono text-2xs font-bold text-paper"
            title="Analyst: AJ (Fraud Operations)"
          >
            AJ
          </div>
        </div>
      </div>
    </div>
  );
}

