'use client';

import { useInventory } from '@/lib/hooks/useInventory';
import { useAllPropertyTypes } from '@/lib/hooks/masterData/usePropertyTypes';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitOfMeasures';
import type { InventoryDetailCombined } from '@/types/property';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { User, Calendar, Banknote, Package, CheckCircle, AlertTriangle, UserCheck, Archive, Search, RefreshCw, Edit, PackageX } from 'lucide-react';
import { useAllDepartments } from '@/lib/hooks/masterData/useDepartments';
import { exportDepartmentItemsToExcel } from './DepartmentExport';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@radix-ui/react-tooltip';
import { PropertySticker } from './PropertySticker';
import { InventoryHistoryDialog } from './InventoryHistoryDialog';
import { PropertyCardDialog } from './PropertyCardDialog';
import { InventoryReceiptDialog } from './InventoryReceiptDialog';
import { EditInventoryDetailModal, toInventoryDetailEditForm, type InventoryDetailEditForm } from './EditInventoryDetailModal';
import { removeInventoryDetail } from '@/lib/api/inventory';

export function ViewInventoryPage({ baseRoute }: { baseRoute: string }) {
    const params = useParams() as { id?: string };
    const id = Number(params?.id);

    const { data, isLoading, refetch } = useInventory(id);
    const { data: propertyTypes } = useAllPropertyTypes();
    const { data: allUnitsOfMeasure } = useAllUnitsOfMeasure();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPropertyType, setSelectedPropertyType] = useState<number | null>(null);
    const [selectedRlsddpStatus, setSelectedRlsddpStatus] = useState<'Lost' | 'Stolen' | 'Damaged' | 'Destroyed' | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
    const [displayMode, setDisplayMode] = useState<'individual' | 'combined'>('individual');
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryDetailEditForm | null>(null);
    const [movingToRemoved, setMovingToRemoved] = useState<number | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

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

        // Apply RLSDDP status filter
        if (selectedRlsddpStatus) {
            filtered = filtered.filter(detail => detail.rlsddpStatus === selectedRlsddpStatus);
        }

        // Apply Department filter
        if (selectedDepartment) {
            filtered = filtered.filter(detail => detail.locationDepartmentId === selectedDepartment);
        }

        return filtered;
    }, [data?.details, searchTerm, selectedPropertyType, selectedRlsddpStatus, selectedDepartment]);

    const { data: allDepartments } = useAllDepartments();

    const displayedDetails = useMemo<InventoryDetailCombined[]>(() => {
        if (!preFiltered || displayMode === 'individual') {
            return ((preFiltered as InventoryDetailCombined[]) || []).map(d => ({
                ...d,
                combinedItems: [d]
            }));
        }

        const map = new Map<string, InventoryDetailCombined>();
        for (const d of preFiltered) {
            // Group key: same DR + same Article + same Brand + same Model
            const drId = d.dr_drid != null ? String(d.dr_drid) : `inv-${d.InventoryID}`;
            const article = (d.dr_article_name || d.PropertyName || '').toString().trim().toUpperCase();
            const brand = (d.Brand || '').toString().trim().toUpperCase();
            const model = (d.ModelNumber || '').toString().trim().toUpperCase();
            const key = `${drId}||${article}||${brand}||${model}`;

            const existing = map.get(key);
            const unitCost = Number(d.UnitCost || 0);
            const qty = Number(d.Quantity || 1);
            if (!existing) {
                map.set(key, { ...(d as InventoryDetailCombined), CombinedQuantity: qty, CombinedTotalCost: unitCost * qty, combinedItems: [d] });
            } else {
                existing.CombinedQuantity = (existing.CombinedQuantity || 0) + qty;
                existing.CombinedTotalCost = (existing.CombinedTotalCost || 0) + (unitCost * qty);
                if (!existing.combinedItems) existing.combinedItems = [];
                existing.combinedItems.push(d);
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
    const getRlsddpPill = (d: InventoryDetailCombined) => {
        const rs = d.rlsddpStatus;
        const rid = (d as any).rlsddpId as number | null | undefined;
        if (!rs) return null;
        const styles: Record<string, { bg: string; text: string; border: string }> = {
            Lost: { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' },
            Stolen: { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' },
            Damaged: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
            Destroyed: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
        };
        const s = styles[rs] ?? styles.Lost;
        const pill = (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}>
                {rs}
            </span>
        );
        return (
            <div className="mt-1">
                {rid ? <Link href={`${baseRoute}/rlsddp/${rid}`}>{pill}</Link> : pill}
            </div>
        );
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

    const handleMoveToRemoved = async (d: InventoryDetailCombined) => {
        const name = getItemName(d);
        setMovingToRemoved(d.InventoryDetailID);
        setConfirmRemove(null);
        try {
            await removeInventoryDetail(d.InventoryDetailID);
            toast.success(`${name} moved to Removed Items.`);
            refetch();
        } catch {
            toast.error('Failed to move item to Removed Items.');
        } finally {
            setMovingToRemoved(null);
        }
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

                                {/* Filters */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <input
                                            type="text"
                                            placeholder="Search by name, description, brand, model, or serial..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <select
                                            value={selectedPropertyType || ''}
                                            onChange={(e) => setSelectedPropertyType(e.target.value ? Number(e.target.value) : null)}
                                            className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                                        >
                                            <option value="">All Property Types</option>
                                            {propertyTypes?.map(type => (
                                                <option key={type.id} value={type.id}>{type.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={selectedRlsddpStatus || ''}
                                            onChange={(e) => setSelectedRlsddpStatus(e.target.value ? (e.target.value as 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed') : null)}
                                            className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                                        >
                                            <option value="">All RLSDDP Status</option>
                                            <option value="Lost">Lost</option>
                                            <option value="Stolen">Stolen</option>
                                            <option value="Damaged">Damaged</option>
                                            <option value="Destroyed">Destroyed</option>
                                        </select>
                                        {selectedDepartment && (
                                            <button
                                                onClick={async () => {
                                                    const dept = allDepartments?.find(d => d.id === selectedDepartment);
                                                    if (!dept) return;
                                                    try {
                                                        await exportDepartmentItemsToExcel(displayedDetails as any, dept.name);
                                                    } catch (err) {
                                                        toast.error('Failed to export department items');
                                                    }
                                                }}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium whitespace-nowrap"
                                            >
                                                Export Dept Items
                                            </button>
                                        )}
                                        <select
                                            value={selectedDepartment || ''}
                                            onChange={(e) => setSelectedDepartment(e.target.value ? Number(e.target.value) : null)}
                                            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent text-sm w-full sm:w-48"
                                        >
                                            <option value="">All Departments</option>
                                            {allDepartments?.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={displayMode}
                                            onChange={(e) => setDisplayMode(e.target.value as 'individual' | 'combined')}
                                            className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                                        >
                                            <option value="individual">Individual View</option>
                                            <option value="combined">Combined View</option>
                                        </select>
                                        {(searchTerm || selectedPropertyType || selectedRlsddpStatus) && (
                                            <button
                                                onClick={() => { setSearchTerm(''); setSelectedPropertyType(null); setSelectedRlsddpStatus(null); }}
                                                className="px-3 py-2 text-sm text-slate-500 hover:text-red-600 border border-slate-300 rounded-lg bg-white hover:border-red-300 transition-colors"
                                            >
                                                Clear filters
                                            </button>
                                        )}
                                    </div>
                                    {(searchTerm || selectedPropertyType || selectedRlsddpStatus) && (
                                        <div className="text-xs text-slate-500">
                                            Showing {displayedDetails.length} filtered result{displayedDetails.length !== 1 ? 's' : ''}
                                        </div>
                                    )}
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
                                                displayedDetails.map((d: InventoryDetailCombined) => {
                                                    const stickerItems = (d.combinedItems || [d])
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
                                                                parIcsNumber: (ci as any).par_ics_number || '',
                                                                custodianName: ci.custodianName || '',
                                                                itemName: getItemName(ci),
                                                                brand: ci.Brand || '',
                                                                category: ci.PropertyName || ci.ClassificationName || '-',
                                                                date: data?.DateAcquired ? format(new Date(data.DateAcquired), 'MM/dd/yyyy') : '-',
                                                                unitCost: ci.UnitCost,
                                                                url,
                                                                serialNumber: ci.SerialNumber || '',
                                                                modelNumber: ci.ModelNumber || '',
                                                                endUserName: ci.endUserName || '',
                                                                currentDepartmentHead: ci.currentDepartmentHead || '',
                                                                documentType: (ci as any).par_ics_type || ci.DocumentType || '',
                                                            };
                                                        });

                                                    return (
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
                                                                {d.rlsddpStatus === 'Lost' || d.rlsddpStatus === 'Stolen' ? (
                                                                    <div
                                                                        className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold"
                                                                        style={{
                                                                            backgroundColor: '#f1f5f9',
                                                                            color: '#475569',
                                                                            border: '1px solid #cbd5e1',
                                                                        }}
                                                                    >
                                                                        <span className="uppercase tracking-wider">{d.rlsddpStatus}</span>
                                                                    </div>
                                                                ) : d.rlsddpStatus === 'Destroyed' ? (
                                                                    <div
                                                                        className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold"
                                                                        style={{
                                                                            backgroundColor: '#fef2f2',
                                                                            color: '#b91c1c',
                                                                            border: '1px solid #fecaca',
                                                                        }}
                                                                    >
                                                                        <span className="uppercase tracking-wider">Unserviceable</span>
                                                                    </div>
                                                                ) : d.ConditionName ? (
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
                                                                {getRlsddpPill(d)}
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
                                                                    {stickerItems.length > 0 && (
                                                                        <PropertySticker
                                                                            items={stickerItems}
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
                                                                            custodianName={d.custodianName || ''}
                                                                            date={data?.DateAcquired ? format(new Date(data.DateAcquired), 'MM/dd/yyyy') : '-'}
                                                                            unitCost={d.UnitCost}
                                                                            brand={d.Brand || ''}
                                                                            serialNumber={d.SerialNumber || ''}
                                                                            modelNumber={d.ModelNumber || ''}
                                                                            endUserName={d.endUserName || ''}
                                                                            currentDepartmentHead={d.currentDepartmentHead || ''}
                                                                            parIcsNumber={(d as any).par_ics_number || ''}
                                                                            documentType={(d as any).par_ics_type || d.DocumentType || ''}
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
                                                                    {d.ConditionName?.toLowerCase().includes('unserviceable') && (
                                                                        confirmRemove === d.InventoryDetailID ? (
                                                                            <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                                                                                <span className="text-xs text-rose-700 font-medium whitespace-nowrap">Move to Removed?</span>
                                                                                <button
                                                                                    onClick={() => handleMoveToRemoved(d)}
                                                                                    disabled={movingToRemoved === d.InventoryDetailID}
                                                                                    className="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded px-1.5 py-0.5 transition-colors disabled:opacity-50"
                                                                                >
                                                                                    {movingToRemoved === d.InventoryDetailID
                                                                                        ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                                                                        : 'Yes'}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setConfirmRemove(null)}
                                                                                    className="text-xs font-medium text-slate-500 hover:text-slate-700 px-1"
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => setConfirmRemove(d.InventoryDetailID)}
                                                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                                title="Move to Removed Items"
                                                                            >
                                                                                <PackageX className="w-4 h-4" />
                                                                            </button>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
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