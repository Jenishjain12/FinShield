import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  Command,
  Compass,
  Cpu,
  FolderSearch,
  GitFork,
  LayoutDashboard,
  Moon,
  Network,
  ScanSearch,
  Search,
  ShieldAlert,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  category: "Navigation" | "Operations" | "System";
  label: string;
  sublabel?: string;
  icon: any;
  action: () => void;
  shortcut?: string;
}

export function CommandBar({ isOpen, onClose }: CommandBarProps) {
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    {
      id: "nav-overview",
      category: "Navigation",
      label: "Intelligence Overview",
      sublabel: "Command observatory & risk landscape",
      icon: LayoutDashboard,
      action: () => { navigate("/"); onClose(); },
      shortcut: "G O",
    },
    {
      id: "nav-transactions",
      category: "Navigation",
      label: "Transaction Monitor",
      sublabel: "Simulated UPI stream triage ledger",
      icon: Zap,
      action: () => { navigate("/transactions"); onClose(); },
      shortcut: "G T",
    },
    {
      id: "nav-stream",
      category: "Navigation",
      label: "Stream Simulator",
      sublabel: "Kafka event bus emission controls",
      icon: Activity,
      action: () => { navigate("/stream"); onClose(); },
      shortcut: "G S",
    },
    {
      id: "nav-patterns",
      category: "Navigation",
      label: "Risk Pattern Constellations",
      sublabel: "Fake collect, mule rings & velocity anomalies",
      icon: ShieldAlert,
      action: () => { navigate("/patterns"); onClose(); },
      shortcut: "G P",
    },
    {
      id: "nav-entities",
      category: "Navigation",
      label: "Entity & Trace Graph",
      sublabel: "Accounts, VPAs & shared hardware rings",
      icon: Network,
      action: () => { navigate("/entities"); onClose(); },
      shortcut: "G E",
    },
    {
      id: "nav-model",
      category: "Navigation",
      label: "Model Calibration & Health",
      sublabel: "Isolation Forest unsupervised distance",
      icon: Cpu,
      action: () => { navigate("/model"); onClose(); },
      shortcut: "G M",
    },
    {
      id: "nav-alerts",
      category: "Navigation",
      label: "Attention Queue Beacons",
      sublabel: "Review urgent disturbance signals",
      icon: Bell,
      action: () => { navigate("/alerts"); onClose(); },
      shortcut: "G A",
    },
    {
      id: "nav-cases",
      category: "Navigation",
      label: "Case Dossier Archive",
      sublabel: "Historical advertising & intake cases",
      icon: FolderSearch,
      action: () => { navigate("/investigations"); onClose(); },
      shortcut: "G C",
    },
    {
      id: "nav-campaigns",
      category: "Navigation",
      label: "Campaign Constellation Field",
      sublabel: "Interactive 3D evidence relationship field",
      icon: GitFork,
      action: () => { navigate("/campaigns"); onClose(); },
    },
    {
      id: "ops-intake",
      category: "Operations",
      label: "Forensic Evidence Intake",
      sublabel: "Analyze ad copy, payment reference or image",
      icon: ScanSearch,
      action: () => { navigate("/analyze"); onClose(); },
      shortcut: "N",
    },
    {
      id: "ops-discovery",
      category: "Operations",
      label: "Discovery Operations Run",
      sublabel: "Initiate multi-channel synthetic reconnaissance",
      icon: Compass,
      action: () => { navigate("/discovery"); onClose(); },
    },
    {
      id: "sys-theme",
      category: "System",
      label: `Switch to ${theme === "dark" ? "Light Paper" : "Flagship Dark"} Theme`,
      sublabel: "Toggle Signal Cartography display mode",
      icon: theme === "dark" ? Sun : Moon,
      action: () => { toggleTheme(); onClose(); },
      shortcut: "T",
    },
  ];

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.sublabel?.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        } else if (query.trim()) {
          navigate(`/investigations?q=${encodeURIComponent(query.trim())}`);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, query, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 animate-fade-in-fast">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Console Window */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Investigative Command Console"
        className="dossier-panel artifact-corner relative z-10 w-full max-w-2xl overflow-hidden rounded-sm border border-line bg-panel shadow-modal animate-slide-up"
      >
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-line px-4 py-3 bg-surface/50">
          <Search size={16} className="text-accent shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cases, entities, alerts, or commands… (e.g. 'UPI', 'Mule', 'Alerts')"
            className="w-full bg-transparent font-mono text-sm text-paper placeholder-dim outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-dim hover:text-paper p-1"
            >
              <X size={14} />
            </button>
          ) : (
            <div className="flex items-center gap-1 border border-line px-1.5 py-0.5 rounded-sm text-3xs font-mono text-dim">
              <Command size={10} />
              <span>ESC to exit</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-4">
          {["Navigation", "Operations", "System"].map((category) => {
            const items = filtered.filter((c) => c.category === category);
            if (items.length === 0) return null;

            return (
              <div key={category} className="space-y-1">
                <div className="px-3 py-1 font-mono text-3xs uppercase tracking-wider text-dim">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const globalIdx = filtered.findIndex((f) => f.id === item.id);
                    const isSelected = globalIdx === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex items-center justify-between rounded-sm px-3 py-2 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-accent/10 border border-accent/30 text-paper"
                            : "border border-transparent text-sub hover:bg-surface hover:text-paper"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon size={14} className={isSelected ? "text-accent" : "text-dim"} />
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-medium text-paper truncate">
                              {item.label}
                            </p>
                            {item.sublabel && (
                              <p className="text-3xs text-dim truncate">{item.sublabel}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.shortcut && (
                            <span className="font-mono text-3xs text-dim border border-line px-1.5 py-0.5 rounded-sm">
                              {item.shortcut}
                            </span>
                          )}
                          <ArrowRight
                            size={12}
                            className={`transition-opacity ${
                              isSelected ? "opacity-100 text-accent" : "opacity-0"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <p className="font-mono text-xs text-sub">No direct commands match "{query}"</p>
              <p className="font-mono text-2xs text-dim">
                Press <strong className="text-paper">Enter</strong> to run full-text evidence archive search.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line/60 bg-surface/30 px-4 py-2 font-mono text-3xs text-dim">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>Signal Cartography Console</span>
        </div>
      </div>
    </div>
  );
}

