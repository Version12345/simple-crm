import { Opportunity } from "./entity/Opportunity";

export interface ForecastGroup {
    value: string;
    count: number;
    totalValue: number;
    expectedValue: number;
}

export interface ForecastBucket {
    key: string;
    label: string;
    count: number;
    totalValue: number;
    expectedValue: number;
    groups?: ForecastGroup[];
}

export interface ForecastResult {
    totalCount: number;
    totalValue: number;
    expectedValue: number;
    buckets: ForecastBucket[];
}

/**
 * Returns a human-readable label for a forecast bucket key.
 * Keys: "past" | "YYYY-MM" | "future" | "no-date"
 */
export function bucketLabel(key: string, now: Date): string {
    if (key === "past") return "Past Due";
    if (key === "future") return "6+ Months Out";
    if (key === "no-date") return "No Close Date";
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

/**
 * Groups a list of opportunities by the value of a custom field.
 * - Trims whitespace but preserves casing and normalizing the value by converting them to uppercase.
 * - null / undefined / empty-string values land in the "—" group.
 * - Named groups are sorted alphabetically; "—" is always last.
 */
export function buildForecastGroups(opps: Opportunity[], fieldName: string): ForecastGroup[] {
    const groupMap = new Map<string, Opportunity[]>();

    for (const opp of opps) {
        // Check the opportunity's own custom fields first; if absent, fall back
        // to the lead's custom fields. This lets lead-scoped fields (e.g.
        // "industry") be used as forecast group dimensions without a schema change.
        let raw: string | number | undefined = opp.customFields?.[fieldName];
        if (raw === undefined || raw === null) {
            const leadCf = (opp.lead?.customFields ?? {}) as Record<string, string | number | undefined>;
            raw = leadCf[fieldName];
        }
        const value =
            raw === null || raw === undefined || String(raw).trim() === ""
                ? "—"
                : String(raw).trim().toUpperCase();

        if (!groupMap.has(value)) groupMap.set(value, []);
        groupMap.get(value)!.push(opp);
    }

    const sorted = [...groupMap.entries()].sort(([a], [b]) => {
        if (a === "—") return 1;
        if (b === "—") return -1;
        return a.localeCompare(b);
    });

    return sorted.map(([value, groupOpps]) => ({
        value,
        count: groupOpps.length,
        totalValue: groupOpps.reduce((s, o) => s + o.value, 0),
        expectedValue: groupOpps.reduce((s, o) => s + (o.expectedValue ?? 0), 0),
    }));
}

/**
 * Assigns a single opportunity to a bucket key given the current date.
 * Returns the bucket key string.
 */
export function assignBucketKey(opp: Opportunity, now: Date): string {
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    if (!opp.closeDate) {
        return "no-date";
    }

    const [year, month, day] = opp.closeDate.split("-").map(Number);
    const closeDate = new Date(year, month - 1, day);

    if (closeDate < currentMonthStart) {
        return "past";
    }

    const closeBucketKey = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, "0")}`;

    // Build the set of valid month keys for the 6-month window
    const validMonthKeys = new Set<string>();
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        validMonthKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    return validMonthKeys.has(closeBucketKey) ? closeBucketKey : "future";
}

/**
 * Builds the full ordered list of bucket keys for a given reference date:
 * "past", 6 calendar months (current + 5), "future", "no-date"
 */
export function buildBucketKeys(now: Date): string[] {
    const keys: string[] = ["past"];
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    keys.push("future", "no-date");
    return keys;
}

/**
 * Full forecast computation. Takes a list of all opportunities and returns
 * bucketed results.
 *
 * Bucketing rules:
 *  - "past" bucket  — all opportunities whose close date is before the current
 *    calendar month, regardless of stage status (pending, won, or lost). This
 *    lets managers see every deal that was supposed to close in the past, not
 *    just overdue open deals.
 *  - All other buckets — pending-stage opportunities only (open pipeline).
 *
 * Summary totals (totalCount / totalValue / expectedValue) reflect pending-only
 * opportunities so the "Open Opportunities" and "Total Pipeline" cards remain
 * forward-looking and do not inflate with historically closed deals.
 */
export function computeForecast(
    opportunities: Opportunity[],
    now: Date,
    groupBy: string | null
): ForecastResult {
    const bucketKeys = buildBucketKeys(now);
    const bucketMap = new Map<string, Opportunity[]>();
    bucketKeys.forEach(k => bucketMap.set(k, []));

    for (const opp of opportunities) {
        const key = assignBucketKey(opp, now);
        // Past Due shows every deal with a past close date (any stage).
        // Every other bucket is restricted to open (pending) deals only.
        if (key !== "past" && opp.stage.status !== "pending") continue;
        bucketMap.get(key)!.push(opp);
    }

    // Totals reflect the open (pending) pipeline — won/lost past deals are
    // excluded so the summary cards stay forward-looking.
    const openOpps = opportunities.filter(opp => opp.stage.status === "pending");

    const buckets: ForecastBucket[] = bucketKeys.map(key => {
        const opps = bucketMap.get(key)!;
        return {
            key,
            label: bucketLabel(key, now),
            count: opps.length,
            totalValue: opps.reduce((s, o) => s + o.value, 0),
            expectedValue: opps.reduce((s, o) => s + (o.expectedValue ?? 0), 0),
            groups: groupBy ? buildForecastGroups(opps, groupBy) : undefined,
        };
    });

    return {
        totalCount: openOpps.length,
        totalValue: openOpps.reduce((s, o) => s + o.value, 0),
        expectedValue: openOpps.reduce((s, o) => s + (o.expectedValue ?? 0), 0),
        buckets,
    };
}
