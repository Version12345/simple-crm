import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { PipelineReport } from "./types";
import { formatCurrency, formatPercent, rowBg, statusBadge, pipelineBarColors, shortStageName } from "./utils";
import { ChartGenerator, ChartBarItem } from "./chart-generator";

// ── Bar chart ─────────────────────────────────────────────────────────────────

function PipelineChart({ report }: { report: PipelineReport }) {
    const bars: ChartBarItem[] = report.byStage.map(item => ({
        key: String(item.stage.id),
        totalValue: item.totalValue,
        expectedValue: item.expectedValue,
        count: item.count,
        colors: pipelineBarColors(item.stage.status),
        xLabel: shortStageName(item.stage.name),
        xTitle: item.stage.name,
        pipelineTooltip: `${item.stage.name} — Pipeline: ${formatCurrency(item.totalValue)}`,
        expectedTooltip: `${item.stage.name} — Expected: ${formatCurrency(item.expectedValue)}`,
    }));

    return (
        <ChartGenerator
            title="Pipeline vs. Expected Value by Stage"
            bars={bars}
        />
    );
}

// ── Pipeline page ─────────────────────────────────────────────────────────────

export const Pipeline: React.FC = () => {
    const [report, setReport] = useState<PipelineReport | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchPipeline = useCallback(async () => {
        setLoading(true);
        const result = await axios.get<PipelineReport>("/api/pipeline");
        setReport(result.data);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchPipeline();
    }, [fetchPipeline]);

    if (loading) {
        return <p className="text-gray-500">Loading pipeline…</p>;
    }

    if (!report) {
        return <p className="text-gray-500">No pipeline data</p>;
    }

    const totalCount = report.byStage.reduce((s, i) => s + i.count, 0);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Pipeline Report</h2>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
                        Total Pipeline Value
                    </p>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(report.totalValue)}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">
                        Expected Close Value
                    </p>
                    <p className="text-2xl font-bold text-green-900">{formatCurrency(report.expectedValue)}</p>
                </div>
            </div>

            {/* Bar chart */}
            <PipelineChart report={report} />

            {/* Table */}
            <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Stage
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
                                Count
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Pipeline $
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                                Likelihood
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Expected $
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {report.byStage.map((item, idx) => (
                            <tr key={item.stage.id} className={rowBg(item.stage.status, idx)}>
                                <td className="px-4 py-3">
                                    <span className="font-medium text-gray-900">{item.stage.name}</span>
                                    <span
                                        className={`ml-2 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusBadge(item.stage.status)}`}
                                    >
                                        {item.stage.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                                    {item.count}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700">
                                    {formatCurrency(item.totalValue)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700">
                                    {formatPercent(item.stage.conversionLikelihood)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-gray-900">
                                    {formatCurrency(item.expectedValue)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-700">
                            <td className="px-4 py-3 text-sm">Total</td>
                            <td className="px-4 py-3 text-right text-sm tabular-nums">{totalCount}</td>
                            <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
                                {formatCurrency(report.totalValue)}
                            </td>
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-green-700">
                                {formatCurrency(report.expectedValue)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};
