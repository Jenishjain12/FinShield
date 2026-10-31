import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
}

/** Consistent page-level header with optional badge and action slot */
export function PageHeader({ title, description, badge, action }: Props) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        <p className="eyebrow mb-2">FIN-SHIELD / EVIDENCE OBSERVATORY</p>
        <div className="flex items-center gap-2.5">
          <h1 className="display-face text-2xl text-paper md:text-3xl">
            {title}
          </h1>
          {badge ?? null}
        </div>
        {description ? (
          <p className="mt-2 text-sm text-sub leading-relaxed max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="shrink-0 pt-0.5">{action}</div>
      ) : null}
    </div>
  );
}
