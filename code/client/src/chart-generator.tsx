import { formatCurrencyShort } from "./utils";

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * One column in the chart. Callers transform their own data model into this
 * shape; ChartGenerator owns nothing domain-specific.
 */
export interface ChartBarItem {
    /** React key and identity. */
    key: string;
    /** Full pipeline value — drives the left (lighter) bar height. */
    totalValue: number;
    /** Expected value — drives the right (darker) bar height. */
    expectedValue: number;
    /** Count badge shown above the column when > 0. */
    count: number;
    /** [pipelineTailwindClass, expectedTailwindClass] */
    colors: [string, string];
    /** Short text shown on the X-axis below the column. */
    xLabel: string;
    /** Optional tooltip / title on the X-axis label (useful for truncated names). */
    xTitle?: string;
    /** Tooltip text for the pipeline bar. */
    pipelineTooltip: string;
    /** Tooltip text for the expected bar. */
    expectedTooltip: string;
}

interface ChartGeneratorProps {
    title: string;
    bars: ChartBarItem[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_H = 148; // px — bar drawing area height
const Y_AXIS_W = 42; // px — width reserved for Y-axis labels
const Y_TICKS = [1, 0.67, 0.33, 0] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function ChartGenerator({ title, bars }: ChartGeneratorProps): React.ReactElement {
    const maxVal = Math.max(...bars.map(b => b.totalValue), 1);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            {/* Header + legend */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-3 rounded-sm bg-indigo-200" />
                        Pipeline $
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-3 rounded-sm bg-indigo-400" />
                        Expected $
                    </span>
                </div>
            </div>

            {/* Chart body: Y-axis + bar area */}
            <div className="flex">
                {/* Y-axis tick labels */}
                <div
                    className="flex flex-col justify-between shrink-0 pr-2"
                    style={{ width: Y_AXIS_W, height: CHART_H }}
                >
                    {Y_TICKS.map(t => (
                        <span key={t} className="text-[9px] text-gray-400 leading-none text-right block">
                            {formatCurrencyShort(Math.round(maxVal * t))}
                        </span>
                    ))}
                </div>

                {/* Bar area with gridlines */}
                <div className="flex-1 relative" style={{ height: CHART_H }}>
                    {/* Horizontal gridlines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        {Y_TICKS.map(t => (
                            <div key={t} className="w-full border-t border-gray-100" />
                        ))}
                    </div>

                    {/* Bar columns */}
                    <div className="absolute inset-0 flex items-end gap-1">
                        {bars.map(bar => {
                            const [cPipeline, cExpected] = bar.colors;
                            const hP = bar.totalValue > 0
                                ? Math.max(2, Math.round((bar.totalValue / maxVal) * CHART_H))
                                : 0;
                            const hE = bar.expectedValue > 0
                                ? Math.max(2, Math.round((bar.expectedValue / maxVal) * CHART_H))
                                : 0;
                            return (
                                <div
                                    key={bar.key}
                                    className="flex-1 flex flex-col items-center justify-end relative h-full"
                                >
                                    {bar.count > 0 && (
                                        <span className="absolute top-1 text-[9px] text-gray-400 font-medium leading-none select-none">
                                            {bar.count}
                                        </span>
                                    )}
                                    <div className="flex items-end gap-px w-full justify-center">
                                        <div
                                            className={`w-3.5 rounded-t-sm transition-all duration-500 ${cPipeline}`}
                                            style={{ height: hP }}
                                            title={bar.pipelineTooltip}
                                        />
                                        <div
                                            className={`w-3.5 rounded-t-sm transition-all duration-500 ${cExpected}`}
                                            style={{ height: hE }}
                                            title={bar.expectedTooltip}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* X-axis labels */}
            <div className="flex gap-1 mt-1.5" style={{ paddingLeft: Y_AXIS_W }}>
                {bars.map(bar => (
                    <div
                        key={bar.key}
                        className="flex-1 text-center text-[9px] text-gray-400 leading-tight truncate"
                        title={bar.xTitle}
                    >
                        {bar.xLabel}
                    </div>
                ))}
            </div>
        </div>
    );
}
