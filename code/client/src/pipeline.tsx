// ── react-kanban-kit API notes (read before TASK-4) ──────────────────────────
//
// Component:   <Kanban> (named export — NOT <Board>)
// Import:      import { Kanban, dropHandler } from "react-kanban-kit"
// Types:       import type { BoardData, BoardItem, BoardProps } from "react-kanban-kit"
//              ConfigMap / CardMove are derived via BoardProps — not exported from index
// TypeScript:  ships its own types via dist/index.d.ts — no @types/ package needed
//
// Required data shape — BoardData (flat normalised map, ALL ids must be strings):
//
//   {
//     root: { id: "root", title: "Root", children: ["col-1", "col-2"], totalChildrenCount: 2, parentId: null },
//     "col-1": { id: "col-1", title: "Cold Lead", children: ["opp-12"], totalChildrenCount: 1, parentId: "root" },
//     "opp-12": { id: "opp-12", title: "Enterprise Deal", parentId: "col-1",
//                 children: [], totalChildrenCount: 0, type: "card",
//                 content: { /* any custom fields go here */ } },
//   }
//
// ⚠️  SHAPE DIFFERENCE FROM GET /api/kanban:
//   The server returns { columns: KanbanColumn[] } (array, numeric ids).
//   The library requires a flat BoardData map with string ids.
//   Transform on the client in TASK-4 — do NOT change the server response.
//   Conversion: stage.id → `col-${stage.id}`, opp.id → `opp-${opp.id}`
//
// Card renderer — via configMap:
//   const configMap: ConfigMap = {
//     card: {
//       render: ({ data }) => <YourCardComponent data={data} />,
//       isDraggable: true,
//     },
//   }
//
// Column header:  renderColumnHeader={(column: BoardItem) => <JSX />}
//
// Drag callback:  onCardMove={(move: CardMove) => void}
//   CardMove = { cardId: string, fromColumnId: string, toColumnId: string,
//                taskAbove: string | null, taskBelow: string | null, position: number }
//
// dropHandler utility — updates dataSource after a card move:
//   setDataSource(dropHandler(move, dataSource, () => {}, updateTargetCol, updateSourceCol))
//
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { Kanban, dropHandler } from "react-kanban-kit";
import type { BoardData, BoardItem, BoardProps } from "react-kanban-kit";
import { PipelineReport, KanbanBoardData, StageStatus } from "./types";

// Derive unexported library types from the public BoardProps interface
type CardMove = Parameters<NonNullable<BoardProps["onCardMove"]>>[0];
import { formatCurrency, statusBadge } from "./utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formats a YYYY-MM-DD date string as MM/DD/YYYY, avoiding timezone drift. */
function formatClose(dateStr: string | null): string {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-");
    return `${m}/${d}/${y}`;
}

// Content stored in each column BoardItem — typed so we can safely cast from `content: any`
interface ColContent {
    status: StageStatus;
    totalExpectedValue: number;
}

// Content stored in each card BoardItem — typed so we can safely cast from `content: any`
interface OppContent {
    oppName: string | null;
    status: StageStatus;
    expectedValue: number;
    closeDate: string | null;
}

/**
 * Converts the server's KanbanBoardData (array-based, numeric ids) into the
 * flat normalised BoardData map that react-kanban-kit requires (string ids).
 *
 * Stage id mapping:  stage.id  → "col-{id}"
 * Card id mapping:   opp.id    → "opp-{id}"
 */
function toBoardData(data: KanbanBoardData): BoardData {
    const columnIds = data.columns.map(col => `col-${col.id}`);

    const result: BoardData = {
        root: {
            id: "root",
            title: "Root",
            parentId: null,
            children: columnIds,
            totalChildrenCount: columnIds.length,
        },
    };

    for (const col of data.columns) {
        const colKey = `col-${col.id}`;
        const cardIds = col.opportunities.map(opp => `opp-${opp.id}`);
        const colContent: ColContent = {
            status: col.status,
            totalExpectedValue: col.opportunities.reduce((sum, opp) => sum + opp.expectedValue, 0),
        };

        result[colKey] = {
            id: colKey,
            title: col.name,
            parentId: "root",
            children: cardIds,
            totalChildrenCount: cardIds.length,
            content: colContent,
        };

        for (const opp of col.opportunities) {
            const cardKey = `opp-${opp.id}`;
            const cardContent: OppContent = {
                oppName: opp.name,
                status: opp.status,
                expectedValue: opp.expectedValue,
                closeDate: opp.closeDate,
            };

            result[cardKey] = {
                id: cardKey,
                title: opp.name ?? "—",
                parentId: colKey,
                children: [],
                totalChildrenCount: 0,
                type: "card",
                content: cardContent,
            };
        }
    }

    return result;
}

