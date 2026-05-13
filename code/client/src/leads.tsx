import axios from "axios";
import { useEffect, useState } from "react";
import { Lead } from "./types";
import { LeadRow } from "./lead-row";

export const Leads: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger = 0 }) => {
    const [leads, setLeads] = useState<Lead[]>([]);

    useEffect(() => {
        fetchLeads();
    }, [refreshTrigger]);

    const fetchLeads = async () => {
        const result = await axios.get("/api/leads");
        setLeads(result.data);
    };

    return (
        <div className="w-full">
            <h2 className="text-2xl font-bold mb-4">Leads</h2>
            <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Actions
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                First Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Last Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
                                Age
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Phone Number
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {leads.map((lead, idx) => (
                            <LeadRow lead={lead} key={lead.id} onUpdate={fetchLeads} index={idx} />
                        ))}
                    </tbody>
                </table>
                {leads.length === 0 && (
                    <div className="py-10 text-center text-sm text-gray-400">No leads yet</div>
                )}
            </div>
        </div>
    );
};
