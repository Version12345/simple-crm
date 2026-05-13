import { describe, it, expect } from "vitest";
import {
    formatCurrency, formatCurrencyShort, formatPercent, rowBg, statusBadge,
    forecastBarColors, forecastShortLabel, pipelineBarColors, shortStageName,
} from "./utils";

// ── formatCurrency ────────────────────────────────────────────────────────────

describe("formatCurrency", () => {
    it("formats zero", () => {
        expect(formatCurrency(0)).toBe("$0");
    });

    it("formats a whole-dollar amount with no decimal places", () => {
        expect(formatCurrency(1000)).toBe("$1,000");
    });

    it("formats a large amount with thousands separator", () => {
        expect(formatCurrency(1_234_567)).toBe("$1,234,567");
    });

    it("rounds fractional cents — does not show decimals", () => {
        expect(formatCurrency(99.9)).toBe("$100");
        expect(formatCurrency(49.4)).toBe("$49");
    });
});

// ── formatCurrencyShort ───────────────────────────────────────────────────────

describe("formatCurrencyShort", () => {
    it("returns $0 for zero", () => {
        expect(formatCurrencyShort(0)).toBe("$0");
    });

    it("returns plain dollar amount below $1 000", () => {
        expect(formatCurrencyShort(500)).toBe("$500");
        expect(formatCurrencyShort(999)).toBe("$999");
    });

    it("switches to k suffix at exactly $1 000", () => {
        expect(formatCurrencyShort(1_000)).toBe("$1k");
    });

    it("rounds to nearest k", () => {
        expect(formatCurrencyShort(1_400)).toBe("$1k");
        expect(formatCurrencyShort(1_500)).toBe("$2k");
        expect(formatCurrencyShort(67_251)).toBe("$67k");
    });

    it("switches to M suffix at exactly $1 000 000", () => {
        expect(formatCurrencyShort(1_000_000)).toBe("$1.0M");
    });

    it("shows one decimal place for millions", () => {
        expect(formatCurrencyShort(1_500_000)).toBe("$1.5M");
        expect(formatCurrencyShort(2_000_000)).toBe("$2.0M");
    });
});

// ── formatPercent ─────────────────────────────────────────────────────────────

describe("formatPercent", () => {
    it("formats 0 as 0%", () => {
        expect(formatPercent(0)).toBe("0%");
    });

    it("formats 0.5 as 50%", () => {
        expect(formatPercent(0.5)).toBe("50%");
    });

    it("formats 1 as 100%", () => {
        expect(formatPercent(1)).toBe("100%");
    });

    it("rounds to the nearest whole percent", () => {
        expect(formatPercent(0.075)).toBe("8%");
        expect(formatPercent(0.074)).toBe("7%");
    });

    it("formats seed-data likelihoods correctly", () => {
        expect(formatPercent(0.05)).toBe("5%");
        expect(formatPercent(0.15)).toBe("15%");
        expect(formatPercent(0.30)).toBe("30%");
        expect(formatPercent(0.70)).toBe("70%");
    });
});

// ── rowBg ─────────────────────────────────────────────────────────────────────

describe("rowBg", () => {
    it("always returns bg-green-50 for won stages regardless of index", () => {
        expect(rowBg("won", 0)).toBe("bg-green-50");
        expect(rowBg("won", 1)).toBe("bg-green-50");
        expect(rowBg("won", 99)).toBe("bg-green-50");
    });

    it("always returns bg-red-50 for lost stages regardless of index", () => {
        expect(rowBg("lost", 0)).toBe("bg-red-50");
        expect(rowBg("lost", 1)).toBe("bg-red-50");
    });

    it("returns bg-white for pending even-index rows", () => {
        expect(rowBg("pending", 0)).toBe("bg-white");
        expect(rowBg("pending", 2)).toBe("bg-white");
        expect(rowBg("pending", 100)).toBe("bg-white");
    });

    it("returns bg-gray-50 for pending odd-index rows", () => {
        expect(rowBg("pending", 1)).toBe("bg-gray-50");
        expect(rowBg("pending", 3)).toBe("bg-gray-50");
        expect(rowBg("pending", 99)).toBe("bg-gray-50");
    });
});

