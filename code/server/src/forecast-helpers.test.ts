import { buildForecastGroups, assignBucketKey, bucketLabel, buildBucketKeys, computeForecast } from "./forecast-helpers";
import { Opportunity } from "./entity/Opportunity";
import { Stage } from "./entity/Stage";
import { Lead } from "./entity/Lead";

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeStage(status: "pending" | "won" | "lost", conversionLikelihood = 0.5): Stage {
    const s = new Stage();
    s.id = 1;
    s.name = "Test Stage";
    s.status = status;
    s.conversionLikelihood = conversionLikelihood;
    s.order = 1;
    s.expectedValue = 0;
    return s;
}

function makeLead(): Lead {
    const l = new Lead();
    l.id = 1;
    l.firstName = "Test";
    l.lastName = "Lead";
    l.age = 30;
    l.phoneNumber = "555-0000";
    l.customFields = {};
    return l;
}

function makeOpp(
    overrides: Partial<{
        value: number;
        expectedValue: number;
        closeDate: string | null;
        stageStatus: "pending" | "won" | "lost";
        customFields: Record<string, string | number>;
    }> = {}
): Opportunity {
    const opp = new Opportunity();
    opp.id = Math.floor(Math.random() * 10000);
    opp.lead = makeLead();
    opp.stage = makeStage(overrides.stageStatus ?? "pending");
    opp.value = overrides.value ?? 10000;
    opp.expectedValue = overrides.expectedValue ?? 5000;
    opp.name = "Test Deal";
    opp.closeDate = overrides.closeDate ?? null;
    opp.customFields = overrides.customFields ?? {};
    return opp;
}

// Fixed reference date for deterministic tests: 2025-05-13
const NOW = new Date(2025, 4, 13); // month is 0-indexed

// ── bucketLabel ───────────────────────────────────────────────────────────────

describe("bucketLabel", () => {
    it('returns "Past Due" for key "past"', () => {
        expect(bucketLabel("past", NOW)).toBe("Past Due");
    });

    it('returns "6+ Months Out" for key "future"', () => {
        expect(bucketLabel("future", NOW)).toBe("6+ Months Out");
    });

    it('returns "No Close Date" for key "no-date"', () => {
        expect(bucketLabel("no-date", NOW)).toBe("No Close Date");
    });

    it("returns formatted month label for a YYYY-MM key", () => {
        expect(bucketLabel("2025-05", NOW)).toBe("May 2025");
        expect(bucketLabel("2025-12", NOW)).toBe("December 2025");
        expect(bucketLabel("2026-01", NOW)).toBe("January 2026");
    });
});

// ── buildBucketKeys ───────────────────────────────────────────────────────────

describe("buildBucketKeys", () => {
    it("returns 9 keys total", () => {
        expect(buildBucketKeys(NOW)).toHaveLength(9);
    });

    it("starts with 'past' and ends with 'future' then 'no-date'", () => {
        const keys = buildBucketKeys(NOW);
        expect(keys[0]).toBe("past");
        expect(keys[keys.length - 2]).toBe("future");
        expect(keys[keys.length - 1]).toBe("no-date");
    });

    it("includes the current month and the next 5 months", () => {
        const keys = buildBucketKeys(NOW);
        expect(keys).toContain("2025-05"); // current month
        expect(keys).toContain("2025-06");
        expect(keys).toContain("2025-07");
        expect(keys).toContain("2025-08");
        expect(keys).toContain("2025-09");
        expect(keys).toContain("2025-10");
    });

    it("does not include months beyond 5 out in the fixed window", () => {
        const keys = buildBucketKeys(NOW);
        expect(keys).not.toContain("2025-11");
    });

    it("handles year rollover correctly", () => {
        const nov = new Date(2025, 10, 1); // November 2025
        const keys = buildBucketKeys(nov);
        expect(keys).toContain("2025-11");
        expect(keys).toContain("2026-01");
        expect(keys).toContain("2026-02");
        expect(keys).toContain("2026-03");
        expect(keys).toContain("2026-04");
    });
});

// ── assignBucketKey ───────────────────────────────────────────────────────────

