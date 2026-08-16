'use client';

import { useAllInventoryItems } from '@/lib/hooks/useInventory';
import { useAllPropertyTypes } from '@/lib/hooks/masterData/usePropertyTypes';
import { Package, User, AlertTriangle, CheckCircle, RefreshCw, Edit, Search, Building2, FileWarning, Download, Filter } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getAllInventoryItems, type InventoryItem } from '@/lib/api/inventory';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';
import { useAllDepartments } from '@/lib/hooks/masterData/useDepartments';
import { exportDepartmentItemsToExcel, exportAllItemsToExcel } from './DepartmentExport';

import { PropertySticker, type PropertyStickerItem } from './PropertySticker';
import { InventoryHistoryDialog } from './InventoryHistoryDialog';
import { PropertyCardDialog } from './PropertyCardDialog';
import { InventoryReceiptDialog } from './InventoryReceiptDialog';
import { EditInventoryDetailModal, toInventoryDetailEditForm, type InventoryDetailEditForm } from './EditInventoryDetailModal';

type StickerItem = PropertyStickerItem;

type CombinedInventoryItem = InventoryItem & {
    CombinedQuantity?: number;
    CombinedTotalCost?: number;
    combinedItems?: InventoryItem[];
    stickerItems?: StickerItem[];
    endUserName?: string | null;
    endUserPosition?: string | null;
};

