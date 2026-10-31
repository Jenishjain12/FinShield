interface TacticalBadgeProps {
  level?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NOMINAL" | "CLEARED" | "INFO";
  text?: string;
  className?: string;
  pulse?: boolean;
}

const LEVEL_CONFIG = {
  CRITICAL: {
    symbol: "▲",
    label: "CRITICAL",
    classes: "border-[#B9383A]/40 bg-[#B9383A]/10 text-[#B9383A] shadow-[0_0_8px_rgba(185,56,58,0.2)]",
    pulseClass: "bg-[#B9383A]",
  },
  HIGH: {
    symbol: "◆",
    label: "HIGH RISK",
    classes: "border-[#E6654F]/40 bg-[#E6654F]/10 text-[#E6654F] shadow-[0_0_8px_rgba(230,101,79,0.2)]",
    pulseClass: "bg-[#E6654F]",
  },
  MEDIUM: {
    symbol: "●",
    label: "MEDIUM",
    classes: "border-[#D9A34C]/40 bg-[#D9A34C]/10 text-[#D9A34C]",
    pulseClass: "bg-[#D9A34C]",
  },
  LOW: {
    symbol: "■",
    label: "LOW",
    classes: "border-[#63B78C]/40 bg-[#63B78C]/10 text-[#63B78C]",
    pulseClass: "bg-[#63B78C]",
  },
  NOMINAL: {
    symbol: "✓",
    label: "NOMINAL",
    classes: "border-[#63B78C]/40 bg-[#63B78C]/10 text-[#63B78C]",
    pulseClass: "bg-[#63B78C]",
  },
  CLEARED: {
    symbol: "✓",
    label: "CLEARED",
    classes: "border-[#63B78C]/40 bg-[#63B78C]/10 text-[#63B78C]",
    pulseClass: "bg-[#63B78C]",
  },
  INFO: {
    symbol: "ℹ",
    label: "INFO",
    classes: "border-line bg-surface/80 text-sub",
    pulseClass: "bg-paper-500",
  },
};

export function TacticalBadge({
  level = "INFO",
  text,
  className = "",
  pulse = false,
}: TacticalBadgeProps) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.INFO;
  const labelText = text || config.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-3xs font-semibold tracking-wider uppercase transition-colors ${config.classes} ${className}`}
    >
      {pulse ? (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.pulseClass}`}
          />
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.pulseClass}`}
          />
        </span>
      ) : (
        <span className="text-[8px] opacity-80">{config.symbol}</span>
      )}
      <span>{labelText}</span>
    </span>
  );
}
