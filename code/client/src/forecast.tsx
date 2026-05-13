import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { ForecastReport, ForecastBucket, CustomField } from "./types";
import { formatCurrency, formatPercent, forecastBarColors, forecastShortLabel } from "./utils";
import { ChartGenerator, ChartBarItem } from "./chart-generator";

// ── Bar chart ─────────────────────────────────────────────────────────────────

function ForecastChart({ report }: { report: ForecastReport }) {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentYear = now.getFullYear();

    const bars: ChartBarItem[] = report.buckets.map(bucket => {
        const label = forecastShortLabel(bucket.key, currentYear);
        return {
            key: bucket.key,
            totalValue: bucket.totalValue,
            expectedValue: bucket.expectedValue,
            count: bucket.count,
            colors: forecastBarColors(bucket.key, currentMonthKey),
            xLabel: label,
            pipelineTooltip: `${label} — Pipeline: ${formatCurrency(bucket.totalValue)}`,
            expectedTooltip: `${label} — Expected: ${formatCurrency(bucket.expectedValue)}`,
        };
    });

    return (
        <ChartGenerator
            title="Pipeline vs. Expected Revenue by Period"
            bars={bars}
        />
    );
}

function BucketRowClass(key: string): string {
    if (key === "past") {
        return "bg-amber-50";
    }

    if (key === "no-date") {
        return "bg-gray-50";
    }
    
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    
    if (key === currentKey) {
        return "bg-blue-50";
    }

    return "";
}

function BucketLabel({ bucket }: { bucket: ForecastBucket }) {
    if (bucket.key === "past") {
        return (
            <span className="flex items-center gap-1.5">
                <span className="text-amber-500 font-bold">!</span>
                {bucket.label}
            </span>
        );
    }
    if (bucket.key === "no-date") {
        return <span className="text-gray-400 italic">{bucket.label}</span>;
    }
    return <span>{bucket.label}</span>;
}

interface FlatRowProps {
    bucket: ForecastBucket;
}

function FlatRow({ bucket }: FlatRowProps) {
    const rowClass = BucketRowClass(bucket.key);
    const isEmpty = bucket.count === 0;
    return (
        <tr className={rowClass}>
            <td className="border border-gray-200 px-4 py-2.5 font-medium text-sm w-44">
                <BucketLabel bucket={bucket} />
            </td>
            <td className="border border-gray-200 px-4 py-2.5 text-right text-sm tabular-nums">
                {isEmpty ? <span className="text-gray-300">—</span> : bucket.count}
            </td>
            <td className="border border-gray-200 px-4 py-2.5 text-right text-sm tabular-nums font-mono">
                {isEmpty ? <span className="text-gray-300">—</span> : formatCurrency(bucket.totalValue)}
            </td>
            <td className="border border-gray-200 px-4 py-2.5 text-right text-sm tabular-nums font-mono font-semibold">
                {isEmpty ? <span className="text-gray-300">—</span> : formatCurrency(bucket.expectedValue)}
            </td>
        </tr>
    );
}

interface GroupedRowsProps {
    bucket: ForecastBucket;
}

function GroupedRows({ bucket }: GroupedRowsProps) {
    const rowClass = BucketRowClass(bucket.key);
    const groups = bucket.groups ?? [];

    if (bucket.count === 0) {
        return (
            <tr className={rowClass}>
                <td className="border border-gray-200 px-4 py-2.5 font-medium text-sm w-44">
                    <BucketLabel bucket={bucket} />
                </td>
                <td colSpan={5} className="border border-gray-200 px-4 py-2.5 text-sm text-gray-300 text-center">
                    —
                </td>
            </tr>
        );
    }

    return (
        <>
            {groups.map((group, idx) => (
                <tr key={group.value} className={rowClass}>
                    {idx === 0 && (
                        <td
                            className="border border-gray-200 px-4 py-2.5 font-medium text-sm align-top w-44"
                            rowSpan={groups.length}
                        >
                            <BucketLabel bucket={bucket} />
                        </td>
                    )}
                    <td
                        className={`border border-gray-200 px-4 py-2 text-sm ${group.value === "—" ? "text-gray-400 italic pl-6" : "pl-6"}`}
                    >
                        {group.value}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right text-sm tabular-nums text-gray-500">
                        {bucket.totalValue > 0
                            ? formatPercent(group.totalValue / bucket.totalValue)
                            : <span className="text-gray-300">—</span>
                        }
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right text-sm tabular-nums">
                        {group.count}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right text-sm tabular-nums font-mono">
                        {formatCurrency(group.totalValue)}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-right text-sm tabular-nums font-mono font-semibold">
                        {formatCurrency(group.expectedValue)}
                    </td>
                </tr>
            ))}
        </>
    );
}

