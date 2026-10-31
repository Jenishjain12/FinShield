import type { ReactNode } from "react";

interface Props {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, body, icon, action }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-14 text-center"
      role="status"
    >
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface text-dim">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-paper/70">{title}</p>
      {body ? (
        <p className="max-w-xs text-xs leading-relaxed text-dim">{body}</p>
      ) : null}
      {action ?? null}
    </div>
  );
}
