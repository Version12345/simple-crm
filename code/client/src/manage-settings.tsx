import axios from "axios";
import { useEffect, useState } from "react";
import { AppSetting } from "./types";

export const ManageSettings: React.FC = () => {
    const [settings, setSettings] = useState<AppSetting[]>([]);
    const [edits, setEdits] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        const result = await axios.get("/api/settings");
        setSettings(result.data);
    };

    const saveSetting = async (key: string) => {
        const value = edits[key];
        if (value === undefined) return;
        await axios.put(`/api/settings/${key}`, { value });
        setEdits(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        fetchSettings();
    };

    return (
        <div className="rounded shadow-lg p-4 mb-4 border border-gray-200">
            <h2 className="text-xl font-bold mb-4">App Settings</h2>
            {settings.length === 0 ? (
                <p className="text-gray-500">No settings</p>
            ) : (
                <ul className="space-y-2">
                    {settings.map(s => {
                        const draft = edits[s.key] ?? s.value;
                        const dirty = edits[s.key] !== undefined && edits[s.key] !== s.value;
                        return (
                            <li key={s.key} className="flex justify-between items-center p-2 bg-gray-100 rounded">
                                <div className="font-mono text-sm">{s.key}</div>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={draft}
                                        onChange={e => setEdits(prev => ({ ...prev, [s.key]: e.target.value }))}
                                        className="border rounded px-2 py-1 font-mono text-sm w-32"
                                    />
                                    <button
                                        onClick={() => saveSetting(s.key)}
                                        disabled={!dirty}
                                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:bg-gray-300 text-sm"
                                    >
                                        Save
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};
