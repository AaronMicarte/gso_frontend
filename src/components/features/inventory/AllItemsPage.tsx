'use client';

import { useAllInventoryItems } from '@/lib/hooks/useInventory';
import { useAllPropertyTypes } from '@/lib/hooks/masterData/usePropertyTypes';
import { Package, User, AlertTriangle, CheckCircle, RefreshCw, Edit, Search, Building2 } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import type { InventoryItem } from '@/lib/api/inventory';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';

import { PropertySticker } from './PropertySticker';
import { InventoryHistoryDialog } from './InventoryHistoryDialog';
import { PropertyCardDialog } from './PropertyCardDialog';
import { InventoryReceiptDialog } from './InventoryReceiptDialog';
import { EditInventoryDetailModal, toInventoryDetailEditForm, type InventoryDetailEditForm } from './EditInventoryDetailModal';

type StickerItem = {
    propertyNumber: string;
    custodianName: string;
    itemName: string;
    category: string;
    date: string;
    unitCost?: number;
    url: string;
};

type CombinedInventoryItem = InventoryItem & {
    CombinedQuantity?: number;
    CombinedTotalCost?: number;
    combinedItems?: InventoryItem[];
    stickerItems?: StickerItem[];
    endUserName?: string | null;
    endUserPosition?: string | null;
};