const RLSDDP_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    Lost: { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' },
    Stolen: { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' },
    Damaged: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
    Destroyed: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
};

const selectClass =
    'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] text-sm text-slate-900 transition-colors';

export function AllItemsPage() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const rlsddpBaseRoute = pathname.startsWith('/staff') ? '/staff/rlsddp' : '/admin/rlsddp';

    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedCondition, setSelectedCondition] = useState<number | null>(() => {
        const conditionParam = searchParams.get('condition') || searchParams.get('status');
        if (conditionParam) {
            const conditionMap: { [key: string]: number | null } = {
                serviceable: 1,
                unserviceable: 2,
                all: null,
            };
            const conditionId = conditionMap[conditionParam.toLowerCase()];
            return conditionId !== undefined ? conditionId : null;
        }
        return null;
    });
    const [selectedRlsddpStatus, setSelectedRlsddpStatus] = useState<'Lost' | 'Stolen' | 'Damaged' | 'Destroyed' | null>(() => {
        const rlsddpParam = searchParams.get('rlsddp_status');
        if (rlsddpParam && ['Lost', 'Stolen', 'Damaged', 'Destroyed'].includes(rlsddpParam)) {
            return rlsddpParam as 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed';
        }
        return null;
    });
    const [selectedPropertyType, setSelectedPropertyType] = useState<number | null>(null);
    const [selectedDocumentType, setSelectedDocumentType] = useState<'PAR' | 'ICS' | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
    const [displayMode, setDisplayMode] = useState<'individual' | 'combined'>('individual');
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryDetailEditForm | null>(null);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 500);
        return () => window.clearTimeout(timeoutId);
    }, [search]);

    const { data, isLoading, isFetching, refetch } = useAllInventoryItems({
        page,
        per_page: perPage,
        search: debouncedSearch || undefined,
        property_status_id: selectedCondition || undefined,
        property_type_id: selectedPropertyType || undefined,
        document_type: selectedDocumentType || undefined,
        display_mode: displayMode,
        rlsddp_status: selectedRlsddpStatus || undefined,
        department_id: selectedDepartment || undefined,
    });
    const { data: propertyTypes } = useAllPropertyTypes();
    const { data: allDepartments } = useAllDepartments();

    const [isExportingAll, setIsExportingAll] = useState(false);

    const handleRefresh = () => { refetch(); toast.success('Items refreshed'); };

    const handleExportAll = async () => {
        setIsExportingAll(true);
        try {
            // Fetch the first page to determine total items
            const initialData = await getAllInventoryItems({ per_page: 1 });
            const totalItems = initialData.total || 1000;

            // Fetch all items from backend
            const allItemsData = await getAllInventoryItems({
                per_page: totalItems,
                display_mode: 'individual',
                search: debouncedSearch || undefined,
                property_status_id: selectedCondition || undefined,
                property_type_id: selectedPropertyType || undefined,
                document_type: selectedDocumentType || undefined,
                rlsddp_status: selectedRlsddpStatus || undefined,
            });

            await exportAllItemsToExcel(allItemsData.data || []);
            toast.success('All items exported successfully');
        } catch {
            toast.error('Failed to export all items');
        } finally {
            setIsExportingAll(false);
        }
    };

    const getItemName = (item: InventoryItem) => item.dr_article_name || item.PropertyName || 'Unknown Item';
    const getCustodianDisplayName = (custodianName?: string) => custodianName || 'Requester not set';
    const getQrCodeData = (item: InventoryItem): string | null => item.qrCodeData ?? null;

    const displayedItems = useMemo<CombinedInventoryItem[]>(() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return ((data?.data ?? []) as CombinedInventoryItem[]).map(item => {
            const combinedItems = item.combinedItems || [item];
            const stickerItems: StickerItem[] = combinedItems
                .filter(ci => !!ci.PropertyNumber)
                .map(ci => {
                    const qrCodeData = getQrCodeData(ci);
                    const match = qrCodeData?.match(/\/qr\/scan\/(\d+)/);
                    const url = match?.[1]
                        ? `${origin}/qr/scan/${match[1]}`
                        : `${origin}/admin/inventory/${ci.InventoryID}?detail=${ci.InventoryDetailID}`;
                    return {
                        propertyNumber: ci.PropertyNumber || '',
                        custodianName: ci.custodianName || '',
                        itemName: getItemName(ci),
                        brand: ci.Brand || '',
                        category: ci.PropertyName || ci.ClassificationName || '-',
                        date: ci.CreatedDate ? format(new Date(ci.CreatedDate), 'MM/dd/yyyy') : '-',
                        unitCost: ci.UnitCost,
                        url,
                        serialNumber: ci.SerialNumber || '',
                        modelNumber: ci.ModelNumber || '',
                        endUserName: ci.endUserName || '',
                        currentDepartmentHead: ci.currentDepartmentHead || '',
                    };
                });
            return { ...item, combinedItems, stickerItems };
        });
    }, [data?.data]);

    const isInitialLoading = isLoading && !data;

    const toggleDescriptionExpansion = (inventoryDetailId: number) => {
        setExpandedDescriptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(inventoryDetailId)) newSet.delete(inventoryDetailId);
            else newSet.add(inventoryDetailId);
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
        if (normalized.includes('issuance') || normalized.includes('available'))
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3" />{label}</span>;
        if (normalized.includes('issued'))
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><User className="w-3 h-3" />{label}</span>;
        if (normalized.includes('repair'))
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><AlertTriangle className="w-3 h-3" />{label}</span>;
        if (normalized.includes('disposal') || normalized.includes('disposed'))
            return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3" />{label}</span>;
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800"><Package className="w-3 h-3" />{label}</span>;
    };

    const getBorrowedLabel = (borrowerName?: string | null, departmentName?: string | null) => {
        if (!borrowerName) return null;
        return departmentName ? `Currently borrowed by ${borrowerName} - ${departmentName}` : `Currently borrowed by ${borrowerName}`;
    };

    const getConditionBadge = (item: InventoryItem) => {
        const rs = (item as any).rlsddpStatus as string | null | undefined;
        if (rs === 'Lost' || rs === 'Stolen') {
            return (
                <div className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                    <span className="uppercase tracking-wider">{rs}</span>
                </div>
            );
        }
        if (rs === 'Destroyed') {
            return (
                <div className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                    <span className="uppercase tracking-wider">Unserviceable</span>
                </div>
            );
        }
        if (item.ConditionName) {
            const cn = item.ConditionName.toLowerCase();
            const style = cn.includes('unserviceable')
                ? { backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }
                : cn.includes('under repair')
                    ? { backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }
                    : { backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #bbf7d0' };
            return (
                <div className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold" style={style}>
                    <span className="uppercase tracking-wider">{item.ConditionName}</span>
                </div>
            );
        }
        return <span className="text-xs text-slate-500">Unknown</span>;
    };

    const getRlsddpPill = (item: InventoryItem) => {
        const rs = (item as any).rlsddpStatus as string | null | undefined;
        const rid = (item as any).rlsddpId as number | null | undefined;
        if (!rs) return null;
        const s = RLSDDP_STATUS_STYLES[rs] ?? RLSDDP_STATUS_STYLES.Lost;
        const pill = (
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border"
                style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
            >
                <FileWarning className="w-3 h-3" />
                {rs}
            </span>
        );
        return (
            <div className="mt-1">
                {rid ? <Link href={`${rlsddpBaseRoute}/${rid}`}>{pill}</Link> : pill}
            </div>
        );
    };

    const activeFilterCount = [selectedCondition, selectedRlsddpStatus, selectedPropertyType, selectedDocumentType, selectedDepartment].filter(Boolean).length;

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}>
            <div className="p-6 space-y-5">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">All Inventory Items</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Master ledger of all individual property items across all inventories</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleRefresh}
                            disabled={isFetching}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm font-medium shadow-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <button
                            onClick={handleExportAll}
                            disabled={isExportingAll}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm font-medium shadow-sm"
                        >
                            <Download className={`w-4 h-4 ${isExportingAll ? 'animate-pulse' : ''}`} />
                            {isExportingAll ? 'Exporting...' : 'Export All Items'}
                        </button>
                        {selectedDepartment && (
                            <button
                                onClick={async () => {
                                    const dept = allDepartments?.find(d => d.id === selectedDepartment);
                                    if (!dept) return;
                                    try {
                                        await exportDepartmentItemsToExcel(displayedItems as any, dept.name);
                                    } catch {
                                        toast.error('Failed to export department items');
                                    }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                Export Dept
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Filter Panel ── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Filter className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--primary)] text-white text-[9px] font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </div>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={() => {
                                    setSelectedCondition(null);
                                    setSelectedRlsddpStatus(null);
                                    setSelectedPropertyType(null);
                                    setSelectedDocumentType(null);
                                    setSelectedDepartment(null);
                                    setPage(1);
                                }}
                                className="text-[11px] font-medium text-slate-400 hover:text-red-500 transition-colors"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* Filter row — always one row */}
                    <div className="px-5 py-4 flex flex-wrap lg:flex-nowrap items-end gap-4">

                        <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Department</label>
                            <select
                                value={selectedDepartment || ''}
                                onChange={(e) => { setSelectedDepartment(e.target.value ? Number(e.target.value) : null); setPage(1); }}
                                className={selectClass}
                            >
                                <option value="">All Departments</option>
                                {allDepartments?.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="hidden lg:block w-px h-8 bg-slate-200 self-center shrink-0" />

                        <div className="flex flex-col gap-1.5 w-[160px] shrink-0">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Condition</label>
                            <select
                                value={selectedCondition || ''}
                                onChange={(e) => { setSelectedCondition(e.target.value ? Number(e.target.value) : null); setPage(1); }}
                                className={selectClass}
                            >
                                <option value="">All Conditions</option>
                                <option value={1}>Serviceable</option>
                                <option value={2}>Unserviceable</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5 w-[150px] shrink-0">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">RLSDDP</label>
                            <select
                                value={selectedRlsddpStatus || ''}
                                onChange={(e) => { setSelectedRlsddpStatus(e.target.value ? (e.target.value as any) : null); setPage(1); }}
                                className={selectClass}
                            >
                                <option value="">All Status</option>
                                <option value="Lost">Lost</option>
                                <option value="Stolen">Stolen</option>
                                <option value="Damaged">Damaged</option>
                                <option value="Destroyed">Destroyed</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5 w-[170px] shrink-0">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Property Type</label>
                            <select
                                value={selectedPropertyType || ''}
                                onChange={(e) => { setSelectedPropertyType(e.target.value ? Number(e.target.value) : null); setPage(1); }}
                                className={selectClass}
                            >
                                <option value="">All Types</option>
                                {propertyTypes?.map(type => (
                                    <option key={type.id} value={type.id}>{type.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1.5 w-[130px] shrink-0">
                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Doc Type</label>
                            <select
                                value={selectedDocumentType || ''}
                                onChange={(e) => { setSelectedDocumentType(e.target.value ? (e.target.value as 'PAR' | 'ICS') : null); setPage(1); }}
                                className={selectClass}
                            >
                                <option value="">All Types</option>
                                <option value="PAR">PAR</option>
                                <option value="ICS">ICS</option>
                            </select>
                        </div>

                    </div>

                    {/* Active filter chips */}
                    {activeFilterCount > 0 && (
                        <div className="flex flex-wrap gap-2 px-5 pb-3">
                            {selectedDepartment && (
                                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                                    {allDepartments?.find(d => d.id === selectedDepartment)?.name ?? 'Dept'}
                                    <button onClick={() => { setSelectedDepartment(null); setPage(1); }} className="hover:text-blue-900">✕</button>
                                </span>
                            )}
                            {selectedCondition && (
                                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
                                    {selectedCondition === 1 ? 'Serviceable' : 'Unserviceable'}
                                    <button onClick={() => { setSelectedCondition(null); setPage(1); }} className="hover:text-green-900">✕</button>
                                </span>
                            )}
                            {selectedRlsddpStatus && (
                                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                                    RLSDDP: {selectedRlsddpStatus}
                                    <button onClick={() => { setSelectedRlsddpStatus(null); setPage(1); }} className="hover:text-amber-900">✕</button>
                                </span>
                            )}
                            {selectedPropertyType && (
                                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-medium">
                                    {propertyTypes?.find(t => t.id === selectedPropertyType)?.name ?? 'Type'}
                                    <button onClick={() => { setSelectedPropertyType(null); setPage(1); }} className="hover:text-purple-900">✕</button>
                                </span>
                            )}
                            {selectedDocumentType && (
                                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-xs font-medium">
                                    Doc: {selectedDocumentType}
                                    <button onClick={() => { setSelectedDocumentType(null); setPage(1); }} className="hover:text-slate-900">✕</button>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Summary Stats ── */}
                {data?.data && data.data.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <Package className="w-4 h-4 text-blue-600" />
                                <div className="text-xs font-medium text-slate-600">Total Items</div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900">{data?.stats?.total ?? data.total}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <div className="text-xs font-medium text-slate-600">Serviceable</div>
                            </div>
                            <div className="text-2xl font-bold text-green-600">{data?.stats?.serviceable ?? 0}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <div className="text-xs font-medium text-slate-600">Unserviceable</div>
                            </div>
                            <div className="text-2xl font-bold text-red-600">{data?.stats?.unserviceable ?? 0}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <FileWarning className="w-4 h-4 text-amber-600" />
                                <div className="text-xs font-medium text-slate-600">RLSDDP Tagged</div>
                            </div>
                            <div className="text-2xl font-bold text-amber-600">{(data?.stats as any)?.rlsddp_tagged ?? 0}</div>
                        </div>
                    </div>
                )}

                {/* ── Search ── */}
                <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by description, brand, model, serial number, or inventory number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 text-sm text-slate-900 placeholder:text-slate-400"
                        />
                    </div>
                    {/* Individual / Combined toggle — replaces 25/page */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
                        <button
                            onClick={() => { setDisplayMode('individual'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${displayMode === 'individual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Individual
                        </button>
                        <button
                            onClick={() => { setDisplayMode('combined'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${displayMode === 'combined' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Combined
                        </button>
                    </div>
                </div>

                {/* ── Table ── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Inventory Items</h3>
                            <p className="text-sm text-slate-500">All individual property items</p>
                        </div>
                        <div className="text-sm font-medium text-slate-700">Total Records: {data?.total ?? 0}</div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Article</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4">Property Type</th>
                                    <th className="px-6 py-4">Inventory No.</th>
                                    <th className="px-6 py-4">Status / Condition</th>
                                    <th className="px-6 py-4">Custodian</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {isInitialLoading ? (
                                    <TableSkeletonRows columns={7} rows={10} />
                                ) : displayedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            {debouncedSearch || selectedCondition || selectedPropertyType || selectedRlsddpStatus
                                                ? 'No items found for the current search/filter'
                                                : 'No items found'}
                                        </td>
                                    </tr>
                                ) : (
                                    displayedItems.map((item) => {
                                        const borrowedLabel = getBorrowedLabel(item.currentBorrowerName, item.currentBorrowerDepartment);
                                        const stickerItems = item.stickerItems || [];
                                        return (
                                            <tr key={item.InventoryDetailID} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-900">{getItemName(item)}</div>
                                                    {item.CombinedQuantity && item.CombinedQuantity > 1 && (
                                                        <div className="mt-1 text-xs text-slate-500">{item.CombinedQuantity} items combined</div>
                                                    )}
                                                    <div className="text-xs text-slate-500 space-y-0.5 mt-1">
                                                        {item.Brand && <div>Brand: {item.Brand}</div>}
                                                        {item.ModelNumber && <div>Model: {item.ModelNumber}</div>}
                                                        {item.SerialNumber && <div>Serial: {item.SerialNumber}</div>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    <div
                                                        className={`max-w-xs cursor-pointer text-sm ${expandedDescriptions.has(item.InventoryDetailID) ? '' : 'truncate'}`}
                                                        onClick={() => toggleDescriptionExpansion(item.InventoryDetailID)}
                                                        style={expandedDescriptions.has(item.InventoryDetailID) ? { whiteSpace: 'pre-line' } : {}}
                                                    >
                                                        {getCombinedDescription(item)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap items-center gap-1.5">
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
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        {getStatusBadge(item.PropertyStatusID, item.StatusName)}
                                                        {getConditionBadge(item)}
                                                        {getRlsddpPill(item)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {borrowedLabel ? (
                                                        <div className="flex items-center gap-1 text-amber-700 text-sm">
                                                            <User className="w-3 h-3 shrink-0" />
                                                            {borrowedLabel}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center gap-1 text-sm">
                                                                <User className="w-3 h-3 shrink-0" />
                                                                {getCustodianDisplayName(item.custodianName)}
                                                            </div>
                                                            {item.locationDepartment && (
                                                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3 shrink-0" />
                                                                    {item.locationDepartment}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
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
                                                                custodianName={item.custodianName || ''}
                                                                date={item.CreatedDate ? format(new Date(item.CreatedDate), 'MM/dd/yyyy') : '-'}
                                                                unitCost={item.UnitCost}
                                                                brand={item.Brand || ''}
                                                                serialNumber={item.SerialNumber || ''}
                                                                modelNumber={item.ModelNumber || ''}
                                                                endUserName={item.endUserName || ''}
                                                                currentDepartmentHead={item.currentDepartmentHead || ''}
                                                            />
                                                        )}
                                                        <InventoryHistoryDialog inventoryDetailId={item.InventoryDetailID} itemName={getItemName(item)} />
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

                    {data && data.last_page > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
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
                                <span className="text-sm text-slate-600">Page {data.current_page} of {data.last_page}</span>
                                <button
                                    onClick={() => setPage(Math.min(data.last_page, page + 1))}
                                    disabled={page === data.last_page || isFetching}
                                    className="px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    <EditInventoryDetailModal open={editModalOpen} onOpenChange={setEditModalOpen} item={editingItem} />
                </div>
            </div>
        </div>
    );
}