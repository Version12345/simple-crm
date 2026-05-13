import { useState, useEffect, useCallback } from "react";
import { Lead, CustomField, Opportunity, Stage } from "./types";
import axios, { AxiosError } from "axios";

type OppFormMode = "hidden" | "add" | { edit: Opportunity };

interface ApiErrorBody {
    error: string;
}

export const LeadRow: React.FC<{ lead: Lead; onUpdate: () => void; index: number }> = ({ lead, onUpdate, index }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showOpps, setShowOpps] = useState(false);

    // Lead edit state
    const [firstName, setFirstName] = useState(lead.firstName);
    const [lastName, setLastName] = useState(lead.lastName);
    const [age, setAge] = useState(`${lead.age}`);
    const [phoneNumber, setPhoneNumber] = useState(lead.phoneNumber);
    const [leadCustomFields, setLeadCustomFields] = useState<CustomField[]>([]);
    const [leadCustomFieldValues, setLeadCustomFieldValues] = useState<Record<string, string>>(lead.customFields || {});
    const [leadError, setLeadError] = useState("");
    const [leadSuccess, setLeadSuccess] = useState(false);
    const [leadLoading, setLeadLoading] = useState(false);

    // Delete state
    const [deletePending, setDeletePending] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Opportunity state
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [oppFormMode, setOppFormMode] = useState<OppFormMode>("hidden");
    const [stages, setStages] = useState<Stage[]>([]);
    const [oppCustomFields, setOppCustomFields] = useState<CustomField[]>([]);
    const [oppName, setOppName] = useState("");
    const [oppValue, setOppValue] = useState("");
    const [oppStageId, setOppStageId] = useState("");
    const [oppCloseDate, setOppCloseDate] = useState("");
    const [oppCustomFieldValues, setOppCustomFieldValues] = useState<Record<string, string>>({});
    const [oppError, setOppError] = useState("");
    const [oppLoading, setOppLoading] = useState(false);

    // ── fetchers ────────────────────────────────────────────────────

    const fetchLeadCustomFields = useCallback(async () => {
        const result = await axios.get<CustomField[]>("/api/custom-fields");
        // B1 fix: filter to lead-scoped fields only
        setLeadCustomFields(result.data.filter(f => f.entity === "lead"));
    }, []);

    const fetchOppCustomFields = useCallback(async () => {
        const result = await axios.get<CustomField[]>("/api/custom-fields");
        // B1 fix: filter to opportunity-scoped fields only
        setOppCustomFields(result.data.filter(f => f.entity === "opportunity"));
    }, []);

    const fetchOpportunities = useCallback(async () => {
        // B2 fix: fetch only this lead's opportunities via query param
        const result = await axios.get<Opportunity[]>(`/api/opportunities?leadId=${lead.id}`);
        setOpportunities(result.data);
    }, [lead.id]);

    const fetchStages = useCallback(async () => {
        const result = await axios.get<Stage[]>("/api/stages");
        setStages(result.data);
    }, []);

    useEffect(() => {
        if (isEditing) fetchLeadCustomFields();
    }, [isEditing, fetchLeadCustomFields]);

    useEffect(() => {
        if (showOpps) {
            fetchOpportunities();
            fetchStages();
            fetchOppCustomFields();
        }
    }, [showOpps, fetchOpportunities, fetchStages, fetchOppCustomFields]);

    // ── lead handlers ────────────────────────────────────────────────

    const handleLeadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLeadLoading(true);
        setLeadError("");
        try {
            await axios.put(`/api/leads/${lead.id}`, {
                firstName,
                lastName,
                age,
                phoneNumber,
                customFields: leadCustomFieldValues,
            });
            setLeadSuccess(true);
            setIsEditing(false);
            setLeadError("");
            onUpdate();
        } catch (err) {
            const axiosErr = err as AxiosError<ApiErrorBody>;
            setLeadError(axiosErr.response?.data?.error ?? "Failed to update lead");
        }
        setLeadLoading(false);
    };

    // ── opportunity form helpers ──────────────────────────────────────

    const openAddForm = () => {
        setOppName("");
        setOppValue("");
        setOppStageId(stages[0] ? String(stages[0].id) : "");
        setOppCloseDate("");
        setOppCustomFieldValues({});
        setOppError("");
        setOppFormMode("add");
    };

    const openEditForm = (opp: Opportunity) => {
        setOppName(opp.name ?? "");
        setOppValue(String(opp.value));
        setOppStageId(String(opp.stage.id));
        setOppCloseDate(opp.closeDate ?? "");
        const vals: Record<string, string> = {};
        for (const [k, v] of Object.entries(opp.customFields ?? {})) {
            vals[k] = String(v);
        }
        setOppCustomFieldValues(vals);
        setOppError("");
        setOppFormMode({ edit: opp });
    };

    const cancelOppForm = () => {
        setOppFormMode("hidden");
        setOppError("");
    };

    // ── opportunity handlers ─────────────────────────────────────────

    const handleOppCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setOppLoading(true);
        setOppError("");
        try {
            await axios.post("/api/opportunities", {
                leadId: lead.id,
                name: oppName,
                value: parseFloat(oppValue),
                stageId: parseInt(oppStageId, 10),
                closeDate: oppCloseDate || null,
                customFields: oppCustomFieldValues,
            });
            setOppFormMode("hidden");
            fetchOpportunities();
        } catch (err) {
            const axiosErr = err as AxiosError<ApiErrorBody>;
            setOppError(axiosErr.response?.data?.error ?? "Failed to create opportunity");
        }
        setOppLoading(false);
    };

    const handleOppEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (typeof oppFormMode !== "object" || oppFormMode === null) return;
        setOppLoading(true);
        setOppError("");
        try {
            await axios.put(`/api/opportunities/${oppFormMode.edit.id}`, {
                name: oppName,
                value: parseFloat(oppValue),
                stageId: parseInt(oppStageId, 10),
                closeDate: oppCloseDate || null,
                customFields: oppCustomFieldValues,
            });
            setOppFormMode("hidden");
            fetchOpportunities();
        } catch (err) {
            const axiosErr = err as AxiosError<ApiErrorBody>;
            setOppError(axiosErr.response?.data?.error ?? "Failed to update opportunity");
        }
        setOppLoading(false);
    };

    const deleteOpportunity = async (oppId: number) => {
        await axios.delete(`/api/opportunities/${oppId}`);
        fetchOpportunities();
    };

    const handleDeleteLead = async () => {
        setDeleteLoading(true);
        try {
            await axios.delete(`/api/leads/${lead.id}`);
            onUpdate(); // parent refreshes the list; this row will unmount
        } catch {
            setDeletePending(false);
            setDeleteLoading(false);
        }
    };

    // ── formatting ───────────────────────────────────────────────────

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return "—";
        const [year, month, day] = dateStr.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    // ── render ───────────────────────────────────────────────────────

    const rowBg = index % 2 === 0 ? "bg-white" : "bg-gray-50";

    const isAddMode = oppFormMode === "add";

    return (
        <>
            {/* ── main lead row — always visible ── */}
            <tr className={`${deletePending ? "ring-2 ring-inset ring-red-200 bg-red-50" : `${rowBg} ${isEditing ? "ring-2 ring-inset ring-blue-300" : "hover:bg-blue-50"}`} transition-colors`}>
                <td className="px-4 py-3">
                    {deletePending ? (
                        /* Inline delete confirmation — no browser dialog */
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-xs font-medium text-red-600">Delete lead + all opps?</span>
                            <button
                                onClick={handleDeleteLead}
                                disabled={deleteLoading}
                                className="px-2.5 py-1 text-xs font-medium rounded bg-red-500 text-white hover:bg-red-600 disabled:bg-gray-300 transition-colors"
                            >
                                {deleteLoading ? "…" : "Yes"}
                            </button>
                            <button
                                onClick={() => setDeletePending(false)}
                                disabled={deleteLoading}
                                className="px-2.5 py-1 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                                No
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => {
                                    if (isEditing) {
                                        // Closing — reset form to saved values
                                        setFirstName(lead.firstName);
                                        setLastName(lead.lastName);
                                        setAge(`${lead.age}`);
                                        setPhoneNumber(lead.phoneNumber);
                                        setLeadCustomFieldValues(lead.customFields || {});
                                        setLeadError("");
                                        setLeadSuccess(false);
                                    } else {
                                        // Opening — collapse the opps panel
                                        setShowOpps(false);
                                        setOppFormMode("hidden");
                                    }
                                    setIsEditing(prev => !prev);
                                }}
                                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                                    isEditing
                                        ? "border-blue-400 bg-blue-500 text-white hover:bg-blue-600"
                                        : "border-blue-300 text-blue-600 hover:bg-blue-50"
                                }`}
                            >
                                {isEditing ? "Close" : "Edit"}
                            </button>
                            <button
                                onClick={() => {
                                    if (!showOpps) {
                                        // Opening — collapse the edit panel and reset its form
                                        setIsEditing(false);
                                        setFirstName(lead.firstName);
                                        setLastName(lead.lastName);
                                        setAge(`${lead.age}`);
                                        setPhoneNumber(lead.phoneNumber);
                                        setLeadCustomFieldValues(lead.customFields || {});
                                        setLeadError("");
                                        setLeadSuccess(false);
                                    }
                                    setShowOpps(prev => !prev);
                                }}
                                className={`px-2.5 py-1 text-xs font-medium whitespace-nowrap rounded border transition-colors ${
                                    showOpps
                                        ? "border-indigo-400 bg-indigo-500 text-white hover:bg-indigo-600"
                                        : "border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                                }`}
                            >
                                {showOpps ? "Hide Opps" : "Show Opps"}
                            </button>
                            <button
                                onClick={() => {
                                    // Close any open panels before entering delete-pending state
                                    setIsEditing(false);
                                    setShowOpps(false);
                                    setOppFormMode("hidden");
                                    setDeletePending(true);
                                }}
                                className="px-2.5 py-1 text-xs font-medium rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    )}
                </td>
                <td className="px-4 py-3 text-gray-800">{lead.firstName}</td>
                <td className="px-4 py-3 text-gray-800">{lead.lastName}</td>
                <td className="px-4 py-3 text-gray-500">{lead.age}</td>
                <td className="px-4 py-3 text-gray-600">{lead.phoneNumber}</td>
            </tr>

            {/* ── edit lead form — expands below the row ── */}
            {isEditing && (
                <tr className={rowBg}>
                    <td colSpan={5}>
                        <div className="bg-gray-50 p-4">
                            <h3 className="text-sm font-semibold mb-3">Edit Lead</h3>
                            <form onSubmit={handleLeadSubmit} className="space-3">
                                {leadError && <p className="text-red-500 text-sm">{leadError}</p>}
                                {leadSuccess && <p className="text-green-600 text-sm">Lead updated successfully</p>}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={e => setFirstName(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={e => setLastName(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                                        <input
                                            type="text"
                                            value={age}
                                            onChange={e => setAge(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                                        <input
                                            type="text"
                                            value={phoneNumber}
                                            onChange={e => setPhoneNumber(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
                                        />
                                    </div>
                                    {leadCustomFields.map(field => (
                                        <div key={field.id}>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                {field.label}
                                            </label>
                                            <input
                                                type="text"
                                                value={leadCustomFieldValues[field.name] ?? ""}
                                                onChange={e =>
                                                    setLeadCustomFieldValues({
                                                        ...leadCustomFieldValues,
                                                        [field.name]: e.target.value,
                                                    })
                                                }
                                                className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 pt-1 mt-4">
                                    <button
                                        type="submit"
                                        disabled={leadLoading}
                                        className="flex-1 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium transition-colors"
                                    >
                                        Update Lead
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFirstName(lead.firstName);
                                            setLastName(lead.lastName);
                                            setAge(`${lead.age}`);
                                            setPhoneNumber(lead.phoneNumber);
                                            setLeadCustomFieldValues(lead.customFields || {});
                                            setLeadError("");
                                            setLeadSuccess(false);
                                            setIsEditing(false);
                                        }}
                                        className="flex-1 p-2 bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </td>
                </tr>
            )}

            {showOpps && (
                <tr>
                    <td colSpan={5} className="p-4 bg-gray-50">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-700">Opportunities</h3>
                                {oppFormMode === "hidden" && (
                                    <button
                                        onClick={openAddForm}
                                        className="text-xs font-medium bg-emerald-500 text-white px-3 py-1.5 rounded-md hover:bg-emerald-600 transition-colors"
                                    >
                                        + Add Opportunity
                                    </button>
                                )}
                            </div>

                            {/* Opportunity list — edit form expands inline below its card */}
                            {opportunities.length === 0 && !isAddMode ? (
                                <p className="text-gray-500 text-sm">No opportunities yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {opportunities.map(opp => {
                                        const isThisCardEditing =
                                            typeof oppFormMode === "object" &&
                                            oppFormMode !== null &&
                                            oppFormMode.edit.id === opp.id;
                                        return (
                                            <div key={opp.id}>
                                                {/* Card — rounded-b removed and blue ring applied when editing */}
                                                <div className={`p-3 bg-white border shadow-sm ${isThisCardEditing ? "rounded-t border-blue-300 ring-1 ring-blue-200" : "rounded"}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-0.5">
                                                            <div className="font-medium">{opp.name ?? "Unnamed"}</div>
                                                            <div className="text-sm text-gray-600 flex flex-wrap gap-x-3">
                                                                <span>{opp.stage.name}</span>
                                                                <span>{formatCurrency(opp.value)}</span>
                                                                {/* B3 fix: use stored expectedValue, not a live calc */}
                                                                <span className="text-gray-400">
                                                                    Expected: {formatCurrency(opp.expectedValue ?? 0)}
                                                                </span>
                                                                <span className="text-gray-400">
                                                                    Close: {formatDate(opp.closeDate)}
                                                                </span>
                                                            </div>
                                                            {oppCustomFields.length > 0 && (
                                                                <div className="text-xs text-gray-400 flex flex-wrap gap-x-2 mt-1">
                                                                    {oppCustomFields.map(f => {
                                                                        const raw = opp.customFields?.[f.name];
                                                                        const val = raw !== undefined && raw !== null && String(raw).trim() !== ""
                                                                            ? String(raw)
                                                                            : "—";
                                                                        return (
                                                                            <span key={f.name}>{f.label}: {val}</span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1.5 ml-4 shrink-0">
                                                            <button
                                                                onClick={() => isThisCardEditing ? cancelOppForm() : openEditForm(opp)}
                                                                className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors ${
                                                                    isThisCardEditing
                                                                        ? "border-blue-400 bg-blue-500 text-white hover:bg-blue-600"
                                                                        : "border-amber-300 text-amber-700 hover:bg-amber-50"
                                                                }`}
                                                            >
                                                                {isThisCardEditing ? "Close" : "Edit"}
                                                            </button>
                                                            <button
                                                                onClick={() => deleteOpportunity(opp.id)}
                                                                className="text-xs font-medium px-2.5 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Edit form — expands directly below this card only */}
                                                {isThisCardEditing && (
                                                    <form
                                                        onSubmit={handleOppEdit}
                                                        className="p-4 bg-white border border-t-0 border-blue-300 rounded-b shadow-sm space-y-3"
                                                    >
                                                        <h4 className="font-semibold text-gray-700">Edit Opportunity</h4>
                                                        {oppError && <p className="text-red-500 text-sm">{oppError}</p>}

                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="col-span-2">
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Deal name"
                                                                    value={oppName}
                                                                    onChange={e => setOppName(e.target.value)}
                                                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Value ($)</label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="any"
                                                                    placeholder="10000"
                                                                    value={oppValue}
                                                                    onChange={e => setOppValue(e.target.value)}
                                                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Close Date</label>
                                                                <input
                                                                    type="date"
                                                                    value={oppCloseDate}
                                                                    onChange={e => setOppCloseDate(e.target.value)}
                                                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                                                />
                                                            </div>

                                                            <div className="col-span-2">
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
                                                                <select
                                                                    value={oppStageId}
                                                                    onChange={e => setOppStageId(e.target.value)}
                                                                    className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                                                >
                                                                    {stages.map(s => (
                                                                        <option key={s.id} value={s.id}>
                                                                            {s.name} ({s.status})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            {oppCustomFields.map(field => (
                                                                <div key={field.id}>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                        {field.label}
                                                                    </label>
                                                                    <input
                                                                        type={field.type === "number" ? "number" : "text"}
                                                                        placeholder={field.label}
                                                                        value={oppCustomFieldValues[field.name] ?? ""}
                                                                        onChange={e =>
                                                                            setOppCustomFieldValues({
                                                                                ...oppCustomFieldValues,
                                                                                [field.name]: e.target.value,
                                                                            })
                                                                        }
                                                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="flex gap-2 pt-1">
                                                            <button
                                                                type="submit"
                                                                disabled={oppLoading}
                                                                className="flex-1 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium transition-colors"
                                                            >
                                                                Save Changes
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelOppForm}
                                                                className="flex-1 p-2 bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 text-sm transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </form>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Add opportunity form — always at the bottom */}
                            {isAddMode && (
                                <form
                                    onSubmit={handleOppCreate}
                                    className="mt-2 p-4 bg-white border border-blue-200 rounded shadow-sm space-y-3"
                                >
                                    <h4 className="font-semibold text-gray-700">Add Opportunity</h4>
                                    {oppError && <p className="text-red-500 text-sm">{oppError}</p>}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                                            <input
                                                type="text"
                                                placeholder="Deal name"
                                                value={oppName}
                                                onChange={e => setOppName(e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Value ($)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                placeholder="10000"
                                                value={oppValue}
                                                onChange={e => setOppValue(e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Close Date</label>
                                            <input
                                                type="date"
                                                value={oppCloseDate}
                                                onChange={e => setOppCloseDate(e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
                                            <select
                                                value={oppStageId}
                                                onChange={e => setOppStageId(e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                            >
                                                {stages.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name} ({s.status})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {oppCustomFields.map(field => (
                                            <div key={field.id}>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    {field.label}
                                                </label>
                                                <input
                                                    type={field.type === "number" ? "number" : "text"}
                                                    placeholder={field.label}
                                                    value={oppCustomFieldValues[field.name] ?? ""}
                                                    onChange={e =>
                                                        setOppCustomFieldValues({
                                                            ...oppCustomFieldValues,
                                                            [field.name]: e.target.value,
                                                        })
                                                    }
                                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                        <button
                                            type="submit"
                                            disabled={oppLoading}
                                            className="flex-1 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium transition-colors"
                                        >
                                            Create Opportunity
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelOppForm}
                                            className="flex-1 p-2 bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 text-sm transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};