// ── statusBadge ───────────────────────────────────────────────────────────────

describe("statusBadge", () => {
    it("returns green classes for won", () => {
        expect(statusBadge("won")).toBe("bg-green-100 text-green-700");
    });

    it("returns red classes for lost", () => {
        expect(statusBadge("lost")).toBe("bg-red-100 text-red-600");
    });

    it("returns blue classes for pending", () => {
        expect(statusBadge("pending")).toBe("bg-blue-100 text-blue-700");
    });
});

// ── forecastBarColors ─────────────────────────────────────────────────────────

describe("forecastBarColors", () => {
    const CURRENT_KEY = "2026-05";

    it("returns amber for past", () => {
        expect(forecastBarColors("past", CURRENT_KEY)).toEqual(["bg-amber-200", "bg-amber-500"]);
    });

    it("returns slate for future", () => {
        expect(forecastBarColors("future", CURRENT_KEY)).toEqual(["bg-slate-200", "bg-slate-400"]);
    });

    it("returns gray for no-date", () => {
        expect(forecastBarColors("no-date", CURRENT_KEY)).toEqual(["bg-gray-200", "bg-gray-400"]);
    });

    it("returns blue for the current month key", () => {
        expect(forecastBarColors("2026-05", CURRENT_KEY)).toEqual(["bg-blue-200", "bg-blue-500"]);
    });

    it("returns indigo for any other YYYY-MM key", () => {
        expect(forecastBarColors("2026-06", CURRENT_KEY)).toEqual(["bg-indigo-200", "bg-indigo-400"]);
        expect(forecastBarColors("2025-01", CURRENT_KEY)).toEqual(["bg-indigo-200", "bg-indigo-400"]);
    });
});

// ── forecastShortLabel ────────────────────────────────────────────────────────

describe("forecastShortLabel", () => {
    const CURRENT_YEAR = 2026;

    it("returns 'Past Due' for past", () => {
        expect(forecastShortLabel("past", CURRENT_YEAR)).toBe("Past Due");
    });

    it("returns '6+ Mo.' for future", () => {
        expect(forecastShortLabel("future", CURRENT_YEAR)).toBe("6+ Mo.");
    });

    it("returns 'No Date' for no-date", () => {
        expect(forecastShortLabel("no-date", CURRENT_YEAR)).toBe("No Date");
    });

    it("returns only the month name when the key year matches currentYear", () => {
        expect(forecastShortLabel("2026-01", CURRENT_YEAR)).toBe("Jan");
        expect(forecastShortLabel("2026-05", CURRENT_YEAR)).toBe("May");
        expect(forecastShortLabel("2026-12", CURRENT_YEAR)).toBe("Dec");
    });

    it("appends a two-digit year suffix when the key year differs from currentYear", () => {
        expect(forecastShortLabel("2027-01", CURRENT_YEAR)).toBe("Jan '27");
        expect(forecastShortLabel("2025-11", CURRENT_YEAR)).toBe("Nov '25");
    });
});

// ── pipelineBarColors ─────────────────────────────────────────────────────────

describe("pipelineBarColors", () => {
    it("returns green for won", () => {
        expect(pipelineBarColors("won")).toEqual(["bg-green-200", "bg-green-500"]);
    });

    it("returns red for lost", () => {
        expect(pipelineBarColors("lost")).toEqual(["bg-red-200", "bg-red-400"]);
    });

    it("returns indigo for pending", () => {
        expect(pipelineBarColors("pending")).toEqual(["bg-indigo-200", "bg-indigo-400"]);
    });
});

// ── shortStageName ────────────────────────────────────────────────────────────

describe("shortStageName", () => {
    it("returns the name unchanged when 11 characters or fewer", () => {
        expect(shortStageName("Short")).toBe("Short");
        expect(shortStageName("Exactly 11c")).toBe("Exactly 11c"); // 11 chars
    });

    it("truncates to 10 characters plus ellipsis when longer than 11", () => {
        expect(shortStageName("Completed Demo")).toBe("Completed …");
        expect(shortStageName("Negotiation Phase")).toBe("Negotiatio…");
    });

    it("handles empty string without error", () => {
        expect(shortStageName("")).toBe("");
    });
});
