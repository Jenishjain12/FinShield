import React from "react";
import { SpotlightCard } from "./SpotlightCard";

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
}

export function BentoGrid({
  children,
  className = "",
  cols = 3,
}: BentoGridProps) {
  const colClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
    6: "grid-cols-1 md:grid-cols-3 lg:grid-cols-6",
    12: "grid-cols-1 md:grid-cols-4 lg:grid-cols-12",
  }[cols];

  return (
    <div className={`grid ${colClass} gap-4 ${className}`}>
      {children}
    </div>
  );
}

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: string; // e.g. "col-span-1 md:col-span-2"
  rowSpan?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tactical?: boolean;
  spotlight?: boolean;
  spotlightColor?: string;
}

export function BentoCard({
  children,
  className = "",
  colSpan = "",
  rowSpan = "",
  title,
  subtitle,
  icon,
  action,
  tactical = true,
  spotlight = true,
  spotlightColor = "rgba(0, 242, 254, 0.07)",
}: BentoCardProps) {
  const CardContainer = spotlight ? SpotlightCard : "div";
  const containerProps = spotlight
    ? { spotlightColor, borderGlow: true }
    : {};

  return (
    <CardContainer
      className={`group relative flex flex-col justify-between overflow-hidden border border-white/[0.08] bg-[#0E151C]/75 backdrop-blur-md p-5 transition-all duration-300 hover:border-white/[0.18] hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] ${tactical ? "tactical-corner" : ""} ${colSpan} ${rowSpan} ${className}`}
      {...containerProps}
    >
      {(title || icon || action) && (
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-cyan-400">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="font-mono text-xs uppercase tracking-wider text-slate-200 font-semibold">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[10px] text-slate-400 font-mono tracking-tight mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="flex items-center">{action}</div>}
        </div>
      )}

      <div className="flex-1">{children}</div>
    </CardContainer>
  );
}

