'use client';

import { useAllInventoryItems, useUpdateInventoryDetail } from '@/lib/hooks/useInventory';
import { useAllPropertyTypes } from '@/lib/hooks/masterData/usePropertyTypes';
import { Package, User, AlertTriangle, CheckCircle, RefreshCw, Edit, Search, Building2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import type { InventoryItem } from '@/lib/api/inventory';

import { PropertySticker } from './PropertySticker';
import { InventoryHistoryDialog } from './InventoryHistoryDialog';

export function AllItemsPage() {
    const searchParams = useSearchParams();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<number | null>(() => {
        const statusParam = searchParams.get('status');
        if (statusParam) {
            const statusMap: { [key: string]: number | null } = {
                'for-issuance': 1,
                'for issuance': 1,
                'to-be-issued': 1,
                'available': 1,
                'assigned': 2,
                'issued': 2,
                'repair': 3,
                'disposal': 4,
                'disposed': 5,
                'all': null
            };
            const statusId = statusMap[statusParam.toLowerCase()];
            return statusId !== undefined ? statusId : null;
        }
        return null;
    });
    const [selectedPropertyType, setSelectedPropertyType] = useState<number | null>(null);
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: number; description: string } | null>(null);



    const { data, isLoading, refetch } = useAllInventoryItems({ page, per_page: 10, search, property_status_id: selectedStatus || undefined, property_type_id: selectedPropertyType || undefined });
    const updateInventoryDetail = useUpdateInventoryDetail();
    const { data: propertyTypes } = useAllPropertyTypes();

    const propertyStatuses = [
        { id: 1, name: 'Available' },
        { id: 2, name: 'Issued' },
        { id: 3, name: 'For Repair' },
        { id: 4, name: 'For Disposal' },
        { id: 5, name: 'Disposed' },
    ];

    const handleRefresh = () => {
        refetch();
        toast.success('Items refreshed');
    };

    const filteredDetails = useMemo(() => {
        if (!data?.data) return [];
        if (!search) return data?.data || [];
        return (data?.data || []).filter(item =>
            item.dr_article_name?.toLowerCase().includes(search.toLowerCase()) ||
            item.Description?.toLowerCase().includes(search.toLowerCase()) ||
            item.PropertyName?.toLowerCase().includes(search.toLowerCase()) ||
            item.Brand?.toLowerCase().includes(search.toLowerCase()) ||
            item.ModelNumber?.toLowerCase().includes(search.toLowerCase()) ||
            item.SerialNumber?.toLowerCase().includes(search.toLowerCase()) ||
            item.InventoryNumber?.toLowerCase().includes(search.toLowerCase())
        );
    }, [data?.data, search]);

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

    const getItemName = (item: InventoryItem) => {
        return item.dr_article_name || item.PropertyName || 'Unknown Item';
    };

    const getCombinedDescription = (item: InventoryItem) => {
        const parts = [];
        if (item.Description) parts.push(item.Description);
        return parts.length > 0 ? parts.join('\n') : 'No additional details';
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

    const getStatusBadge = (statusId?: number, statusName?: string) => {
        const label = statusName?.trim() || (statusId === 2 ? 'Issued' : statusId === 3 ? 'For Repair' : statusId === 4 ? 'For Disposal' : 'Available');
        const normalized = label.toLowerCase();

        if (normalized.includes('issuance') || normalized.includes('available')) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3" />
                    {label}
                </span>
            );
        }
        if (normalized.includes('issued')) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <User className="w-3 h-3" />
                    {label}
                </span>
            );
        }
        if (normalized.includes('repair')) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    <AlertTriangle className="w-3 h-3" />
                    {label}
                </span>
            );
        }
        if (normalized.includes('disposal') || normalized.includes('disposed')) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <AlertTriangle className="w-3 h-3" />
                    {label}
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                <Package className="w-3 h-3" />
                {label}
            </span>
        );
    };

    const getCustodianDisplayName = (custodianName?: string) => {
        return custodianName || 'Requester not set';
    };

    const getBorrowedLabel = (borrowerName?: string | null) => {
        return borrowerName ? `Currently borrowed by ${borrowerName}` : null;
    };

    const getQrCodeData = (item: InventoryItem): string | null => {
        return item.qrCodeData ?? null;
    };

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">All Inventory Items</h1>
                        <p className="text-slate-500 text-sm">Master ledger of all individual property items across all inventories</p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <select
                            value={selectedStatus || ''}
                            onChange={(e) => setSelectedStatus(e.target.value ? Number(e.target.value) : null)}
                            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        >
                            <option value="">All Statuses</option>
                            {propertyStatuses.map(status => (
                                <option key={status.id} value={status.id}>{status.name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedPropertyType || ''}
                            onChange={(e) => setSelectedPropertyType(e.target.value ? Number(e.target.value) : null)}
                            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        >
                            <option value="">All Property Types</option>
                            {propertyTypes?.map(type => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Summary Stats */}
                {data?.data && data.data.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <Package className="w-5 h-5 text-blue-600" />
                                <div className="text-sm font-medium text-slate-700">Total Items</div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900">{data.total}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <div className="text-sm font-medium text-slate-700">Available</div>
                            </div>
                            <div className="text-2xl font-bold text-green-600">
                                {data.data.filter(item => item.PropertyStatusID === 1).length}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <User className="w-5 h-5 text-amber-600" />
                                <div className="text-sm font-medium text-slate-700">Issued</div>
                            </div>
                            <div className="text-2xl font-bold text-amber-600">
                                {data.data.filter(item => item.PropertyStatusID === 2).length}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <div className="text-sm font-medium text-slate-700">Other Status</div>
                            </div>
                            <div className="text-2xl font-bold text-red-600">
                                {data.data.filter(item => item.PropertyStatusID > 2).length}
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by description, brand, model, serial number, or inventory number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                    </div>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Inventory Items</h3>
                                <p className="text-sm text-slate-600">All individual property items</p>
                            </div>
                            <div className="text-sm text-slate-500">
                                Total Records: {data?.total ?? 0}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Article</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4">Property Type</th>
                                    <th className="px-6 py-4">Inventory Number</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Custodian</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {data?.data?.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No items found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDetails.map((item) => (
                                        <tr key={item.InventoryDetailID} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <div className="font-medium text-slate-900">
                                                        {getItemName(item)}
                                                    </div>
                                                    <div className="text-xs text-slate-500 space-y-1 mt-1">
                                                        {item.Brand && <div>Brand: {item.Brand}</div>}
                                                        {item.ModelNumber && <div>Model: {item.ModelNumber}</div>}
                                                        {item.SerialNumber && <div>Serial: {item.SerialNumber}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <div
                                                    className={`max-w-xs cursor-pointer ${expandedDescriptions.has(item.InventoryDetailID) ? '' : 'truncate'}`}
                                                    onClick={() => toggleDescriptionExpansion(item.InventoryDetailID)}
                                                    style={expandedDescriptions.has(item.InventoryDetailID) ? { whiteSpace: 'pre-line' } : {}}
                                                >
                                                    {getCombinedDescription(item)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                    {item.PropertyName || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <div className="font-medium">{item.InventoryNumber || 'N/A'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(item.PropertyStatusID, item.StatusName)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {getBorrowedLabel(item.currentBorrowerName) ? (
                                                    <div className="flex items-center gap-1 text-amber-700">
                                                        <User className="w-3 h-3" />
                                                        {getBorrowedLabel(item.currentBorrowerName)}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {item.locationDepartment
                                                                ? `${getCustodianDisplayName(item.custodianName)}`
                                                                : getCustodianDisplayName(item.custodianName)}
                                                        </div>
                                                        {item.locationDepartment && (
                                                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                                <Building2 className="w-3 h-3" />
                                                                {item.locationDepartment}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {item.PropertyNumber && (
                                                        <PropertySticker
                                                            propertyNumber={item.PropertyNumber}
                                                            itemName={getItemName(item)}
                                                            category={item.PropertyName || item.ClassificationName || '-'}
                                                            url={(() => {
                                                                const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                                                const qrCodeData = getQrCodeData(item);
                                                                const match = qrCodeData?.match(/\/qr\/scan\/(\d+)/);
                                                                if (match?.[1]) return `${origin}/qr/scan/${match[1]}`;
                                                                return `${origin}/admin/inventory/${item.InventoryID}?detail=${item.InventoryDetailID}`;
                                                            })()}
                                                            custodianName={getCustodianDisplayName(item.custodianName)}
                                                            date={item.CreatedDate ? format(new Date(item.CreatedDate), 'MM/dd/yyyy') : '-'}
                                                            unitCost={item.UnitCost}
                                                        />
                                                    )}
                                                    <InventoryHistoryDialog
                                                        inventoryDetailId={item.InventoryDetailID}
                                                        itemName={getItemName(item)}
                                                    />
                                                    <button
                                                        onClick={() => openEditModal(item.InventoryDetailID, item.Description || '')}
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

                    {/* Pagination */}
                    {data && data.last_page > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-600">
                                    Showing {((data.current_page - 1) * data.per_page) + 1} to {Math.min(data.current_page * data.per_page, data.total)} of {data.total} entries
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(Math.max(1, page - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-slate-600">
                                        Page {data.current_page} of {data.last_page}
                                    </span>
                                    <button
                                        onClick={() => setPage(Math.min(data.last_page, page + 1))}
                                        disabled={page === data.last_page}
                                        className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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
        </div>
    );
}