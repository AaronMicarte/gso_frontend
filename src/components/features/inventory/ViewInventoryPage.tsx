'use client';

import { useInventory, useUpdateInventoryDetail } from '@/lib/hooks/useInventory';
import { useAllPropertyTypes } from '@/lib/hooks/masterData/usePropertyTypes';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { User, Calendar, Banknote, Package, CheckCircle, AlertTriangle, UserCheck, Archive, Search, RefreshCw, Edit, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@radix-ui/react-tooltip';
import * as Dialog from '@radix-ui/react-dialog';
import { PropertySticker } from './PropertySticker';

export function ViewInventoryPage({ baseRoute }: { baseRoute: string }) {
    const params = useParams() as { id?: string };
    const id = Number(params?.id);

    const { data, isLoading, refetch } = useInventory(id);
    const updateInventoryDetail = useUpdateInventoryDetail();
    const { data: propertyTypes } = useAllPropertyTypes();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPropertyType, setSelectedPropertyType] = useState<number | null>(null);
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: number; description: string } | null>(null);

    const handleRefresh = () => {
        refetch();
        toast.success('Property record refreshed');
    };

    const filteredDetails = useMemo(() => {
        if (!data?.details) return [];
        let filtered = data?.details || [];

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(detail =>
                detail.dr_item_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                detail.Description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                detail.PropertyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                detail.Brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                detail.ModelNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                detail.SerialNumber?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply property type filter
        if (selectedPropertyType) {
            filtered = filtered.filter(detail => detail.PropertyTypeID === selectedPropertyType);
        }

        return filtered;
    }, [data?.details, searchTerm, selectedPropertyType]);

    // Guard invalid id early — prevents runtime/TS issues when params are missing
    if (!id || Number.isNaN(id)) {
        return <div className="p-6 text-sm text-red-600">Invalid inventory id</div>;
    }

    const toggleDescriptionExpansion = (inventoryDetailId: number) => {
        setExpandedDescriptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(inventoryDetailId)) {
                newSet.delete(inventoryDetailId);
            } else {
                newSet.add(inventoryDetailId);
            }
            return newSet;
        });
    };

    const openEditModal = (inventoryDetailId: number, currentDescription: string) => {
        setEditingItem({ id: inventoryDetailId, description: currentDescription || '' });
        setEditModalOpen(true);
    };

    const handleSaveDescription = async () => {
        if (!editingItem) return;

        try {
            await updateInventoryDetail.mutateAsync({
                id: editingItem.id,
                data: { Description: editingItem.description }
            });
            toast.success('Description updated successfully');
            setEditModalOpen(false);
            setEditingItem(null);
        } catch {
            toast.error('Failed to update description');
        }
    };

    const handleCancelEdit = () => {
        setEditModalOpen(false);
        setEditingItem(null);
    };

    const getStatusBadge = (statusId?: number) => {
        switch (statusId) {
            case 1:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Available
                    </span>
                );
            case 2:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <UserCheck className="w-3 h-3" />
                        Assigned
                    </span>
                );
            case 3:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3" />
                        For Repair
                    </span>
                );
            case 4:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3" />
                        For Disposal
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        <Archive className="w-3 h-3" />
                        Unassigned
                    </span>
                );
        }
    };

    const getCustodianDisplayName = (statusId?: number, custodianName?: string) => {
        if (custodianName) return custodianName;
        if (statusId === 2) return 'Unassigned';
        return 'GSO Property Custodian';
    };

    const getQrCodeData = (detail: {
        qrCode?: { QRCodeData?: string | null } | null;
        // Laravel/Eloquent often serializes relations in snake_case by default.
        qr_code?: { QRCodeData?: string | null } | null;
        qrCodeData?: string | null;
    }): string | null => {
        return detail.qrCode?.QRCodeData ?? detail.qr_code?.QRCodeData ?? detail.qrCodeData ?? null;
    };

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Property Accountability Record</h1>
                        <p className="text-slate-500 text-sm">Official property record under GSO custody</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <Link
                            href={`${baseRoute}/inventory`}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <Archive className="w-4 h-4" />
                            Back to Ledger
                        </Link>
                    </div>
                </div>

                {/* Property Overview */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                            <span className="ml-2 text-slate-600">Loading property record...</span>
                        </div>
                    ) : (
                        <>
                            {/* Property Header */}
                            <div className="mb-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="text-sm text-slate-600 mb-1">Property Accountability Number</div>
                                        <div className="text-2xl font-bold text-slate-900">{data?.InventoryNumber}</div>
                                        {data?.Remarks && (
                                            <div className="text-sm text-slate-500 mt-1">{data.Remarks}</div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-slate-600 mb-1">Acquisition Date</div>
                                        <div className="flex items-center gap-1 text-slate-900">
                                            <Calendar className="w-4 h-4" />
                                            {format(toZonedTime(new Date(data?.DateAcquired || new Date()), 'Asia/Manila'), 'MMMM dd, yyyy')}
                                        </div>
                                    </div>
                                </div>

                                {/* Property Summary Stats */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Package className="w-5 h-5 text-blue-600" />
                                            <div className="text-sm font-medium text-slate-700">Total Items</div>
                                        </div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            {data?.details?.reduce((sum, d) => sum + (d.Quantity || 0), 0) || 0}
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Banknote className="w-5 h-5 text-green-600" />
                                            <div className="text-sm font-medium text-slate-700">Total Value</div>
                                        </div>
                                        <div className="text-2xl font-bold text-slate-900">
                                            ₱{Number(data?.details?.reduce((sum, d) => sum + Number(d.TotalCost || 0), 0) || 0).toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                            <div className="text-sm font-medium text-slate-700">Available</div>
                                        </div>
                                        <div className="text-2xl font-bold text-green-600">
                                            {data?.details?.filter(d => d.PropertyStatusID === 1).length || 0}
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <UserCheck className="w-5 h-5 text-blue-600" />
                                            <div className="text-sm font-medium text-slate-700">Assigned</div>
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600">
                                            {data?.details?.filter(d => d.PropertyStatusID === 2).length || 0}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Property Items Table */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-slate-900">Property Items Ledger</h3>
                                    <div className="text-sm text-slate-500">
                                        {filteredDetails.length} item{filteredDetails.length !== 1 ? 's' : ''} in this record
                                    </div>
                                </div>

                                {/* Search Input */}
                                <div className="mb-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <input
                                            type="text"
                                            placeholder="Search items by name, description, brand, model, or serial..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* Property Type Filter */}
                                <div className="mb-4">
                                    <select
                                        value={selectedPropertyType || ''}
                                        onChange={(e) => setSelectedPropertyType(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">All Property Types</option>
                                        {propertyTypes?.map(type => (
                                            <option key={type.id} value={type.id}>{type.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4">Item Name</th>
                                                <th className="px-6 py-4">Property Type</th>
                                                <th className="px-6 py-4">Description</th>
                                                <th className="px-6 py-4">Quantity & Unit Cost</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Custodian</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {filteredDetails.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                        {searchTerm ? 'No items match your search' : 'No property items found in this record'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredDetails.map((d: {
                                                    InventoryDetailID: number;
                                                    InventoryID: number;
                                                    Description?: string;
                                                    Brand?: string;
                                                    ModelNumber?: string;
                                                    SerialNumber?: string;
                                                    PropertyName?: string;
                                                    PropertyNumber?: string;
                                                    ClassificationName?: string;
                                                    DocumentType?: 'ICS' | 'PAR';
                                                    Quantity: number;
                                                    QuantityAvailable?: number;
                                                    UnitCost: number;
                                                    TotalCost: number;
                                                    ConditionID?: number;
                                                    PropertyStatusID?: number;
                                                    custodianName?: string;
                                                    locationDepartment?: string;
                                                    dr_item_description?: string;
                                                    qrCode?: { QRCodeData?: string | null } | null;
                                                    qrCodeData?: string | null;
                                                }) => (
                                                    <tr key={d.InventoryDetailID} className="hover:bg-slate-50">
                                                        <td className="px-6 py-4">
                                                            <div>
                                                                <div className="font-medium text-slate-900">
                                                                    {d.dr_item_description || 'Property Item'}
                                                                </div>
                                                                <div className="text-xs text-slate-500 space-y-1 mt-1">
                                                                    {d.Brand && <div>Brand: {d.Brand}</div>}
                                                                    {d.ModelNumber && <div>Model: {d.ModelNumber}</div>}
                                                                    {d.SerialNumber && <div>Serial: {d.SerialNumber}</div>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                                {d.PropertyName || 'Unknown'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        className={`max-w-xs cursor-pointer ${expandedDescriptions.has(d.InventoryDetailID) ? '' : 'truncate'}`}
                                                                        onClick={() => toggleDescriptionExpansion(d.InventoryDetailID)}
                                                                        style={expandedDescriptions.has(d.InventoryDetailID) ? { whiteSpace: 'pre-line' } : {}}
                                                                    >
                                                                        {d.Description || <span className="text-slate-400 italic">No description</span>}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent
                                                                    side="top"
                                                                    className="max-w-sm p-3 bg-slate-800 text-white text-sm rounded-lg shadow-lg z-50"
                                                                >
                                                                    <div style={{ whiteSpace: 'pre-line' }}>
                                                                        {d.Description || 'No description'}
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">
                                                            <div>
                                                                <div className="font-medium">{d.Quantity} @ ₱{Number(d.UnitCost || 0).toFixed(2)}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {getStatusBadge(d.PropertyStatusID)}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">
                                                            <div className="flex items-center gap-1">
                                                                <User className="w-3 h-3" />
                                                                {getCustodianDisplayName(d.PropertyStatusID, d.custodianName)}
                                                            </div>
                                                            {d.locationDepartment && (
                                                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3" />
                                                                    {d.locationDepartment}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {d.PropertyNumber && (d.PropertyStatusID === 2) && Boolean(getQrCodeData(d)) && (
                                                                    <PropertySticker
                                                                        propertyNumber={d.PropertyNumber}
                                                                        itemName={d.dr_item_description || 'Asset'}
                                                                        category={d.PropertyName || d.ClassificationName || '-'}
                                                                        url={(() => {
                                                                            const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                                                            const qrCodeData = getQrCodeData(d);
                                                                            const match = qrCodeData?.match(/\/qr\/scan\/(\d+)/);
                                                                            if (match?.[1]) return `${origin}/qr/scan/${match[1]}`;
                                                                            return `${origin}/admin/inventory/${d.InventoryID}?detail=${d.InventoryDetailID}`;
                                                                        })()}
                                                                        custodianName={getCustodianDisplayName(d.PropertyStatusID, d.custodianName)}
                                                                        date={data?.DateAcquired ? format(new Date(data.DateAcquired), 'MM/dd/yyyy') : '-'}
                                                                        unitCost={d.UnitCost}
                                                                    />
                                                                )}
                                                                <button
                                                                    onClick={() => openEditModal(d.InventoryDetailID, d.Description || '')}
                                                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                    title="Edit Description"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Edit Description Modal */}
                <Dialog.Root open={editModalOpen} onOpenChange={setEditModalOpen}>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
                        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                            <Dialog.Title className="text-lg font-bold text-slate-900">Edit Item Description</Dialog.Title>
                            <div className="space-y-4">
                                <textarea
                                    value={editingItem?.description || ''}
                                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[100px]"
                                    placeholder="Enter item description..."
                                    rows={4}
                                    maxLength={255}
                                />
                                <div className="flex justify-end gap-2">
                                    <Dialog.Close asChild>
                                        <button
                                            onClick={handleCancelEdit}
                                            className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </Dialog.Close>
                                    <button
                                        onClick={handleSaveDescription}
                                        disabled={updateInventoryDetail.isPending}
                                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                                    >
                                        {updateInventoryDetail.isPending ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            </div>
        </div>
    );
}