export const Forecast: React.FC = () => {
    const [report, setReport] = useState<ForecastReport | null>(null);
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [groupBy, setGroupBy] = useState<string>("");
    const [loading, setLoading] = useState(true);

    const fetchForecast = useCallback(async (group: string) => {
        setLoading(true);
        const url = group ? `/api/forecast?groupBy=${encodeURIComponent(group)}` : "/api/forecast";
        const result = await axios.get<ForecastReport>(url);
        setReport(result.data);
        setLoading(false);
    }, []);

    useEffect(() => {
        axios
            .get<CustomField[]>("/api/custom-fields")
            .then(r => {
                const fields = r.data;
                setCustomFields(fields);
            });
    }, []);

    useEffect(() => {
        fetchForecast(groupBy);
    }, [groupBy, fetchForecast]);

    const isGrouped = groupBy !== "";

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Monthly Forecast</h2>

            {/* Summary cards */}
            {report && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
                            Open Opportunities
                        </p>
                        <p className="text-2xl font-bold text-blue-900">{report.totalCount}</p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">
                            Total Pipeline
                        </p>
                        <p className="text-2xl font-bold text-indigo-900">{formatCurrency(report.totalValue)}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">
                            Expected Revenue
                        </p>
                        <p className="text-2xl font-bold text-green-900">{formatCurrency(report.expectedValue)}</p>
                    </div>
                </div>
            )}

            {/* Bar chart */}
            {report && <ForecastChart report={report} />}

            {/* Group-by control */}
            <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Group by:</label>
                <select
                    value={groupBy}
                    onChange={e => setGroupBy(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">No Grouping</option>
                    {customFields.map(f => (
                        <option key={f.id} value={f.name}>
                            {f.label} ({f.entity === "lead" ? "Lead" : "Opportunity"})
                        </option>
                    ))}
                </select>
            </div>

            {/* Forecast table */}
            {loading ? (
                <p className="text-gray-500">Loading forecast…</p>
            ) : !report ? (
                <p className="text-gray-500">No data available</p>
            ) : (
                <div className="overflow-x-auto rounded-lg">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wide">
                                <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Period</th>
                                {isGrouped && (
                                    <>
                                        <th className="border border-gray-200 px-4 py-3 text-left font-semibold">
                                            {customFields.find(f => f.name === groupBy)?.label ?? groupBy}
                                        </th>
                                        <th className="border border-gray-200 px-4 py-3 text-right font-semibold">%</th>
                                    </>
                                )}
                                <th className="border border-gray-200 px-4 py-3 text-right font-semibold">Count</th>
                                <th className="border border-gray-200 px-4 py-3 text-right font-semibold">Pipeline $</th>
                                <th className="border border-gray-200 px-4 py-3 text-right font-semibold">Expected $</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.buckets.map(bucket =>
                                isGrouped ? (
                                    <GroupedRows key={bucket.key} bucket={bucket} />
                                ) : (
                                    <FlatRow key={bucket.key} bucket={bucket} />
                                )
                            )}
                        </tbody>
                        {report.totalCount > 0 && (
                            <tfoot>
                                <tr className="bg-gray-50 font-semibold text-gray-700">
                                    <td className="border border-gray-200 px-4 py-2.5 text-sm" colSpan={isGrouped ? 3 : 1}>
                                        Total
                                    </td>
                                    <td className="border border-gray-200 px-4 py-2.5 text-right text-sm tabular-nums">
                                        {report.totalCount}
                                    </td>
                                    <td className="border border-gray-200 px-4 py-2.5 text-right text-sm tabular-nums font-mono">
                                        {formatCurrency(report.totalValue)}
                                    </td>
                                    <td className="border border-gray-200 px-4 py-2.5 text-right text-sm tabular-nums font-mono text-green-700">
                                        {formatCurrency(report.expectedValue)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            {/* Data quality note when grouping is active */}
            {isGrouped && report && (
                <p className="text-xs text-gray-400">
                    Note: group values are case-sensitive as stored. Variations like "NA" and "na" appear as separate
                    groups — this reflects the underlying data quality.
                </p>
            )}
        </div>
    );
};
