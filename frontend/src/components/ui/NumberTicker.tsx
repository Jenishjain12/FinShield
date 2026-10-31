import { useEffect, useRef, useState } from "react";

interface NumberTickerProps {
  value: number;
  direction?: "up" | "down";
  delay?: number;
  duration?: number; // duration in seconds
  decimalPlaces?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  locale?: string;
}

export function NumberTicker({
  value,
  direction = "up",
  delay = 0,
  duration = 1.2,
  decimalPlaces = 0,
  className = "",
  prefix = "",
  suffix = "",
  locale = "en-IN",
}: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState(direction === "down" ? value : 0);
  const prevValueRef = useRef(direction === "down" ? value : 0);

  useEffect(() => {
    let animationFrameId: number;
    let startTime: number | null = null;
    const startVal = prevValueRef.current;
    const endVal = value;
    const diff = endVal - startVal;

    const timeoutId = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = (timestamp - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);

        // Smooth cubic ease-out curve
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = startVal + diff * easeOut;

        setDisplayValue(current);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        } else {
          setDisplayValue(endVal);
          prevValueRef.current = endVal;
        }
      };

      animationFrameId = requestAnimationFrame(step);
    }, delay * 1000);

    return () => {
      clearTimeout(timeoutId);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration, delay]);

  const formatted = displayValue.toLocaleString(locale, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });

  return (
    <span className={`inline-block tabular-nums font-mono ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