describe("assignBucketKey", () => {
    it("assigns null closeDate to no-date", () => {
        const opp = makeOpp({ closeDate: null });
        expect(assignBucketKey(opp, NOW)).toBe("no-date");
    });

    it("assigns a date before current month to past", () => {
        const opp = makeOpp({ closeDate: "2025-04-30" });
        expect(assignBucketKey(opp, NOW)).toBe("past");
    });

    it("assigns a date in the current month to the current month bucket", () => {
        const opp = makeOpp({ closeDate: "2025-05-31" });
        expect(assignBucketKey(opp, NOW)).toBe("2025-05");
    });

    it("assigns a date in the 6-month window to its month bucket", () => {
        const opp = makeOpp({ closeDate: "2025-08-15" });
        expect(assignBucketKey(opp, NOW)).toBe("2025-08");
    });

    it("assigns a date beyond the 6-month window to future", () => {
        const opp = makeOpp({ closeDate: "2026-03-01" });
        expect(assignBucketKey(opp, NOW)).toBe("future");
    });

    it("assigns the first day of the current month to current month (not past)", () => {
        const opp = makeOpp({ closeDate: "2025-05-01" });
        expect(assignBucketKey(opp, NOW)).toBe("2025-05");
    });

    it("assigns the last day of the 6th month to the 6th month (not future)", () => {
        const opp = makeOpp({ closeDate: "2025-10-31" });
        expect(assignBucketKey(opp, NOW)).toBe("2025-10");
    });

    it("assigns the first day of the month after the window to future", () => {
        const opp = makeOpp({ closeDate: "2025-11-01" });
        expect(assignBucketKey(opp, NOW)).toBe("future");
    });
});

// ── buildForecastGroups ───────────────────────────────────────────────────────

describe("buildForecastGroups", () => {
    it("groups opportunities by a custom field value", () => {
        const opps = [
            makeOpp({ value: 10000, expectedValue: 5000, customFields: { region: "NA" } }),
            makeOpp({ value: 20000, expectedValue: 10000, customFields: { region: "EMEA" } }),
            makeOpp({ value: 5000, expectedValue: 2500, customFields: { region: "NA" } }),
        ];
        const groups = buildForecastGroups(opps, "region");
        expect(groups).toHaveLength(2);

        const na = groups.find(g => g.value === "NA")!;
        expect(na.count).toBe(2);
        expect(na.totalValue).toBe(15000);
        expect(na.expectedValue).toBe(7500);

        const emea = groups.find(g => g.value === "EMEA")!;
        expect(emea.count).toBe(1);
        expect(emea.totalValue).toBe(20000);
    });

    it("places null / undefined / empty-string values in the — group", () => {
        const opps = [
            makeOpp({ customFields: { region: "" } }),
            makeOpp({ customFields: {} }),                  // field missing entirely
            makeOpp({ customFields: { region: "   " } }),   // whitespace only
        ];
        const groups = buildForecastGroups(opps, "region");
        expect(groups).toHaveLength(1);
        expect(groups[0].value).toBe("—");
        expect(groups[0].count).toBe(3);
    });

    it("does NOT normalize casing — NA and na are separate groups", () => {
        const opps = [
            makeOpp({ customFields: { region: "NA" } }),
            makeOpp({ customFields: { region: "na" } }),
            makeOpp({ customFields: { region: "Na" } }),
        ];
        const groups = buildForecastGroups(opps, "region");
        expect(groups).toHaveLength(3);
        const values = groups.map(g => g.value);
        expect(values).toContain("NA");
        expect(values).toContain("na");
        expect(values).toContain("Na");
    });

    it("sorts named groups alphabetically", () => {
        const opps = [
            makeOpp({ customFields: { region: "EMEA" } }),
            makeOpp({ customFields: { region: "APAC" } }),
            makeOpp({ customFields: { region: "NA" } }),
        ];
        const groups = buildForecastGroups(opps, "region");
        const values = groups.map(g => g.value);
        expect(values).toEqual(["APAC", "EMEA", "NA"]);
    });

    it("always puts — last regardless of other values", () => {
        const opps = [
            makeOpp({ customFields: { region: "ZZZZZ" } }),
            makeOpp({ customFields: {} }),
            makeOpp({ customFields: { region: "AAAAA" } }),
        ];
        const groups = buildForecastGroups(opps, "region");
        expect(groups[groups.length - 1].value).toBe("—");
    });

    it("trims leading and trailing whitespace from values", () => {
        const opps = [
            makeOpp({ customFields: { region: "  NA  " } }),
            makeOpp({ customFields: { region: "NA" } }),
        ];
        const groups = buildForecastGroups(opps, "region");
        expect(groups).toHaveLength(1);
        expect(groups[0].value).toBe("NA");
        expect(groups[0].count).toBe(2);
    });

    it("coerces number field values to strings", () => {
        const opps = [
            makeOpp({ customFields: { headcount: 100 } }),
            makeOpp({ customFields: { headcount: 100 } }),
            makeOpp({ customFields: { headcount: 200 } }),
        ];
        const groups = buildForecastGroups(opps, "headcount");
        expect(groups).toHaveLength(2);
        const g100 = groups.find(g => g.value === "100")!;
        expect(g100.count).toBe(2);
    });

    it("returns an empty array when given no opportunities", () => {
        expect(buildForecastGroups([], "region")).toEqual([]);
    });
});

