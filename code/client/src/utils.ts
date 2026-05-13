import { StageStatus } from "./types";

// ── Currency / number formatters ──────────────────────────────────────────────

/** Full currency: $1,234 (no cents). */
export const formatCurrency = (value: number): string =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

/** Compact currency for axis labels: $500 | $2k | $1.5M. */
export const formatCurrencyShort = (value: number): string => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
    return `$${value}`;
};

/** Conversion likelihood as a percentage string: 0.75 → "75%". */
export const formatPercent = (value: number): string => `${(value * 100).toFixed(0)}%`;

// ── Table row helpers ─────────────────────────────────────────────────────────

/**
 * Tailwind background class for a pipeline table row.
 * Won rows are always green, lost rows always red; pending rows alternate.
 */
export function rowBg(status: StageStatus, idx: number): string {
    if (status === "won") return "bg-green-50";
    if (status === "lost") return "bg-red-50";
    return idx % 2 === 0 ? "bg-white" : "bg-gray-50";
}

/**
 * Tailwind classes for a status pill badge.
 * Returns background + text colour classes only (no padding/rounding).
 */
export function statusBadge(status: StageStatus): string {
    if (status === "won") return "bg-green-100 text-green-700";
    if (status === "lost") return "bg-red-100 text-red-600";
    return "bg-blue-100 text-blue-700";
}

// ── Chart colour helpers ──────────────────────────────────────────────────────

/**
 * Tailwind [pipelineClass, expectedClass] bar colours for a forecast bucket.
 * `currentMonthKey` is the caller's "YYYY-MM" string for the current month.
 */
export function forecastBarColors(key: string, currentMonthKey: string): [string, string] {
    if (key === "past")           return ["bg-amber-200", "bg-amber-500"];
    if (key === "future")         return ["bg-slate-200", "bg-slate-400"];
    if (key === "no-date")        return ["bg-gray-200",  "bg-gray-400"];
    if (key === currentMonthKey)  return ["bg-blue-200",  "bg-blue-500"];
    return ["bg-indigo-200", "bg-indigo-400"];
}

/**
 * Abbreviated X-axis label for a forecast bucket key.
 * `currentYear` is used to decide whether to append a year suffix.
 *
 * Special keys → fixed strings:
 *   "past"    → "Past Due"
 *   "future"  → "6+ Mo."
 *   "no-date" → "No Date"
 *
 * YYYY-MM keys → short month name, with "'YY" suffix when the year differs
 * from `currentYear` (e.g. "Jan '27" vs "Jan").
 */
export function forecastShortLabel(key: string, currentYear: number): string {
    if (key === "past")    return "Past Due";
    if (key === "future")  return "6+ Mo.";
    if (key === "no-date") return "No Date";
    const [yearStr, monthStr] = key.split("-");
    const year  = Number(yearStr);
    const month = Number(monthStr);
    const mo = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short" });
    return year !== currentYear ? `${mo} '${String(year).slice(2)}` : mo;
}

/**
 * Tailwind [pipelineClass, expectedClass] bar colours for a pipeline stage.
 */
export function pipelineBarColors(status: StageStatus): [string, string] {
    if (status === "won")  return ["bg-green-200", "bg-green-500"];
    if (status === "lost") return ["bg-red-200",   "bg-red-400"];
    return ["bg-indigo-200", "bg-indigo-400"];
}

/**
 * Truncates a stage name to fit a narrow chart column.
 * Names longer than 11 characters are cut to 10 with a trailing ellipsis.
 */
export function shortStageName(name: string): string {
    return name.length > 11 ? `${name.slice(0, 10)}…` : name;
}
