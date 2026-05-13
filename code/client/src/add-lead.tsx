import { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios";
import { CustomField } from "./types";

interface ApiErrorBody {
    error: string;
}

export const AddLead: React.FC<{ triggerRefresh?: number; onAdd?: () => void }> = ({ triggerRefresh = 0, onAdd }) => {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [age, setAge] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchCustomFields = useCallback(async () => {
        const result = await axios.get<CustomField[]>("/api/custom-fields");
        // B1 fix: only show lead-scoped custom fields in the Add Lead form
        setCustomFields(result.data.filter(f => f.entity === "lead"));
    }, []);

    useEffect(() => {
        fetchCustomFields();
    }, [triggerRefresh, fetchCustomFields]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await axios.post("/api/leads", {
                firstName,
                lastName,
                age,
                phoneNumber,
                customFields: customFieldValues,
            });
            setSuccess(true);
            setFirstName("");
            setLastName("");
            setAge("");
            setPhoneNumber("");
            setCustomFieldValues({});
            setTimeout(() => setSuccess(false), 3000);
            onAdd?.();
        } catch (err) {
            const axiosErr = err as AxiosError<ApiErrorBody>;
            setError(axiosErr.response?.data?.error ?? "Failed to add lead");
        }
        setLoading(false);
    };

    const handleClear = () => {
        setFirstName("");
        setLastName("");
        setAge("");
        setPhoneNumber("");
        setCustomFieldValues({});
        setError("");
        setSuccess(false);
    };

    return (
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold mb-3">Add Lead</h2>
            <form onSubmit={handleSubmit}>
                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                {success && <p className="text-green-600 text-sm mb-3">Lead added successfully</p>}
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
                    {customFields.map(field => (
                        <div key={field.id}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                            <input
                                type="text"
                                value={customFieldValues[field.name] ?? ""}
                                onChange={e =>
                                    setCustomFieldValues({
                                        ...customFieldValues,
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
                        disabled={loading}
                        className="flex-1 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium transition-colors"
                    >
                        Add Lead
                    </button>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="flex-1 p-2 bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 text-sm transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </form>
        </div>
    );
};
