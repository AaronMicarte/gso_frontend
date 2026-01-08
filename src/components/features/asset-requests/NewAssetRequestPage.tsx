'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Loader2, Info, User, Building2 } from 'lucide-react';
import assetIssuanceAPI from '@/lib/api/assetIssuance';
import { toast } from 'sonner';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitsOfMeasure';
import { useAuth } from '@/lib/hooks/useAuth';
import { AssetRequestItem } from '@/types/assetIssuance';
import { SignatureModal } from '@/components/ui/SignatureModal';

interface NewAssetRequestPageProps {
    baseRoute: string;
}

export function NewAssetRequestPage({ baseRoute }: NewAssetRequestPageProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { data: unitsData, isLoading: isLoadingUnits } = useAllUnitsOfMeasure();

    // Normalize units data
    type UnitOfMeasureResponse = { id?: number; name?: string; UnitOfMeasureID?: number; UnitName?: string };
    const units = Array.isArray(unitsData)
        ? (unitsData as UnitOfMeasureResponse[])
            .filter(u => u && (u.id ?? u.UnitOfMeasureID))
            .map(u => ({ id: u.id ?? u.UnitOfMeasureID!, name: u.name ?? u.UnitName! }))
        : [];

    const [purpose, setPurpose] = useState('');
    const [intendedUserTypes, setIntendedUserTypes] = useState<{ [itemId: number]: 'person' | 'department' }>({ 1: 'person' });
    const [items, setItems] = useState<(AssetRequestItem & { id: number })[]>([
        {
            id: 1,
            ItemDescription: '',
            Unit: '',
            QuantityRequested: 1,
            Purpose: '',
            IntendedEndUser: '',
            AdditionalNotes: ''
        }
    ]);

    // Signature states
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [requesterSignature, setRequesterSignature] = useState<string | null>(null);
    const [requesterSignatureSource, setRequesterSignatureSource] = useState<'canvas' | 'upload' | null>(null);

    const addItem = () => {
        const newId = Date.now();
        setItems(prev => [
            ...prev,
            {
                id: newId,
                ItemDescription: '',
                Unit: '',
                QuantityRequested: 1,
                Purpose: '',
                IntendedEndUser: '',
                AdditionalNotes: ''
            }
        ]);
        // Initialize as 'person' type by default
        setIntendedUserTypes(prev => ({ ...prev, [newId]: 'person' }));
    };

    const removeItem = (id: number) => {
        if (items.length === 1) {
            toast.error('At least one item is required');
            return;
        }
        setItems(prev => prev.filter(item => item.id !== id));
        // Clean up intended user type
        setIntendedUserTypes(prev => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });
    };

    const updateItem = (id: number, field: keyof AssetRequestItem, value: string | number) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const updateIntendedUserType = (itemId: number, type: 'person' | 'department') => {
        setIntendedUserTypes(prev => ({ ...prev, [itemId]: type }));

        // Auto-fill department name if department type is selected
        if (type === 'department' && user?.Department) {
            updateItem(itemId, 'IntendedEndUser', user.Department);
        } else if (type === 'person') {
            updateItem(itemId, 'IntendedEndUser', '');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!purpose.trim()) {
            toast.error('Please provide a general purpose/justification for this request');
            return;
        }

        if (!requesterSignature || !requesterSignatureSource) {
            toast.error('Please provide your signature to submit this request');
            return;
        }

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
                toast.error('Please provide specific purpose for all items');
                return;
            }
        }

        try {
            setLoading(true);

            const requestData = {
                Purpose: purpose,
                items: items.map(({ id, ...item }) => item), // Remove temporary UI id
                requesterSignature,
                requesterSignatureSource: requesterSignatureSource as 'canvas' | 'upload',
            };

            await assetIssuanceAPI.requests.create(requestData);
            toast.success('Asset request submitted successfully');
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
                        <h1 className="text-2xl font-bold text-slate-900">New Asset Request</h1>
                        <p className="text-slate-500 text-sm">Submit a request for assets needed by your department</p>
                    </div>
                </div>

                {/* User Guidance Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-medium text-blue-900 mb-1">Important Information</p>
                            <p className="text-blue-800">
                                GSO will determine if each item is for individual (PAR) or department (ICS) accountability.
                                Please specify the intended end user if known. This helps ensure correct assignment and audit compliance.
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Request Header */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Request Information</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    General Purpose/Justification <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                                    placeholder="Explain why these items are needed for your department..."
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items Section */}
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

                        <div className="space-y-6">
                            {items.map((item, index) => (
                                <div key={item.id} className="border border-slate-200 rounded-lg p-6 relative bg-slate-50/50">
                                    <div className="absolute right-6 top-6">
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                            title="Remove item"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="font-semibold text-slate-600 bg-slate-200 px-2 py-1 rounded text-sm">
                                                Item #{index + 1}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2 space-y-2">
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

                                            <div className="space-y-2">
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

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
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

                                            <div className="space-y-3">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Intended End User
                                                    <span className="text-slate-400 text-xs ml-1">(optional but recommended)</span>
                                                </label>

                                                {/* Person vs Department Choice */}
                                                <div className="flex gap-4 mb-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateIntendedUserType(item.id, 'person')}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${(intendedUserTypes[item.id] || 'person') === 'person'
                                                            ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        <User className="h-4 w-4" />
                                                        <span className="text-sm font-medium">Person</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateIntendedUserType(item.id, 'department')}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${intendedUserTypes[item.id] === 'department'
                                                            ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        <Building2 className="h-4 w-4" />
                                                        <span className="text-sm font-medium">Department</span>
                                                    </button>
                                                </div>

                                                {/* Input Field */}
                                                {(intendedUserTypes[item.id] || 'person') === 'person' ? (
                                                    <input
                                                        type="text"
                                                        value={item.IntendedEndUser || ''}
                                                        onChange={(e) => updateItem(item.id, 'IntendedEndUser', e.target.value)}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                        placeholder="Enter person's full name..."
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={item.IntendedEndUser || user?.Department || ''}
                                                        onChange={(e) => updateItem(item.id, 'IntendedEndUser', e.target.value)}
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 bg-slate-50"
                                                        placeholder="Department name..."
                                                        readOnly
                                                    />
                                                )}

                                                <p className="text-xs text-slate-500">
                                                    {(intendedUserTypes[item.id] || 'person') === 'person'
                                                        ? 'Enter the full name of the person who will use this item'
                                                        : 'This item will be assigned to your department'
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">
                                                Specific Purpose <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                value={item.Purpose}
                                                onChange={(e) => updateItem(item.id, 'Purpose', e.target.value)}
                                                rows={2}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                                                placeholder="Specific use case for this item..."
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">
                                                Additional Notes
                                                <span className="text-slate-400 text-xs ml-1">(optional)</span>
                                            </label>
                                            <textarea
                                                value={item.AdditionalNotes || ''}
                                                onChange={(e) => updateItem(item.id, 'AdditionalNotes', e.target.value)}
                                                rows={2}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                                                placeholder="Any additional information or specifications..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Signature Section */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Requester Signature</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Your Signature <span className="text-red-500">*</span>
                                </label>
                                {requesterSignature ? (
                                    <div className="space-y-2">
                                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                            <img
                                                src={requesterSignature}
                                                alt="Your signature"
                                                className="max-h-20 max-w-full object-contain"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowSignatureModal(true)}
                                                className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded"
                                            >
                                                Change Signature
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRequesterSignature(null);
                                                    setRequesterSignatureSource(null);
                                                }}
                                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setShowSignatureModal(true)}
                                        className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-400 transition-colors flex items-center justify-center text-slate-500"
                                    >
                                        Click to add your signature
                                    </button>
                                )}
                                <p className="text-xs text-slate-500 mt-1">
                                    Your signature is required to submit this asset request for approval.
                                </p>
                            </div>
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

                {/* Signature Modal */}
                <SignatureModal
                    open={showSignatureModal}
                    onOpenChange={setShowSignatureModal}
                    onSave={(dataUrl, source) => {
                        setRequesterSignature(dataUrl);
                        setRequesterSignatureSource(source);
                    }}
                    loading={loading}
                />
            </div>
        </div>
    );
}