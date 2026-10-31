import type { ReactNode } from "react";

interface Props {
  label: string;
  value: number | string;
  icon?: ReactNode;
  subtitle?: string;
  accentClass?: string;
}

/** KPI stat card. accentClass controls the left border color. */
export function StatCard({ label, value, icon, subtitle, accentClass = "border-l-accent" }: Props) {
  return (
    <div
      className={`flex flex-col gap-3 rounded border border-line bg-panel
                  p-4 border-l-2 ${accentClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-sub">
          {label}
        </p>
        {icon ? (
          <span className="shrink-0 text-dim" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="text-3xl font-semibold tabular text-paper leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subtitle ? (
        <p className="text-xs text-dim">{subtitle}</p>
      ) : null}
    </div>
  );
}
