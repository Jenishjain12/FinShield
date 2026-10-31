import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: Props) {
  return (
    <div
      className="flex items-start gap-3 rounded border border-danger/30 bg-danger/[0.06]
                 px-4 py-3 text-sm"
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle size={15} className="mt-px shrink-0 text-danger" aria-hidden="true" />
      <span className="flex-1 leading-relaxed text-paper/80">{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 text-xs font-medium
                     text-accent hover:text-accent/80 transition-colors"
          aria-label="Retry"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      ) : null}
    </div>
  );
}
