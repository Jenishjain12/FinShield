import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Item {
  label: string;
  to?: string;
}

interface Props {
  items: Item[];
}

export function Breadcrumb({ items }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-sub">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight size={11} className="text-dim" aria-hidden="true" />
            ) : null}
            {item.to ? (
              <Link
                to={item.to}
                className="hover:text-paper transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className="text-paper/60 max-w-[280px] truncate"
                aria-current="page"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
