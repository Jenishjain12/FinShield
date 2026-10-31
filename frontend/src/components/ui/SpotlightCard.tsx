import React, { useRef, useState, useCallback } from "react";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  spotlightColor?: string;
  spotlightSize?: number;
  borderGlow?: boolean;
}

export function SpotlightCard({
  children,
  className = "",
  contentClassName = "",
  spotlightColor = "rgba(88, 199, 217, 0.08)",
  spotlightSize = 350,
  borderGlow = true,
  ...props
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setOpacity(1);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setOpacity(0);
  }, []);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-sm border border-line bg-panel transition-all duration-200 hover:border-line-hover ${className}`}
      {...props}
    >
      {/* Dynamic Cursor Spotlight Layer */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(${spotlightSize}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />

      {/* Border Highlight Effect */}
      {borderGlow && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300"
          style={{
            opacity: opacity * 0.7,
            mask: "linear-gradient(white, white) content-box, linear-gradient(white, white)",
            WebkitMask: "linear-gradient(white, white) content-box, linear-gradient(white, white)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: "1px",
            background: `radial-gradient(${spotlightSize * 0.75}px circle at ${position.x}px ${position.y}px, rgba(88, 199, 217, 0.35), transparent 70%)`,
          }}
        />
      )}

      {/* Content wrapper */}
      <div className={`relative z-10 h-full w-full ${contentClassName}`}>{children}</div>
    </div>
  );
}