// ── computeForecast ───────────────────────────────────────────────────────────

describe("computeForecast", () => {
    it("excludes won and lost opps with current/future close dates from totals and forward buckets", () => {
        const opps = [
            makeOpp({ stageStatus: "pending", closeDate: "2025-05-15", value: 10000, expectedValue: 5000 }),
            makeOpp({ stageStatus: "won", closeDate: "2025-05-15", value: 20000, expectedValue: 20000 }),
            makeOpp({ stageStatus: "lost", closeDate: "2025-05-15", value: 5000, expectedValue: 0 }),
        ];
        const result = computeForecast(opps, NOW, null);
        // Totals are pending-only (open pipeline)
        expect(result.totalCount).toBe(1);
        expect(result.totalValue).toBe(10000);
        expect(result.expectedValue).toBe(5000);
        // The current-month bucket also excludes the won/lost opps
        const mayBucket = result.buckets.find(b => b.key === "2025-05")!;
        expect(mayBucket.count).toBe(1);
    });

    it("includes won and lost opps with past close dates in the Past Due bucket", () => {
        const opps = [
            makeOpp({ stageStatus: "won", closeDate: "2025-04-10", value: 20000, expectedValue: 20000 }),
            makeOpp({ stageStatus: "lost", closeDate: "2025-03-15", value: 5000, expectedValue: 0 }),
            makeOpp({ stageStatus: "pending", closeDate: "2025-04-20", value: 8000, expectedValue: 4000 }),
        ];
        const result = computeForecast(opps, NOW, null);
        const pastBucket = result.buckets.find(b => b.key === "past")!;
        // All three (won + lost + pending) appear in Past Due
        expect(pastBucket.count).toBe(3);
        expect(pastBucket.totalValue).toBe(33000);
        // Totals still reflect pending-only open pipeline
        expect(result.totalCount).toBe(1);
        expect(result.totalValue).toBe(8000);
        expect(result.expectedValue).toBe(4000);
    });

    it("always returns exactly 9 buckets", () => {
        const result = computeForecast([], NOW, null);
        expect(result.buckets).toHaveLength(9);
    });

    it("correctly routes opportunities to their respective buckets", () => {
        const opps = [
            makeOpp({ closeDate: "2025-04-01", value: 1000, expectedValue: 500 }),   // past
            makeOpp({ closeDate: "2025-05-20", value: 2000, expectedValue: 1000 }),  // current month
            makeOpp({ closeDate: "2025-07-10", value: 3000, expectedValue: 1500 }),  // 2 months out
            makeOpp({ closeDate: "2026-06-01", value: 4000, expectedValue: 2000 }),  // future
            makeOpp({ closeDate: null, value: 5000, expectedValue: 2500 }),          // no-date
        ];
        const result = computeForecast(opps, NOW, null);

        const bucket = (key: string) => result.buckets.find(b => b.key === key)!;
        expect(bucket("past").count).toBe(1);
        expect(bucket("2025-05").count).toBe(1);
        expect(bucket("2025-07").count).toBe(1);
        expect(bucket("future").count).toBe(1);
        expect(bucket("no-date").count).toBe(1);
    });

    it("returns groups on buckets when groupBy is provided", () => {
        const opps = [
            makeOpp({ closeDate: "2025-05-15", customFields: { region: "NA" } }),
            makeOpp({ closeDate: "2025-05-20", customFields: { region: "EMEA" } }),
        ];
        const result = computeForecast(opps, NOW, "region");
        const mayBucket = result.buckets.find(b => b.key === "2025-05")!;
        expect(mayBucket.groups).toBeDefined();
        expect(mayBucket.groups).toHaveLength(2);
    });

    it("returns no groups on buckets when groupBy is null", () => {
        const opps = [makeOpp({ closeDate: "2025-05-15" })];
        const result = computeForecast(opps, NOW, null);
        result.buckets.forEach(b => {
            expect(b.groups).toBeUndefined();
        });
    });

    it("empty buckets have count 0 and zero values", () => {
        const result = computeForecast([], NOW, null);
        result.buckets.forEach(b => {
            expect(b.count).toBe(0);
            expect(b.totalValue).toBe(0);
            expect(b.expectedValue).toBe(0);
        });
    });

    it("sums totalValue and expectedValue correctly across all open opps", () => {
        const opps = [
            makeOpp({ stageStatus: "pending", value: 10000, expectedValue: 3000 }),
            makeOpp({ stageStatus: "pending", value: 20000, expectedValue: 6000 }),
            makeOpp({ stageStatus: "won", value: 99999, expectedValue: 99999 }), // excluded
        ];
        const result = computeForecast(opps, NOW, null);
        expect(result.totalValue).toBe(30000);
        expect(result.expectedValue).toBe(9000);
    });
});