export function AllItemsPage() {
    const searchParams = useSearchParams();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
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
    const [selectedDocumentType, setSelectedDocumentType] = useState<'PAR' | 'ICS' | null>(null);
    const [displayMode, setDisplayMode] = useState<'individual' | 'combined'>('individual');
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryDetailEditForm | null>(null);
    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [search]);

    const { data, isLoading, isFetching, refetch } = useAllInventoryItems({ page, per_page: 10, search: debouncedSearch || undefined, property_status_id: selectedStatus || undefined, property_type_id: selectedPropertyType || undefined, document_type: selectedDocumentType || undefined, display_mode: displayMode });
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

    const getItemName = (item: InventoryItem) => {
        return item.dr_article_name || item.PropertyName || 'Unknown Item';
    };

    const getCustodianDisplayName = (custodianName?: string) => {
        return custodianName || 'Requester not set';
    };

    const getQrCodeData = (item: InventoryItem): string | null => {
        return item.qrCodeData ?? null;
    };

    // The server now returns items ordered by creation timestamp (newest first).
    const preFiltered = (data?.data ? [...data.data] : []).filter(item => {
        if (selectedDocumentType) return item.DocumentType === selectedDocumentType;
        return true;
    });

    // Sticker items are derived once per data change here, instead of being
    // recomputed inline during every render of every row (which was the case
    // before - a filter()+map()+regex per row, on every render, including
    // unrelated state changes like toggling a description).
    const displayedItems = useMemo<CombinedInventoryItem[]>(() => {
        return (preFiltered as CombinedInventoryItem[]).map(item => {
            const combinedItems = item.combinedItems || [item];
            const stickerItems: StickerItem[] = combinedItems
                .filter(ci => !!ci.PropertyNumber)
                .map(ci => {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const qrCodeData = getQrCodeData(ci);
                    const match = qrCodeData?.match(/\/qr\/scan\/(\d+)/);
                    const url = match?.[1]
                        ? `${origin}/qr/scan/${match[1]}`
                        : `${origin}/admin/inventory/${ci.InventoryID}?detail=${ci.InventoryDetailID}`;
                    return {
                        propertyNumber: ci.PropertyNumber || '',
                        custodianName: getCustodianDisplayName(ci.custodianName),
                        itemName: getItemName(ci),
                        category: ci.PropertyName || ci.ClassificationName || '-',
                        date: ci.CreatedDate ? format(new Date(ci.CreatedDate), 'MM/dd/yyyy') : '-',
                        unitCost: ci.UnitCost,
                        url,
                    };
                });
            return { ...item, combinedItems, stickerItems };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preFiltered]);

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

    const getCombinedDescription = (item: InventoryItem) => {
        const parts = [];
        if (item.Description) parts.push(item.Description);
        return parts.length > 0 ? parts.join('\n') : 'No additional details';
    };

    const openEditModal = (item: InventoryItem) => {
        setEditingItem(toInventoryDetailEditForm(item));
        setEditModalOpen(true);
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

    const getBorrowedLabel = (borrowerName?: string | null, departmentName?: string | null) => {
        if (!borrowerName) return null;
        return departmentName
            ? `Currently borrowed by ${borrowerName} - ${departmentName}`
            : `Currently borrowed by ${borrowerName}`;
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
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
                            disabled={isFetching}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <select
                            value={selectedStatus || ''}
                            onChange={(e) => {
                                setSelectedStatus(e.target.value ? Number(e.target.value) : null);
                                setPage(1);
                            }}
                            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        >
                            <option value="">All Statuses</option>
                            {propertyStatuses.map(status => (
                                <option key={status.id} value={status.id}>{status.name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedPropertyType || ''}
                            onChange={(e) => {
                                setSelectedPropertyType(e.target.value ? Number(e.target.value) : null);
                                setPage(1);
                            }}
                            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        >
                            <option value="">All Property Types</option>
                            {propertyTypes?.map(type => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedDocumentType || ''}
                            onChange={(e) => {
                                setSelectedDocumentType(e.target.value ? (e.target.value as 'PAR' | 'ICS') : null);
                                setPage(1);
                            }}
                            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        >
                            <option value="">All Document Types</option>
                            <option value="PAR">PAR</option>
                            <option value="ICS">ICS</option>
                        </select>
                        <select
                            value={displayMode}
                            onChange={(e) => {
                                setDisplayMode(e.target.value as 'individual' | 'combined');
                                setPage(1);
                            }}
                            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        >
                            <option value="individual">Individual View</option>
                            <option value="combined">Combined View</option>
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
                            <div className="text-2xl font-bold text-slate-900">{data?.stats?.total ?? data.total}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <div className="text-sm font-medium text-slate-700">Available</div>
                            </div>
                            <div className="text-2xl font-bold text-green-600">
                                {data?.stats?.available ?? 0}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <User className="w-5 h-5 text-amber-600" />
                                <div className="text-sm font-medium text-slate-700">Issued</div>
                            </div>
                            <div className="text-2xl font-bold text-amber-600">
                                {data?.stats?.issued ?? 0}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <div className="text-sm font-medium text-slate-700">Other Status</div>
                            </div>
                            <div className="text-2xl font-bold text-red-600">
                                {data?.stats?.other ?? 0}
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
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
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
                                    <th className="px-6 py-4">Status / Condition</th>
                                    <th className="px-6 py-4">Custodian</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {isLoading ? (
                                    <TableSkeletonRows columns={7} rows={10} />
                                ) : displayedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            {debouncedSearch || selectedStatus || selectedPropertyType ? 'No items found for the current search/filter' : 'No items found'}
                                        </td>
                                    </tr>
                                ) : (
                                    displayedItems.map((item) => {
                                        const borrowedLabel = getBorrowedLabel(item.currentBorrowerName, item.currentBorrowerDepartment);
                                        const stickerItems = item.stickerItems || [];

                                        return (
                                            <tr key={item.InventoryDetailID} className="hover:bg-slate-50">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="font-medium text-slate-900">
                                                            {getItemName(item)}
                                                        </div>
                                                        {item.CombinedQuantity && item.CombinedQuantity > 1 && (
                                                            <div className="mt-1 text-xs text-slate-600">{item.CombinedQuantity} items combined</div>
                                                        )}
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
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                            {item.PropertyName || 'Unknown'}
                                                        </span>
                                                        {item.DocumentType && (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${item.DocumentType === 'PAR' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                                                                {item.DocumentType}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    <div className="font-medium">{item.InventoryNumber || 'N/A'}</div>
                                                </td>

                                                <td className="px-6 py-4 space-y-1">
                                                    <div>{getStatusBadge(item.PropertyStatusID, item.StatusName)}</div>
                                                    {item.ConditionName ? (
                                                        <div
                                                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold"
                                                            style={{
                                                                backgroundColor: item.ConditionName.toLowerCase().includes('unserviceable') ? '#fef2f2' : item.ConditionName.toLowerCase().includes('under repair') ? '#fffbeb' : '#ecfdf5',
                                                                color: item.ConditionName.toLowerCase().includes('unserviceable') ? '#b91c1c' : item.ConditionName.toLowerCase().includes('under repair') ? '#92400e' : '#065f46',
                                                                border: '1px solid ' + (item.ConditionName.toLowerCase().includes('unserviceable') ? '#fecaca' : item.ConditionName.toLowerCase().includes('under repair') ? '#fde68a' : '#bbf7d0'),
                                                            }}
                                                        >
                                                            <span className="uppercase tracking-wider">{item.ConditionName}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-500">Unknown</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {borrowedLabel ? (
                                                        <div className="flex items-center gap-1 text-amber-700">
                                                            <User className="w-3 h-3" />
                                                            {borrowedLabel}
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
                                                        <PropertyCardDialog
                                                            inventoryDetailId={item.InventoryDetailID}
                                                            propertyNumber={item.PropertyNumber}
                                                            itemName={getItemName(item)}
                                                            description={item.Description}
                                                            category={item.PropertyName || item.ClassificationName}
                                                            custodianName={getCustodianDisplayName(item.custodianName)}
                                                        />
                                                        {stickerItems.length > 0 && (
                                                            <PropertySticker
                                                                items={stickerItems}
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
                                                        <InventoryReceiptDialog
                                                            inventoryDetailId={item.InventoryDetailID}
                                                            inventoryId={item.InventoryID}
                                                            articleName={item.dr_article_name ?? item.PropertyName}
                                                            unitOfMeasureId={item.UnitOfMeasureID}
                                                        />
                                                        <button
                                                            onClick={() => openEditModal(item)}
                                                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title="Edit item details"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
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
                                        disabled={page === 1 || isFetching}
                                        className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-slate-600">
                                        Page {data.current_page} of {data.last_page}
                                    </span>
                                    <button
                                        onClick={() => setPage(Math.min(data.last_page, page + 1))}
                                        disabled={page === data.last_page || isFetching}
                                        className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <EditInventoryDetailModal
                        open={editModalOpen}
                        onOpenChange={setEditModalOpen}
                        item={editingItem}
                    />
                </div>
            </div>
        </div>
    );
}