// configMap is stable — defined at module level so it is never re-created on render
const configMap: BoardProps["configMap"] = {
    card: {
        render: ({ data }) => {
            // content is typed as `any` by the library; we assert to our known shape
            const content = data.content as OppContent;
            return (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 space-y-1 cursor-grab active:cursor-grabbing">
                    <p className="font-medium text-sm text-gray-900 truncate">
                        {content.oppName ?? "—"}
                    </p>
                    <span
                        className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusBadge(content.status)}`}
                    >
                        {content.status}
                    </span>
                    <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">Expected: </span>
                        {content.expectedValue ? formatCurrency(content.expectedValue) : "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">Closes: </span>
                        {formatClose(content.closeDate)}
                    </p>
                </div>
            );
        },
        isDraggable: true,
    },
};

// ── KanbanBoard ───────────────────────────────────────────────────────────────

function KanbanBoard({
    board,
    onDragSuccess,
}: {
    board: KanbanBoardData;
    onDragSuccess: () => void;
}) {
    const [dataSource, setDataSource] = useState<BoardData>(() => toBoardData(board));
    const [dragError, setDragError] = useState<string | null>(null);

    // Sync library state when the parent re-fetches after a successful drag
    useEffect(() => {
        setDataSource(toBoardData(board));
    }, [board]);

    const handleCardMove = useCallback(async (move: CardMove) => {
        setDragError(null);

        // Snapshot for rollback on API failure
        const snapshot = dataSource;

        // Optimistic update — apply the drop immediately so the UI feels instant
        const newDataSource = dropHandler(
            move,
            dataSource,
            () => {},
            (target) => ({ ...target, totalChildrenCount: target.totalChildrenCount + 1 }),
            (source) => ({ ...source, totalChildrenCount: source.totalChildrenCount - 1 }),
        );
        setDataSource(newDataSource);

        // Build reorder payload from the post-drop dataSource.
        // Sends the full column order so the server can persist both position and
        // stage changes (cross-column) in a single request.
        const columns = newDataSource.root.children.map(colId => ({
            stageId: parseInt(colId.replace("col-", ""), 10),
            opportunityIds: newDataSource[colId].children.map(
                cardId => parseInt(cardId.replace("opp-", ""), 10)
            ),
        }));

        try {
            await axios.patch("/api/kanban/reorder", { columns });
            // Re-fetch so summary cards + column totals reflect server-computed values
            onDragSuccess();
        } catch {
            // Revert the optimistic update and surface the error to the user
            setDataSource(snapshot);
            setDragError("Failed to save order. Please try again.");
        }
    }, [dataSource, onDragSuccess]);

    return (
        // bg-gray-50 board backdrop, overflow-x-auto enables horizontal scroll on all viewports
        <div className="bg-gray-50 rounded-xl p-4 overflow-x-auto">
            {dragError && (
                <p className="mb-3 text-sm text-red-600">{dragError}</p>
            )}
            <Kanban
                dataSource={dataSource}
                configMap={configMap}
                onCardMove={handleCardMove}
                // Disable virtual scrolling — dataset is small and it allows plain CSS overflow
                virtualization={false}
                // min-w-max prevents the flex container from collapsing, keeping the scrollbar active
                rootClassName="flex gap-4 min-w-max"
                // w-60 fixes column width at 240px; flex-shrink-0 prevents columns from squishing
                columnWrapperClassName={() => "w-60 flex-shrink-0"}
                // Column card: rounded border shadow, clips header border-radius cleanly
                columnClassName={() => "rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden flex flex-col"}
                // Remove library default header padding — our renderColumnHeader owns its own padding
                columnHeaderClassName={() => "p-0"}
                // Vertically scrollable card list; offset accounts for page header + summary cards
                columnListContentClassName={() => "overflow-y-auto max-h-[calc(100vh-280px)] pb-2"}
                // 8px gap between cards
                cardsGap={8}
                // Show "No opportunities" placeholder only for empty columns
                allowListFooter={(col: BoardItem) => col.totalChildrenCount === 0}
                renderListFooter={() => (
                    <p className="text-gray-400 text-sm text-center py-4">No opportunities</p>
                )}
                renderColumnHeader={(column: BoardItem) => {
                    // content is typed as `any` by the library; we assert to our known shape
                    const content = column.content as ColContent;
                    return (
                        <div className={`flex justify-between items-center px-3 py-2 ${statusBadge(content.status)}`}>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{column.title}</span>
                                <span className="text-xs font-medium bg-white/60 rounded-full px-1.5 py-0.5">
                                    {column.totalChildrenCount}
                                </span>
                            </div>
                            <span className="text-xs font-medium opacity-80">
                                {formatCurrency(content.totalExpectedValue)}
                            </span>
                        </div>
                    );
                }}
            />
        </div>
    );
}

// ── Pipeline page ─────────────────────────────────────────────────────────────

export const Pipeline: React.FC = () => {
    const [report, setReport] = useState<PipelineReport | null>(null);
    const [board, setBoard] = useState<KanbanBoardData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchPipeline = useCallback(async () => {
        const result = await axios.get<PipelineReport>("/api/pipeline");
        setReport(result.data);
    }, []);

    const fetchBoard = useCallback(async () => {
        const result = await axios.get<KanbanBoardData>("/api/kanban");
        setBoard(result.data);
    }, []);

    // Initial load — gate with a single loading flag covering both fetches
    useEffect(() => {
        setLoading(true);
        void Promise.all([fetchPipeline(), fetchBoard()]).finally(() => setLoading(false));
    }, [fetchPipeline, fetchBoard]);

    // Called by KanbanBoard after a successful drag-and-drop save.
    // Re-fetches both endpoints so summary cards and column totals stay accurate.
    const handleDragSuccess = useCallback(async () => {
        await Promise.all([fetchBoard(), fetchPipeline()]);
    }, [fetchBoard, fetchPipeline]);

    if (loading) {
        return <p className="text-gray-500">Loading pipeline…</p>;
    }

    if (!report) {
        return <p className="text-gray-500">No pipeline data</p>;
    }

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

            {/* Kanban board */}
            {board && <KanbanBoard board={board} onDragSuccess={handleDragSuccess} />}
        </div>
    );
};
