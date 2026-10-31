import React from "react";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  variant?: "primary" | "danger" | "warning" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

export function ShimmerButton({
  children,
  className = "",
  shimmerColor = "rgba(0, 242, 254, 0.4)",
  shimmerSize = "0.08em",
  borderRadius = "8px",
  shimmerDuration = "2.5s",
  variant = "primary",
  size = "md",
  disabled,
  ...props
}: ShimmerButtonProps) {
  const sizeClasses = {
    sm: "px-2.5 py-1 text-[11px] gap-1.5",
    md: "px-3.5 py-1.5 text-xs gap-2",
    lg: "px-5 py-2.5 text-sm gap-2.5",
  }[size];

  const variantClasses = {
    primary:
      "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-400 hover:text-white shadow-[0_0_15px_rgba(0,242,254,0.15)]",
    danger:
      "bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-400 hover:text-white shadow-[0_0_15px_rgba(244,63,94,0.15)]",
    warning:
      "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400 hover:text-white shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    ghost:
      "bg-transparent text-slate-300 border-transparent hover:bg-white/[0.06] hover:text-white",
    outline:
      "bg-white/[0.02] text-slate-200 border-white/[0.12] hover:bg-white/[0.06] hover:border-white/[0.25] hover:text-white",
  }[variant];

  return (
    <button
      style={
        {
          "--shimmer-color": shimmerColor,
          "--shimmer-size": shimmerSize,
          "--border-radius": borderRadius,
          "--shimmer-duration": shimmerDuration,
        } as React.CSSProperties
      }
      disabled={disabled}
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-[var(--border-radius)] border font-mono font-medium tracking-wide transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {/* Sweeping Shimmer Glare */}
      {!disabled && (
        <span
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full ease-in-out"
        />
      )}

      {/* Button Content */}
      <span className="relative z-10 flex items-center gap-1.5">{children}</span>
    </button>
  );
}

