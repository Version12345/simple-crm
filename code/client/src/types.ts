export type StageStatus = "pending" | "won" | "lost";

export interface Lead {
    id: number;
    firstName: string;
    lastName: string;
    age: number;
    phoneNumber: string;
    customFields?: Record<string, string>;
}

export interface CustomField {
    id: number;
    name: string;
    label: string;
    entity?: string;
    type?: string;
}

export interface Stage {
    id: number;
    name: string;
    status: StageStatus;
    conversionLikelihood: number;
    order: number;
    expectedValue?: number;
}

export interface Opportunity {
    id: number;
    lead: Lead;
    stage: Stage;
    value: number;
    expectedValue?: number;
    name?: string;
    closeDate?: string | null;
    customFields?: Record<string, string | number>;
}

export interface AppSetting {
    key: string;
    value: string;
}

export interface PipelineReport {
    totalValue: number;
    expectedValue: number;
    byStage: {
        stage: Stage;
        count: number;
        totalValue: number;
        expectedValue: number;
    }[];
}

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

export interface ForecastReport {
    totalCount: number;
    totalValue: number;
    expectedValue: number;
    buckets: ForecastBucket[];
}

// ── Kanban board ──────────────────────────────────────────────────────────────

export interface KanbanCard {
    id: number;
    name: string | null;
    status: StageStatus;        // from the card's stage — drives badge color
    expectedValue: number;
    closeDate: string | null;
}

export interface KanbanColumn {
    id: number;
    name: string;
    status: StageStatus;
    order: number;
    opportunities: KanbanCard[];
}

export interface KanbanBoardData {
    columns: KanbanColumn[];
}
