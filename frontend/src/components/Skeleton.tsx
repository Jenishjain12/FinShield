interface Props {
  className?: string;
}

export function Skeleton({ className = "" }: Props) {
  return (
    <div
      className={`skeleton-shimmer rounded ${className}`}
      role="status"
      aria-label="Loading…"
    />
  );
}
