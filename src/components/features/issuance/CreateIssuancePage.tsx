'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    ArrowLeft,
    Save,
    Package,
    AlertCircle,
    Loader2,
    Search,
    Plus,
    Trash2,
    User,
    FileText,
    CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import issuanceAPI from '@/lib/api/issuance';
import { AssetRequest } from '@/types/assetIssuance';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { SignatureModal } from '@/components/ui/SignatureModal';

const issuanceSchema = z.object({
    request_id: z.number().min(1, 'Request is required'),
    date_issued: z.string().min(1, 'Issue date is required'),
    remarks: z.string().optional(),
    inventory_items: z.array(z.object({
        request_detail_id: z.number(),
        inventory_detail_id: z.number(),
        quantity_issued: z.number().min(1, 'Quantity must be at least 1')
    })).min(1, 'At least one inventory item must be selected')
});

type IssuanceFormValues = z.infer<typeof issuanceSchema>;

interface InventoryItem {
    InventoryDetailID: number;
    Description: string;
    Brand?: string;
    ModelNumber?: string;
    PropertyNumber?: string;
    SerialNumber?: string;
    UnitCost: number;
    IsAvailable: boolean;
    PropertyName?: string;
    UnitName?: string;
    dr_item_description?: string;
    InventoryNumber?: string;
    DateReceived?: string;
    PropertyStatusID?: number;
    StatusName?: string;
    drDetail?: {
        ItemDescription: string;
    };
}

interface RequestDetail {
    RequestDetailID: number;
    ItemDescription: string;
    QuantityRequested: number;
    Unit: string;
    Purpose: string;
    IntendedEndUser: string;
    PropertyClassification: string;
    selectedInventory: InventoryItem[];
    totalSelected: number;
}

interface CreateIssuancePageProps {
    baseRoute: string;
}

