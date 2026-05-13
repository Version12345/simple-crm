import axios from "axios";
import { useEffect, useState } from "react";
import { Stage, StageStatus } from "./types";

export const ManageStages: React.FC = () => {
    const [stages, setStages] = useState<Stage[]>([]);
    const [newName, setNewName] = useState("");
    const [newStatus, setNewStatus] = useState<StageStatus>("pending");
    const [newLikelihood, setNewLikelihood] = useState("0.5");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editStatus, setEditStatus] = useState<StageStatus>("pending");
    const [editLikelihood, setEditLikelihood] = useState("0.5");

    useEffect(() => {
        fetchStages();
    }, []);

    const fetchStages = async () => {
        const result = await axios.get("/api/stages");
        setStages(result.data);
    };

    const addStage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName) return;

        try {
            await axios.post("/api/stages", {
                name: newName,
                status: newStatus,
                conversionLikelihood: parseFloat(newLikelihood),
            });
            setNewName("");
            setNewStatus("pending");
            setNewLikelihood("0.5");
            fetchStages();
        } catch {
            alert("Failed to add stage");
        }
    };

    const startEdit = (stage: Stage) => {
        setEditingId(stage.id);
        setEditName(stage.name);
        setEditStatus(stage.status);
        setEditLikelihood(stage.conversionLikelihood.toString());
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            await axios.put(`/api/stages/${editingId}`, {
                name: editName,
                status: editStatus,
                conversionLikelihood: parseFloat(editLikelihood),
            });
            setEditingId(null);
            fetchStages();
        } catch {
            alert("Failed to update stage");
        }
    };

    const deleteStage = async (id: number) => {
        if (confirm("Delete this stage?")) {
            await axios.delete(`/api/stages/${id}`);
            fetchStages();
        }
    };

    return (
        <div className="rounded shadow-lg p-4 mb-4 border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Manage Stages</h2>
            <div className="mb-6">
                <h3 className="font-bold mb-2">Existing Stages</h3>
                {stages.length === 0 ? (
                    <p className="text-gray-500">No stages</p>
                ) : (
                    <ul className="space-y-2">
                        {stages.map(stage => (
                            <li key={stage.id} className="p-3 bg-gray-100 rounded">
                                {editingId === stage.id ? (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="block w-full p-2 border rounded"
                                        />
                                        <select value={editStatus} onChange={e => setEditStatus(e.target.value as StageStatus)} className="block w-full p-2 border rounded">
                                            <option>pending</option>
                                            <option>won</option>
                                            <option>lost</option>
                                        </select>
                                        <input
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={editLikelihood}
                                            onChange={e => setEditLikelihood(e.target.value)}
                                            className="block w-full p-2 border rounded"
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={saveEdit} className="bg-green-500 text-white px-3 py-1 rounded">
                                                Save
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="bg-gray-500 text-white px-3 py-1 rounded">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="font-medium">{stage.name}</span>
                                            <span className="text-xs text-gray-600 ml-2">({stage.status})</span>
                                            <span className="text-xs text-gray-600 ml-2">{(stage.conversionLikelihood * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => startEdit(stage)} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">
                                                Edit
                                            </button>
                                            <button onClick={() => deleteStage(stage.id)} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm">
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <form onSubmit={addStage} className="space-y-3">
                <h3 className="font-bold">Add New Stage</h3>
                <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Stage name"
                    className="block w-full p-2 border rounded"
                />
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as StageStatus)} className="block w-full p-2 border rounded">
                    <option value="pending">Pending</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                </select>
                <div>
                    <label className="text-sm block mb-1">Conversion Likelihood: {(parseFloat(newLikelihood) * 100).toFixed(0)}%</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={newLikelihood}
                        onChange={e => setNewLikelihood(e.target.value)}
                        className="w-full"
                    />
                </div>
                <button type="submit" className="block w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Add Stage
                </button>
            </form>
        </div>
    );
};
