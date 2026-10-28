/** Shared formatting utilities. All money is INR by default. */
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const num = new Intl.NumberFormat("en-IN");
const numCompact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export const formatCurrency = (v: number, opts?: { compact?: boolean }) =>
  opts?.compact ? inrCompact.format(v) : inr.format(Math.round(v));
export const formatNumber = (v: number, opts?: { compact?: boolean }) =>
  opts?.compact ? numCompact.format(v) : num.format(v);
export const formatPercent = (v: number, digits = 1) => `${(Number.isFinite(v) ? v : 0).toFixed(digits)}%`;
export const formatRatio = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(2)}x`;

export const formatDate = (iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(iso).toLocaleDateString("en-IN", opts);
export const formatDateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function timeAgo(iso: string | Date) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  const m = diff / 60; if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24; if (d < 30) return `${Math.floor(d)}d ago`;
  return formatDate(iso);
}

export const safeDiv = (a: number, b: number) => (b ? a / b : 0);
export const pct = (a: number, b: number) => safeDiv(a, b) * 100;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
