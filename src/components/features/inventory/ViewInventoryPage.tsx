'use client';

import { useInventory } from '@/lib/hooks/useInventory';
import { useAllPropertyTypes } from '@/lib/hooks/masterData/usePropertyTypes';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitOfMeasures';
import type { InventoryDetailCombined } from '@/types/property';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { User, Calendar, Banknote, Package, CheckCircle, AlertTriangle, UserCheck, Archive, Search, RefreshCw, Edit } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@radix-ui/react-tooltip';
import { PropertySticker } from './PropertySticker';
import { InventoryHistoryDialog } from './InventoryHistoryDialog';
import { PropertyCardDialog } from './PropertyCardDialog';
import { InventoryReceiptDialog } from './InventoryReceiptDialog';
import { EditInventoryDetailModal, toInventoryDetailEditForm, type InventoryDetailEditForm } from './EditInventoryDetailModal';

export function ViewInventoryPage({ baseRoute }: { baseRoute: string }) {
    const params = useParams() as { id?: string };
    const id = Number(params?.id);

    const { data, isLoading, refetch } = useInventory(id);
    const { data: propertyTypes } = useAllPropertyTypes();
    const { data: allUnitsOfMeasure } = useAllUnitsOfMeasure();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPropertyType, setSelectedPropertyType] = useState<number | null>(null);
    const [displayMode, setDisplayMode] = useState<'individual' | 'combined'>('individual');
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryDetailEditForm | null>(null);

    const handleRefresh = () => {
        refetch();
        toast.success('Property record refreshed');
    };

    const preFiltered = useMemo(() => {
        if (!data?.details) return [];
        let filtered = data?.details || [];

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(detail =>
                detail.dr_article_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

    const displayedDetails = useMemo<InventoryDetailCombined[]>(() => {
        if (!preFiltered || displayMode === 'individual') return (preFiltered as InventoryDetailCombined[]) || [];

        const map = new Map<string, InventoryDetailCombined>();
        for (const d of preFiltered) {
            const key = (d.dr_article_name || d.PropertyName || d.ModelNumber || d.PropertyNumber || d.SerialNumber || 'UNKNOWN').toString().trim();
            const existing = map.get(key);
            const unitCost = Number(d.UnitCost || 0);
            const qty = Number(d.Quantity || 1);
            if (!existing) {
                map.set(key, { ...(d as InventoryDetailCombined), CombinedQuantity: qty, CombinedTotalCost: unitCost * qty });
            } else {
                existing.CombinedQuantity = (existing.CombinedQuantity || 0) + qty;
                existing.CombinedTotalCost = (existing.CombinedTotalCost || 0) + (unitCost * qty);
            }
        }

        return Array.from(map.values());
    }, [preFiltered, displayMode]);



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

    const openEditModal = (detail: {
        InventoryDetailID: number;
        InventoryID?: number;
        Description?: string | null;
        Brand?: string | null;
        ModelNumber?: string | null;
        SerialNumber?: string | null;
        dr_article_name?: string | null;
        PropertyName?: string | null;
    }) => {
        setEditingItem(toInventoryDetailEditForm(detail));
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
                    <UserCheck className="w-3 h-3" />
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
                <Archive className="w-3 h-3" />
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

    const getItemName = (detail: {
        dr_article_name?: string;
        PropertyName?: string;
        Brand?: string;
        ModelNumber?: string;
        SerialNumber?: string;
    }) => {
        return detail.dr_article_name || detail.PropertyName || 'Property Item';
    };

    const getUnitOfMeasureName = (unitOfMeasureId?: number) => {
        if (!unitOfMeasureId || !allUnitsOfMeasure) {
            return 'unit';
        }

        return allUnitsOfMeasure.find(unit => unit.id === unitOfMeasureId)?.name || 'unit';
    };

    const formatQuantityCost = (quantity: number, unitOfMeasureId?: number, unitCost?: number) => {
        const unitName = getUnitOfMeasureName(unitOfMeasureId);
        const cost = Number(unitCost || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${quantity} ${unitName} x ₱${cost}`;
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
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
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
                                            ₱{Number(data?.details?.reduce((sum, d) => sum + Number(d.TotalCost || 0), 0) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                            <div className="text-sm font-medium text-slate-700">Issued</div>
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
                                        {displayedDetails.length} item{displayedDetails.length !== 1 ? 's' : ''} in this record
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
                                    <select
                                        value={displayMode}
                                        onChange={(e) => setDisplayMode(e.target.value as 'individual' | 'combined')}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mt-2 sm:mt-0"
                                    >
                                        <option value="individual">Individual View</option>
                                        <option value="combined">Combined View</option>
                                    </select>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4">Article</th>
                                                <th className="px-6 py-4">Property Type</th>
                                                <th className="px-6 py-4">Description</th>
                                                <th className="px-6 py-4">Quantity & Unit Cost</th>
                                                <th className="px-6 py-4">Status / Condition</th>
                                                <th className="px-6 py-4">Custodian</th>
                                                <th className="px-6 py-4 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {displayedDetails.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                        {searchTerm ? 'No items match your search' : 'No property items found in this record'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                displayedDetails.map((d: InventoryDetailCombined) => (
                                                    <tr key={d.InventoryDetailID} className="hover:bg-slate-50">
                                                        <td className="px-6 py-4">
                                                            <div>
                                                                <div className="font-medium text-slate-900">
                                                                    {getItemName(d)}
                                                                </div>
                                                                <div className="text-xs text-slate-500 space-y-1 mt-1">
                                                                    {d.Brand && <div>Brand: {d.Brand}</div>}
                                                                    {d.ModelNumber && <div>Model: {d.ModelNumber}</div>}
                                                                    {d.SerialNumber && <div>Serial: {d.SerialNumber}</div>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                                    {d.PropertyName || 'Unknown'}
                                                                </span>
                                                                {d.DocumentType && (
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${d.DocumentType === 'PAR' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                                                                        {d.DocumentType}
                                                                    </span>
                                                                )}
                                                            </div>
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
                                                                <div className="font-medium">
                                                                    {formatQuantityCost(
                                                                        d.CombinedQuantity ?? d.Quantity,
                                                                        d.UnitOfMeasureID,
                                                                        (d.CombinedQuantity && (d.CombinedTotalCost ?? 0) > 0)
                                                                            ? ((d.CombinedTotalCost ?? 0) / d.CombinedQuantity)
                                                                            : d.UnitCost
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 space-y-1">
                                                            <div>{getStatusBadge(d.PropertyStatusID, d.StatusName)}</div>
                                                            {d.ConditionName ? (
                                                                <div
                                                                    className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold"
                                                                    style={{
                                                                        backgroundColor: d.ConditionName.toLowerCase().includes('unserviceable') ? '#fef2f2' : d.ConditionName.toLowerCase().includes('under repair') ? '#fffbeb' : '#ecfdf5',
                                                                        color: d.ConditionName.toLowerCase().includes('unserviceable') ? '#b91c1c' : d.ConditionName.toLowerCase().includes('under repair') ? '#92400e' : '#065f46',
                                                                        border: '1px solid ' + (d.ConditionName.toLowerCase().includes('unserviceable') ? '#fecaca' : d.ConditionName.toLowerCase().includes('under repair') ? '#fde68a' : '#bbf7d0'),
                                                                    }}
                                                                >
                                                                    <span className="uppercase tracking-wider">{d.ConditionName}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-slate-500">Unknown</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">
                                                            {getBorrowedLabel(d.currentBorrowerName) ? (
                                                                <div className="flex items-center gap-1 text-amber-700">
                                                                    <User className="w-3 h-3" />
                                                                    {getBorrowedLabel(d.currentBorrowerName)}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    <User className="w-3 h-3" />
                                                                    {d.locationDepartment
                                                                        ? `${d.accountabilityLabel || getCustodianDisplayName(d.custodianName)} - ${d.locationDepartment}`
                                                                        : (d.accountabilityLabel || getCustodianDisplayName(d.custodianName))}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <PropertyCardDialog
                                                                    inventoryDetailId={d.InventoryDetailID}
                                                                    propertyNumber={d.PropertyNumber}
                                                                    itemName={getItemName(d)}
                                                                    description={d.Description}
                                                                    category={d.PropertyName || d.ClassificationName}
                                                                    custodianName={d.accountabilityLabel || getCustodianDisplayName(d.custodianName)}
                                                                />
                                                                {d.PropertyNumber && (
                                                                    <PropertySticker
                                                                        propertyNumber={d.PropertyNumber}
                                                                        itemName={getItemName(d)}
                                                                        category={d.PropertyName || d.ClassificationName || '-'}
                                                                        url={(() => {
                                                                            const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                                                            const qrCodeData = getQrCodeData(d);
                                                                            const match = qrCodeData?.match(/\/qr\/scan\/(\d+)/);
                                                                            if (match?.[1]) return `${origin}/qr/scan/${match[1]}`;
                                                                            return `${origin}/admin/inventory/${d.InventoryID}?detail=${d.InventoryDetailID}`;
                                                                        })()}
                                                                        custodianName={d.accountabilityLabel || getCustodianDisplayName(d.custodianName)}
                                                                        date={data?.DateAcquired ? format(new Date(data.DateAcquired), 'MM/dd/yyyy') : '-'}
                                                                        unitCost={d.UnitCost}
                                                                    />
                                                                )}
                                                                <InventoryReceiptDialog
                                                                    inventoryDetailId={d.InventoryDetailID}
                                                                    inventoryId={d.InventoryID}
                                                                    articleName={d.dr_article_name ?? d.PropertyName}
                                                                    unitOfMeasureId={d.UnitOfMeasureID}
                                                                />
                                                                <InventoryHistoryDialog
                                                                    inventoryDetailId={d.InventoryDetailID}
                                                                    itemName={getItemName(d)}
                                                                />
                                                                <button
                                                                    onClick={() => openEditModal(d)}
                                                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                    title="Edit item details"
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

                <EditInventoryDetailModal
                    open={editModalOpen}
                    onOpenChange={setEditModalOpen}
                    item={editingItem}
                />
            </div>
        </div>
    );
}
