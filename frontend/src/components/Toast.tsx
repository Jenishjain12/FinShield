import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Toast = { id: number; message: string; tone: "ok" | "err" };

const ToastContext = createContext<(message: string, tone?: "ok" | "err") => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((cur) => cur.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast stack */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`flex items-start gap-2.5 rounded border px-3.5 py-3
                        text-sm shadow-panel animate-slide-in max-w-xs
                        ${toast.tone === "err"
                          ? "border-danger/35 bg-panel text-paper"
                          : "border-ok/30 bg-panel text-paper"
                        }`}
          >
            {toast.tone === "err" ? (
              <XCircle size={15} className="mt-px shrink-0 text-danger" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={15} className="mt-px shrink-0 text-ok" aria-hidden="true" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
