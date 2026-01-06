'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import assetIssuanceAPI from '@/lib/api/assetIssuance';
import { toast } from 'sonner';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitsOfMeasure';

interface RequestItem {
    id: number; // Temporary ID for UI
    ItemDescription: string;
    Unit: string;
    QuantityRequested: number;
    Purpose: string;
}

interface NewAssetRequestPageProps {
    baseRoute: string;
}

export function NewAssetRequestPage({ baseRoute }: NewAssetRequestPageProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { data: unitsData, isLoading: isLoadingUnits } = useAllUnitsOfMeasure();

    // Normalize units data
    type UnitOfMeasureResponse = { id?: number; name?: string; UnitOfMeasureID?: number; UnitName?: string };
    const units = Array.isArray(unitsData)
        ? (unitsData as UnitOfMeasureResponse[])
            .filter(u => u && (u.id ?? u.UnitOfMeasureID))
            .map(u => ({ id: u.id ?? u.UnitOfMeasureID!, name: u.name ?? u.UnitName! }))
        : [];

    const [items, setItems] = useState<RequestItem[]>([
        { id: 1, ItemDescription: '', Unit: '', QuantityRequested: 1, Purpose: '' }
    ]);

    const addItem = () => {
        setItems(prev => [
            ...prev,
            { id: Date.now(), ItemDescription: '', Unit: '', QuantityRequested: 1, Purpose: '' }
        ]);
    };

    const removeItem = (id: number) => {
        if (items.length === 1) {
            toast.error('At least one item is required');
            return;
        }
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const updateItem = (id: number, field: keyof RequestItem, value: string | number) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        for (const item of items) {
            if (!item.ItemDescription.trim()) {
                toast.error('Please provide item description for all items');
                return;
            }
            if (item.QuantityRequested <= 0) {
                toast.error('Quantity must be greater than 0');
                return;
            }
            if (!item.Purpose.trim()) {
                toast.error('Please provide purpose for all items');
                return;
            }
        }

        try {
            setLoading(true);

            // Transform to API format
            const requestData = {
                items: items.map(item => ({
                    PropertyInventoryDetailID: null, // Explicitly null for RIS
                    ItemDescription: item.ItemDescription,
                    Unit: item.Unit,
                    QuantityRequested: item.QuantityRequested,
                    Purpose: item.Purpose
                }))
            };

            await assetIssuanceAPI.requests.create(requestData);
            toast.success('Requisition and Issuance Slip (RIS) submitted successfully');
            router.push(`${baseRoute}/asset-requests`);
        } catch (error) {
            console.error('Failed to create request:', error);
            toast.error('Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 max-w-5xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        type="button"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">New Requisition (RIS)</h1>
                        <p className="text-slate-500 text-sm">Create a new Requisition and Issuance Slip for items not in inventory</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-slate-900">Requested Items</h2>
                            <button
                                type="button"
                                onClick={addItem}
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Item
                            </button>
                        </div>

                        <div className="space-y-4">
                            {items.map((item, index) => (
                                <div key={item.id} className="grid gap-4 p-4 border border-slate-200 rounded-lg relative bg-slate-50/50">
                                    <div className="absolute right-4 top-4">
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                            title="Remove item"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        <div className="md:col-span-1 flex items-center justify-center md:justify-start font-semibold text-slate-600">
                                            #{index + 1}
                                        </div>

                                        <div className="md:col-span-5 space-y-2">
                                            <label className="text-sm font-medium text-slate-700">
                                                Item Description <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={item.ItemDescription}
                                                onChange={(e) => updateItem(item.id, 'ItemDescription', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                placeholder="e.g., Laptop, Printer, Office Supplies"
                                                required
                                            />
                                        </div>

                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-sm font-medium text-slate-700">
                                                Unit
                                            </label>
                                            <select
                                                value={item.Unit}
                                                onChange={(e) => updateItem(item.id, 'Unit', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                disabled={isLoadingUnits}
                                            >
                                                <option value="">Select Unit</option>
                                                {units.map((unit) => (
                                                    <option key={unit.id} value={unit.name}>
                                                        {unit.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-sm font-medium text-slate-700">
                                                Quantity <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.QuantityRequested}
                                                onChange={(e) => updateItem(item.id, 'QuantityRequested', parseInt(e.target.value) || 0)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Purpose / Remarks <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            value={item.Purpose}
                                            onChange={(e) => updateItem(item.id, 'Purpose', e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                                            placeholder="State the purpose of this request..."
                                            required
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || isLoadingUnits}
                            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Submit Request
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}