export function CreateIssuancePage({ baseRoute }: CreateIssuancePageProps) {
    const router = useRouter();
    const [approvedRequests, setApprovedRequests] = useState<AssetRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<AssetRequest | null>(null);
    const [requestDetails, setRequestDetails] = useState<RequestDetail[]>([]);
    const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);
    const [inventorySearch, setInventorySearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [currentRequestDetailId, setCurrentRequestDetailId] = useState<number | null>(null);

    // Signature states
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [issuerSignature, setIssuerSignature] = useState<string | null>(null);
    const [issuerSignatureSource, setIssuerSignatureSource] = useState<'canvas' | 'upload' | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
        setValue
    } = useForm<IssuanceFormValues>({
        resolver: zodResolver(issuanceSchema),
        defaultValues: {
            date_issued: new Date().toISOString().split('T')[0],
        }
    });

    const watchedRequestId = watch('request_id');

    // Sync requestDetails to form value for inventory_items
    useEffect(() => {
        const inventoryItems = requestDetails.flatMap(detail =>
            detail.selectedInventory.map(inventory => ({
                request_detail_id: detail.RequestDetailID,
                inventory_detail_id: inventory.InventoryDetailID,
                quantity_issued: 1
            }))
        );
        setValue('inventory_items', inventoryItems, { shouldValidate: true });
    }, [requestDetails, setValue]);

    useEffect(() => {
        loadApprovedRequests();
        loadAvailableInventory();
    }, []);

    useEffect(() => {
        if (watchedRequestId) {
            const request = approvedRequests.find(r => r.RequestID === Number(watchedRequestId));
            if (request) {
                setSelectedRequest(request);
                initializeRequestDetails(request);
            }
        } else {
            setSelectedRequest(null);
            setRequestDetails([]);
        }
    }, [watchedRequestId, approvedRequests]);

    const loadApprovedRequests = async () => {
        try {
            setLoading(true);
            const response = await issuanceAPI.getRequestsForIssuance();
            setApprovedRequests(response.data || []);
        } catch (error) {
            console.error('Failed to load approved requests:', error);
            toast.error('Failed to load approved requests');
            setApprovedRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableInventory = async () => {
        try {
            const response = await issuanceAPI.getAvailableInventory({
                per_page: 500,
                search: inventorySearch
            });
            setAvailableInventory(response.data || []);
        } catch (error) {
            console.error('Failed to load inventory:', error);
            setAvailableInventory([]);
        }
    };

    const initializeRequestDetails = (request: AssetRequest) => {
        const details: RequestDetail[] = (request.details || []).map(detail => ({
            RequestDetailID: detail.RequestDetailID,
            ItemDescription: detail.ItemDescription || 'No description',
            QuantityRequested: detail.QuantityRequested,
            Unit: detail.Unit || 'pcs',
            Purpose: detail.Purpose,
            IntendedEndUser: detail.IntendedEndUser || 'Not specified',
            PropertyClassification: detail.PropertyClassification || 'ICS',
            selectedInventory: [],
            totalSelected: 0
        }));
        setRequestDetails(details);
    };

    const openInventoryModal = (requestDetailId: number) => {
        setCurrentRequestDetailId(requestDetailId);
        setShowInventoryModal(true);
        loadAvailableInventory();
    };

    const selectInventoryItem = (inventoryItem: InventoryItem) => {
        if (currentRequestDetailId === null) return;

        setRequestDetails(prev => prev.map(detail => {
            if (detail.RequestDetailID === currentRequestDetailId) {
                const alreadySelected = detail.selectedInventory.find(
                    item => item.InventoryDetailID === inventoryItem.InventoryDetailID
                );

                if (alreadySelected) {
                    toast.warning('This inventory item is already selected');
                    return detail;
                }

                if (detail.totalSelected >= detail.QuantityRequested) {
                    toast.warning('All requested quantity has been fulfilled');
                    return detail;
                }

                const updated = {
                    ...detail,
                    selectedInventory: [...detail.selectedInventory, inventoryItem],
                    totalSelected: detail.totalSelected + 1
                };
                return updated;
            }
            return detail;
        }));

        setShowInventoryModal(false);
        setCurrentRequestDetailId(null);
    };

    const removeInventoryItem = (requestDetailId: number, inventoryDetailId: number) => {
        setRequestDetails(prev => prev.map(detail => {
            if (detail.RequestDetailID === requestDetailId) {
                return {
                    ...detail,
                    selectedInventory: detail.selectedInventory.filter(
                        item => item.InventoryDetailID !== inventoryDetailId
                    ),
                    totalSelected: detail.totalSelected - 1
                };
            }
            return detail;
        }));
    };

    const onSubmit = async (data: IssuanceFormValues) => {
        if (!selectedRequest) {
            toast.error('Please select a request to issue');
            return;
        }

        if (!issuerSignature || !issuerSignatureSource) {
            toast.error('Please provide your signature to issue these assets');
            return;
        }

        // Validate all items have enough inventory selected
        const invalidItems = requestDetails.filter(detail => detail.totalSelected !== detail.QuantityRequested);
        if (invalidItems.length > 0) {
            toast.error('Please select exact quantity for all requested items');
            return;
        }

        // Prepare inventory items array
        const inventoryItems = requestDetails.flatMap(detail =>
            detail.selectedInventory.map(inventory => ({
                request_detail_id: detail.RequestDetailID,
                inventory_detail_id: inventory.InventoryDetailID,
                quantity_issued: 1 // Each inventory item represents 1 unit
            }))
        );

        setValue('inventory_items', inventoryItems);

        try {
            setIsSubmitting(true);

            const submitData = {
                ...data,
                request_id: Number(data.request_id),
                inventory_items: inventoryItems,
                issuerSignature,
                issuerSignatureSource
            };

            await issuanceAPI.create(submitData);
            toast.success('Assets issued successfully');
            router.push(`${baseRoute}`);
        } catch (error) {
            console.error('Failed to create issuance:', error);
            toast.error('Failed to issue assets');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignatureSave = (signature: string, source: 'canvas' | 'upload') => {
        setIssuerSignature(signature);
        setIssuerSignatureSource(source);
        setShowSignatureModal(false);
    };

    const filteredInventory = availableInventory
        .filter((item) => {
            // Defensive: only show items the backend considers available.
            // Prefer PropertyStatusID when present; otherwise fall back to StatusName.
            if (typeof item.PropertyStatusID === 'number') return item.PropertyStatusID === 1;
            return (item.StatusName || '').toLowerCase() === 'available';
        })
        .filter(item => {
            if (!inventorySearch) return true;
            const search = inventorySearch.toLowerCase();
            return (
                (item.Description?.toLowerCase() || '').includes(search) ||
                (item.Brand?.toLowerCase() || '').includes(search) ||
                (item.ModelNumber?.toLowerCase() || '').includes(search) ||
                (item.PropertyNumber?.toLowerCase() || '').includes(search) ||
                (item.SerialNumber?.toLowerCase() || '').includes(search) ||
                (item.dr_item_description?.toLowerCase() || '').includes(search)
            );
        });

    if (loading) {
        return (
            <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
                <div className="p-6">
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="flex items-center gap-3 text-slate-600">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Loading approved requests...
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link
                        href={`${baseRoute}`}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-700" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Issue Assets</h1>
                        <p className="text-slate-600 text-sm">
                            Select approved requests and assign real inventory items
                        </p>
                    </div>
                </div>

                <form 
                    onSubmit={handleSubmit(onSubmit, (errors) => {
                        console.error('Form validation errors:', errors);
                        toast.error('Please fill in all required fields');
                    })} 
                    className="space-y-6"
                >
                    {/* Request Selection */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Request</h2>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Approved Request *
                                    </label>
                                    <select
                                        {...register('request_id', { 
                                            valueAsNumber: true,
                                            required: 'Please select a request',
                                            validate: (value) => value > 0 || 'Please select a request'
                                        })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    >
                                        <option value="">Select a request...</option>
                                        {approvedRequests.map(request => (
                                            <option key={request.RequestID} value={request.RequestID}>
                                                {request.RequestNumber} - {request.requester?.FullName} ({request.department?.DepartmentName})
                                            </option>
                                        ))}
                                    </select>
                                    {errors.request_id && (
                                        <p className="mt-1 text-sm text-red-600">{errors.request_id.message}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Issue Date *
                                    </label>
                                    <input
                                        type="date"
                                        {...register('date_issued')}
                                        readOnly
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed focus:outline-none"
                                    />
                                    {errors.date_issued && (
                                        <p className="mt-1 text-sm text-red-600">{errors.date_issued.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Remarks
                                </label>
                                <textarea
                                    {...register('remarks')}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    placeholder="Optional remarks for this issuance..."
                                />
                            </div>
                        </div>

                        {/* Request Details */}
                        {selectedRequest && (
                            <div className="p-6 bg-slate-50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
                                        <FileText className="w-4 h-4 text-[var(--primary)]" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-slate-900">{selectedRequest.RequestNumber}</h3>
                                        <p className="text-sm text-slate-500">
                                            Requested by {selectedRequest.requester?.FullName} on{' '}
                                            {format(toZonedTime(new Date(selectedRequest.RequestDate), 'Asia/Manila'), 'MMM dd, yyyy')}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {requestDetails.map((detail) => (
                                        <div key={detail.RequestDetailID} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                            {/* Request Detail Header */}
                                            <div className="p-4 border-b border-slate-100">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-medium text-slate-900">{detail.ItemDescription}</h4>
                                                        <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                                            <span>Qty: {detail.QuantityRequested} {detail.Unit}</span>
                                                            <span>For: {detail.IntendedEndUser}</span>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${detail.PropertyClassification === 'PAR'
                                                                ? 'bg-purple-100 text-purple-800'
                                                                : 'bg-indigo-100 text-indigo-800'
                                                                }`}>
                                                                {detail.PropertyClassification}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-sm font-medium ${detail.totalSelected === detail.QuantityRequested
                                                            ? 'text-green-600'
                                                            : detail.totalSelected > 0
                                                                ? 'text-amber-600'
                                                                : 'text-slate-500'
                                                            }`}>
                                                            {detail.totalSelected} / {detail.QuantityRequested} selected
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => openInventoryModal(detail.RequestDetailID)}
                                                            disabled={detail.totalSelected >= detail.QuantityRequested}
                                                            className="mt-2 px-3 py-1.5 bg-[var(--primary)] text-white text-sm rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <Plus className="w-4 h-4 inline mr-1" />
                                                            Add Item
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Selected Inventory Items */}
                                            {detail.selectedInventory.length > 0 && (
                                                <div className="p-4 bg-slate-50">
                                                    <h5 className="text-sm font-medium text-slate-700 mb-2">Selected Inventory Items</h5>
                                                    <div className="space-y-2">
                                                        {detail.selectedInventory.map((item) => (
                                                            <div key={item.InventoryDetailID} className="flex items-start justify-between p-3 bg-white rounded border">
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-slate-900">
                                                                        {item.dr_item_description || item.PropertyName || 'Unknown Item'}
                                                                        {item.PropertyNumber && <span className="text-sm font-normal text-slate-600 ml-2">({item.PropertyNumber})</span>}
                                                                    </div>
                                                                    <div className="text-sm text-slate-600 mt-1">
                                                                        {item.Description && <div>{item.Description}</div>}
                                                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                                            {item.InventoryNumber && <span className="font-medium text-slate-700">{item.InventoryNumber}</span>}
                                                                            {item.Brand && <span>Brand: {item.Brand}</span>}
                                                                            {item.ModelNumber && <span>Model: {item.ModelNumber}</span>}
                                                                            {item.SerialNumber && <span>Serial: {item.SerialNumber}</span>}
                                                                        </div>
                                                                    </div>
                                                                    {item.DateReceived && (
                                                                        <div className="text-xs text-slate-00 mt-1">
                                                                            Received: {format(new Date(item.DateReceived), 'MMM dd, yyyy')}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeInventoryItem(detail.RequestDetailID, item.InventoryDetailID)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-2"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Issuer Signature */}
                    {selectedRequest && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h3 className="font-semibold text-slate-900 mb-4">Issuer Signature</h3>
                            <div className="space-y-4">
                                {!requestDetails.every(d => d.totalSelected === d.QuantityRequested) && (
                                    <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                                        <strong>Note:</strong> Please select all requested items before providing your signature.
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Your Signature <span className="text-red-500">*</span>
                                    </label>
                                    {issuerSignature ? (
                                        <div className="space-y-2">
                                            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                                <img
                                                    src={issuerSignature}
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
                                                        setIssuerSignature(null);
                                                        setIssuerSignatureSource(null);
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
                                            disabled={!requestDetails.every(d => d.totalSelected === d.QuantityRequested)}
                                            className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-400 transition-colors flex items-center justify-center text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Click to add your signature
                                        </button>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1">
                                        Your signature is required to issue these assets.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    {selectedRequest && requestDetails.every(d => d.totalSelected === d.QuantityRequested) && issuerSignature && (
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Issuing Assets...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Issue Assets
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </form>

                {/* Inventory Selection Modal */}
                {showInventoryModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                            <div className="p-6 border-b border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-900">Select Inventory Item</h3>
                                <div className="mt-4 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by description, brand, model, property number..."
                                        value={inventorySearch}
                                        onChange={(e) => setInventorySearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    />
                                </div>
                            </div>

                            <div className="p-6 max-h-[60vh] overflow-y-auto">
                                <div className="grid gap-3">
                                    {filteredInventory.map((item) => (
                                        <div
                                            key={item.InventoryDetailID}
                                            onClick={() => selectInventoryItem(item)}
                                            className="p-4 border border-slate-200 rounded-lg hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-900">
                                                        {item.dr_item_description || item.PropertyName || 'Unknown Item'}
                                                        {item.PropertyNumber && <span className="text-sm font-normal text-slate-600 ml-2">({item.PropertyNumber})</span>}
                                                    </div>
                                                    <div className="text-sm text-slate-600 mt-1">
                                                        {item.Description && <div>{item.Description}</div>}
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                            {item.InventoryNumber && <span className="font-medium text-slate-700">Inv: {item.InventoryNumber}</span>}
                                                            {item.Brand && <span>Brand: {item.Brand}</span>}
                                                            {item.ModelNumber && <span>Model: {item.ModelNumber}</span>}
                                                            {item.SerialNumber && <span>Serial: {item.SerialNumber}</span>}
                                                        </div>
                                                    </div>
                                                    {item.DateReceived && (
                                                        <div className="text-xs text-slate-400 mt-1">
                                                            Received: {format(new Date(item.DateReceived), 'MMM dd, yyyy')}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-medium text-slate-900">₱{item.UnitCost.toLocaleString()}</div>
                                                    <div className="text-xs text-green-600">
                                                        {item.StatusName || (item.PropertyStatusID === 1 ? 'Available' : 'Unavailable')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {filteredInventory.length === 0 && (
                                    <div className="text-center py-8 text-slate-500">
                                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                        No available inventory items found
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-slate-200 flex justify-end">
                                <button
                                    onClick={() => setShowInventoryModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Signature Modal */}
                <SignatureModal
                    open={showSignatureModal}
                    onOpenChange={setShowSignatureModal}
                    onSave={handleSignatureSave}
                />
            </div>
        </div>
    );
}