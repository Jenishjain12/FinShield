import { useState } from "react";
import {
  Check,
  Copy,
  Globe,
  Hash,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Smartphone,
  User,
} from "lucide-react";

interface EntityChipProps {
  type: string;
  value: string;
  className?: string;
  onClick?: () => void;
  copyable?: boolean;
}

const TYPE_ICONS: Record<string, any> = {
  phone: Phone,
  upi_handle: QrCode,
  domain: Globe,
  url: Globe,
  email: Mail,
  bank_account: Hash,
  device_id: Smartphone,
  account_id: User,
  ip_address: MapPin,
  phrase: Hash,
};

export function EntityChip({
  type,
  value,
  className = "",
  onClick,
  copyable = true,
}: EntityChipProps) {
  const [copied, setCopied] = useState(false);
  const Icon = TYPE_ICONS[type] || Hash;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={onClick}
      className={`group inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface/60 px-2 py-1 font-mono text-2xs text-paper transition-all hover:border-accent/40 hover:bg-surface ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      title={`${type}: ${value}`}
    >
      <Icon size={11} className="shrink-0 text-accent/80" />
      <span className="truncate max-w-[160px]">{value}</span>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="ml-0.5 text-dim opacity-0 group-hover:opacity-100 transition-opacity hover:text-paper"
          aria-label="Copy identifier"
          title="Copy"
        >
          {copied ? <Check size={10} className="text-ok" /> : <Copy size={10} />}
        </button>
      )}
    </div>
  );
}
