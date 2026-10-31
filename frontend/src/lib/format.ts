import type { RiskCategory } from "../types/api";

/** Hex color for charts and SVG elements that cannot use Tailwind classes */
export function riskColor(category: RiskCategory | string): string {
  switch (category) {
    case "CRITICAL": return "#B9383A";
    case "HIGH":     return "#E6654F";
    case "MEDIUM":   return "#D9A34C";
    default:         return "#63B78C";
  }
}

/** Tailwind class string: text + bg + border for risk badges.
 *  Uses Signal Cartography semantic status tokens. */
export function riskClass(category: RiskCategory | string): string {
  switch (category) {
    case "CRITICAL":
      return "text-[#B9383A] bg-[#B9383A]/10 border-[#B9383A]/30";
    case "HIGH":
      return "text-[#E6654F] bg-[#E6654F]/10 border-[#E6654F]/30";
    case "MEDIUM":
      return "text-[#D9A34C] bg-[#D9A34C]/10 border-[#D9A34C]/30";
    default:
      return "text-[#63B78C] bg-[#63B78C]/10 border-[#63B78C]/30";
  }
}

/** Left border accent class for table rows and list items */
export function riskBg(category: RiskCategory | string): string {
  switch (category) {
    case "CRITICAL": return "border-l-[#B9383A]";
    case "HIGH":     return "border-l-[#E6654F]";
    case "MEDIUM":   return "border-l-[#D9A34C]";
    default:         return "border-l-[#63B78C]";
  }
}

/** Contribution band label from a numeric contribution value */
export function contributionLabel(value: number): string {
  if (value >= 20) return "Major contributor";
  if (value >= 10) return "Moderate contributor";
  if (value >= 1)  return "Minor contributor";
  return "Informational";
}

/** Entity type — returns a short lucide icon name string for lookup */
export function entityTypeLabel(type: string): string {
  switch (type) {
    case "phone":        return "Phone";
    case "url":          return "Link";
    case "domain":       return "Globe";
    case "email":        return "Mail";
    case "upi":          return "CreditCard";
    case "account_like": return "Landmark";
    case "phrase":       return "Quote";
    default:             return "Tag";
  }
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function maskValue(type: string, value: string): string {
  if (type !== "account_like" || value.length < 8) return value;
  return `${value.slice(0, 2)}••••${value.slice(-4)}`;
}

export function relationshipLabel(type: string): string {
  const labels: Record<string, string> = {
    shared_phone:        "Shared phone number",
    shared_url:          "Shared URL",
    shared_domain:       "Shared domain",
    shared_email:        "Shared email address",
    shared_upi:          "Shared UPI handle",
    shared_entity:       "Shared identifier",
    text_similarity:     "Similar text content",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}
