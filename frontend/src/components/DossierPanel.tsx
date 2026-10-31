import React from "react";

interface DossierPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  artifactCorner?: boolean;
}

export function DossierPanel({
  children,
  className = "",
  title,
  subtitle,
  eyebrow,
  badge,
  action,
  footer,
  artifactCorner = true,
  ...props
}: DossierPanelProps) {
  return (
    <div
      className={`dossier-panel relative rounded-sm border border-line bg-panel p-5 transition-colors ${
        artifactCorner ? "artifact-corner" : ""
      } ${className}`}
      {...props}
    >
      {(title || eyebrow || action || badge) && (
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-line pb-3">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            {title && (
              <h2 className="font-mono text-sm font-semibold tracking-wide text-paper truncate">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-2xs text-sub font-mono leading-relaxed">{subtitle}</p>
            )}
          </div>
          {(action || badge) && (
            <div className="flex shrink-0 items-center gap-2">
              {badge}
              {action}
            </div>
          )}
        </div>
      )}

      <div>{children}</div>

      {footer && (
        <div className="mt-4 border-t border-line/60 pt-3 text-2xs text-dim">
          {footer}
        </div>
      )}
    </div>
  );
}
