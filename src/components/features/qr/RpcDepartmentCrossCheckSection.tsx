'use client';

import React, { useState, useMemo, useEffect, memo, useRef } from 'react';
import {
    Building2,
    Printer,
    Search,
    FileSpreadsheet,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    ArrowUpDown,
    Filter,
    RotateCcw,
    User,
    Truck,
    Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Department } from '@/types/masterData';
import type { DepartmentCrossCheckItem, DepartmentCrossCheckResponse, RpcType } from '@/types/rpcInventory';
import { exportDepartmentCrossCheckToExcel } from './RpcDepartmentCrossCheckExport';

interface Props {
    departments: Department[];
    selectedDeptId: number | null;
    onSelectDeptId: (id: number) => void;
    selectedType: 'ALL' | RpcType;
    onSelectType: (type: 'ALL' | RpcType) => void;
    search: string;
    onSearchChange: (search: string) => void;
    data: DepartmentCrossCheckResponse | null;
    isLoading: boolean;
    onOpenPreview: (filteredData?: DepartmentCrossCheckResponse) => void;
}

const PER_PAGE = 20;

const fmt = (val: number) =>
    (val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type ScanFilterOption = 'ALL' | 'NEEDS_ATTENTION' | 'NOT_SCANNED' | 'PARTIALLY_SCANNED' | 'SCANNED';

export type SortOption =
    | 'UNSCANNED_DESC'
    | 'UNSCANNED_ASC'
    | 'PROPERTY_ASC'
    | 'PROPERTY_DESC'
    | 'TOTAL_COST_DESC'
    | 'TOTAL_COST_ASC'
    | 'DESCRIPTION_ASC'
    | 'DATE_DESC'
    | 'DATE_ASC';

function getUnscannedCount(item: DepartmentCrossCheckItem): number {
    if (typeof item.unscanned_count === 'number') {
        return item.unscanned_count;
    }
    const s = (item.scan_status || '').toLowerCase();
    if (s === 'scanned') return 0;
    if (s === 'not scanned') return item.quantity || 1;
    const match = item.scan_status?.match(/(\d+)\s+Not Scanned/i) || item.remarks?.match(/(\d+)\s+Not Scanned/i);
    if (match) return parseInt(match[1], 10);
    return item.quantity || 0;
}

function getScannedCount(item: DepartmentCrossCheckItem): number {
    if (typeof item.scanned_count === 'number') {
        return item.scanned_count;
    }
    const s = (item.scan_status || '').toLowerCase();
    if (s === 'scanned') return item.quantity || 1;
    if (s === 'not scanned') return 0;
    const match = item.scan_status?.match(/(\d+)\s+Scanned/i);
    if (match) return parseInt(match[1], 10);
    return 0;
}

function getScanCategory(item: DepartmentCrossCheckItem): 'SCANNED' | 'NOT_SCANNED' | 'PARTIALLY_SCANNED' {
    const unscanned = getUnscannedCount(item);
    const scanned = getScannedCount(item);
    if (unscanned === 0) return 'SCANNED';
    if (scanned === 0) return 'NOT_SCANNED';
    return 'PARTIALLY_SCANNED';
}

const ScanStatusText = memo(function ScanStatusText({ item }: { item: DepartmentCrossCheckItem }) {
    const category = getScanCategory(item);
    const unscanned = getUnscannedCount(item);
    const scanned = getScannedCount(item);

    if (category === 'SCANNED') {
        return <span className="text-amber-700 font-medium">Scanned</span>;
    }

    if (category === 'NOT_SCANNED') {
        return (
            <span className="text-amber-700 font-medium">
                Not Scanned {unscanned > 1 ? `(${unscanned})` : ''}
            </span>
        );
    }

    return (
        <span className="text-amber-700 font-medium" title={`${scanned} Scanned / ${unscanned} Not Scanned`}>
            {scanned} Scanned / {unscanned} Unscanned
        </span>
    );
});

const AssetRow = memo(function AssetRow({ item }: { item: DepartmentCrossCheckItem }) {
    return (
        <tr className="hover:bg-slate-50/70 transition-colors">
            <td className="px-3 py-2.5 whitespace-nowrap">{item.po_number}</td>
            <td className="px-3 py-2.5 whitespace-nowrap">{item.supplier}</td>
            <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-800">{item.par_ics_number}</td>
            <td className="px-3 py-2.5 text-center font-medium">{item.quantity}</td>
            <td className="px-3 py-2.5 text-center text-slate-500">{item.unit}</td>
            <td className="px-3 py-2.5 font-normal text-slate-900 min-w-[200px]">{item.description}</td>
            <td className="px-3 py-2.5 whitespace-nowrap font-mono font-medium text-slate-900">{item.property_number}</td>
            <td className="px-3 py-2.5 text-right whitespace-nowrap">₱{fmt(item.unit_cost)}</td>
            <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">₱{fmt(item.total_cost)}</td>
            <td className="px-3 py-2.5 text-center whitespace-nowrap text-slate-600">{item.date_received}</td>
            <td className="px-3 py-2.5 whitespace-nowrap">
                {item.remarks ? (
                    <span className="text-amber-700 font-medium">{item.remarks}</span>
                ) : (
                    <span className="text-slate-400">—</span>
                )}
            </td>
            <td className="px-3 py-2.5 whitespace-nowrap text-slate-800">{item.end_user}</td>
            <td className="px-3 py-2.5 whitespace-nowrap">
                <ScanStatusText item={item} />
            </td>
        </tr>
    );
});

export function RpcDepartmentCrossCheckSection({
    departments,
    selectedDeptId,
    onSelectDeptId,
    selectedType,
    onSelectType,
    search,
    onSearchChange,
    data,
    isLoading,
    onOpenPreview,
}: Props) {
    const [page, setPage] = useState(1);
    const [isExporting, setIsExporting] = useState(false);
    const [localSearch, setLocalSearch] = useState(search);
    const debounceRef = useRef<number | null>(null);

    // Filter & Sort States
    const [scanFilter, setScanFilter] = useState<ScanFilterOption>('ALL');
    const [sortBy, setSortBy] = useState<SortOption>('PROPERTY_ASC');
    const [selectedEndUser, setSelectedEndUser] = useState<string>('ALL');
    const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');

    useEffect(() => {
        setLocalSearch(search);
    }, [search]);

    useEffect(() => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
            if (localSearch !== search) {
                onSearchChange(localSearch);
                setPage(1);
            }
        }, 300);
        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
        };
    }, [localSearch, onSearchChange, search]);

    const items = data?.data || [];
    const summary = data?.summary;
    const currentDept = data?.department;

    // Scan Stats across all items
    const scanStats = useMemo(() => {
        let fullyScanned = 0;
        let notScanned = 0;
        let partiallyScanned = 0;
        let totalUnscannedUnits = 0;
        let totalScannedUnits = 0;

        for (const item of items) {
            const cat = getScanCategory(item);
            if (cat === 'SCANNED') fullyScanned++;
            else if (cat === 'NOT_SCANNED') notScanned++;
            else partiallyScanned++;

            totalUnscannedUnits += getUnscannedCount(item);
            totalScannedUnits += getScannedCount(item);
        }

        const totalRows = items.length;
        const needsAttention = notScanned + partiallyScanned;
        const completionRate = totalRows > 0 ? Math.round((fullyScanned / totalRows) * 100) : 0;

        return {
            totalRows,
            fullyScanned,
            notScanned,
            partiallyScanned,
            needsAttention,
            totalUnscannedUnits,
            totalScannedUnits,
            completionRate,
        };
    }, [items]);

    // Unique End Users and Suppliers
    const uniqueEndUsers = useMemo(() => {
        const set = new Set<string>();
        items.forEach((i) => {
            if (i.end_user && i.end_user !== '-') set.add(i.end_user);
        });
        return Array.from(set).sort();
    }, [items]);

    const uniqueSuppliers = useMemo(() => {
        const set = new Set<string>();
        items.forEach((i) => {
            if (i.supplier && i.supplier !== '-') set.add(i.supplier);
        });
        return Array.from(set).sort();
    }, [items]);

    // Filtered & Sorted items
    const filteredAndSortedItems = useMemo(() => {
        let result = [...items];

        // Filter by Scan Status
        if (scanFilter === 'NEEDS_ATTENTION') {
            result = result.filter((i) => getScanCategory(i) !== 'SCANNED');
        } else if (scanFilter === 'NOT_SCANNED') {
            result = result.filter((i) => getScanCategory(i) === 'NOT_SCANNED');
        } else if (scanFilter === 'PARTIALLY_SCANNED') {
            result = result.filter((i) => getScanCategory(i) === 'PARTIALLY_SCANNED');
        } else if (scanFilter === 'SCANNED') {
            result = result.filter((i) => getScanCategory(i) === 'SCANNED');
        }

        // Filter by End User
        if (selectedEndUser !== 'ALL') {
            result = result.filter((i) => i.end_user === selectedEndUser);
        }

        // Filter by Supplier
        if (selectedSupplier !== 'ALL') {
            result = result.filter((i) => i.supplier === selectedSupplier);
        }

        // Sorting
        result.sort((a, b) => {
            if (sortBy === 'UNSCANNED_DESC') {
                const diff = getUnscannedCount(b) - getUnscannedCount(a);
                if (diff !== 0) return diff;
                return (a.property_number || '').localeCompare(b.property_number || '', undefined, { numeric: true });
            }
            if (sortBy === 'UNSCANNED_ASC') {
                const diff = getUnscannedCount(a) - getUnscannedCount(b);
                if (diff !== 0) return diff;
                return (a.property_number || '').localeCompare(b.property_number || '', undefined, { numeric: true });
            }
            if (sortBy === 'PROPERTY_ASC') {
                return (a.property_number || '').localeCompare(b.property_number || '', undefined, { numeric: true });
            }
            if (sortBy === 'PROPERTY_DESC') {
                return (b.property_number || '').localeCompare(a.property_number || '', undefined, { numeric: true });
            }
            if (sortBy === 'TOTAL_COST_DESC') {
                return (b.total_cost || 0) - (a.total_cost || 0);
            }
            if (sortBy === 'TOTAL_COST_ASC') {
                return (a.total_cost || 0) - (b.total_cost || 0);
            }
            if (sortBy === 'DESCRIPTION_ASC') {
                return (a.description || '').localeCompare(b.description || '');
            }
            if (sortBy === 'DATE_DESC') {
                return (b.date_received || '').localeCompare(a.date_received || '');
            }
            if (sortBy === 'DATE_ASC') {
                return (a.date_received || '').localeCompare(b.date_received || '');
            }
            return 0;
        });

        return result;
    }, [items, scanFilter, selectedEndUser, selectedSupplier, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / PER_PAGE));

    const pagedItems = useMemo(
        () => filteredAndSortedItems.slice((page - 1) * PER_PAGE, page * PER_PAGE),
        [filteredAndSortedItems, page]
    );

    const hasActiveFilters =
        scanFilter !== 'ALL' ||
        selectedEndUser !== 'ALL' ||
        selectedSupplier !== 'ALL' ||
        sortBy !== 'PROPERTY_ASC';

    const handleResetFilters = () => {
        setScanFilter('ALL');
        setSortBy('PROPERTY_ASC');
        setSelectedEndUser('ALL');
        setSelectedSupplier('ALL');
        setPage(1);
    };

    // Filtered data payload for Excel export and preview
    const filteredDataPayload = useMemo<DepartmentCrossCheckResponse | null>(() => {
        if (!data) return null;
        return {
            ...data,
            summary: {
                ...data.summary,
                total_items: filteredAndSortedItems.reduce((acc, i) => acc + (i.quantity || 1), 0),
                total_cost: filteredAndSortedItems.reduce((acc, i) => acc + (i.total_cost || 0), 0),
            },
            data: filteredAndSortedItems,
        };
    }, [data, filteredAndSortedItems]);

    const handleExportExcel = async () => {
        const payloadToExport = hasActiveFilters && filteredDataPayload ? filteredDataPayload : data;
        if (!payloadToExport) return;
        try {
            setIsExporting(true);
            await exportDepartmentCrossCheckToExcel(payloadToExport, selectedType);
        } finally {
            setIsExporting(false);
        }
    };

    const handleOpenPreview = () => {
        const payloadToPreview = hasActiveFilters && filteredDataPayload ? filteredDataPayload : data;
        onOpenPreview(payloadToPreview || undefined);
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <Building2 className="w-4 h-4 text-slate-600" />
                            <span>Department Cross-Checking</span>
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mt-1">
                            Cross-Check Assets by Department
                        </h2>
                        <p className="text-xs text-slate-500">
                            View, filter, sort, and cross-check physical assets issued to a specific department.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleExportExcel}
                            disabled={isLoading || !filteredAndSortedItems.length || isExporting}
                            className="inline-flex items-center gap-2 whitespace-nowrap"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>{isExporting ? 'Exporting...' : hasActiveFilters ? 'Export Filtered' : 'Export to Excel'}</span>
                        </Button>
                        <Button
                            type="button"
                            onClick={handleOpenPreview}
                            disabled={isLoading || !filteredAndSortedItems.length}
                            className="inline-flex items-center gap-2 whitespace-nowrap"
                        >
                            <Printer className="w-4 h-4" />
                            <span>{hasActiveFilters ? 'Preview Filtered' : 'Generate Preview'}</span>
                        </Button>
                    </div>
                </div>

                {/* Primary Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-slate-100">
                    {/* Department Selector */}
                    <div className="lg:col-span-3">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                        <select
                            value={selectedDeptId ?? ''}
                            onChange={(e) => {
                                onSelectDeptId(Number(e.target.value));
                                setPage(1);
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                        >
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name} {dept.code ? `(${dept.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Classification Selector */}
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Classification</label>
                        <select
                            value={selectedType}
                            onChange={(e) => {
                                onSelectType(e.target.value as 'ALL' | RpcType);
                                setPage(1);
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                        >
                            <option value="ALL">All (RPCPPE & RPCSEP)</option>
                            <option value="RPCPPE">RPCPPE Only</option>
                            <option value="RPCSEP">RPCSEP Only</option>
                        </select>
                    </div>

                    {/* Scan Status Filter */}
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                            <span>Scan Status</span>
                            {scanFilter !== 'ALL' && (
                                <span className="text-[10px] text-amber-600 font-semibold uppercase">Filtered</span>
                            )}
                        </label>
                        <select
                            value={scanFilter}
                            onChange={(e) => {
                                setScanFilter(e.target.value as ScanFilterOption);
                                setPage(1);
                            }}
                            className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 ${scanFilter !== 'ALL'
                                ? 'border-amber-400 bg-amber-50/30 font-medium text-amber-900'
                                : 'border-slate-200 text-slate-900'
                                }`}
                        >
                            <option value="ALL">All Scan Statuses ({scanStats.totalRows})</option>
                            <option value="NEEDS_ATTENTION">Needs Attention ({scanStats.needsAttention})</option>
                            <option value="NOT_SCANNED">Not Scanned ({scanStats.notScanned})</option>
                            <option value="PARTIALLY_SCANNED">Partially Scanned ({scanStats.partiallyScanned})</option>
                            <option value="SCANNED">Fully Scanned ({scanStats.fullyScanned})</option>
                        </select>
                    </div>

                    {/* Sort By Dropdown (includes requested unscanned count sorting) */}
                    <div className="lg:col-span-3">
                        <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                            <ArrowUpDown className="w-3 h-3 text-slate-500" />
                            <span>Sort By</span>
                        </label>
                        <select
                            value={sortBy}
                            onChange={(e) => {
                                setSortBy(e.target.value as SortOption);
                                setPage(1);
                            }}
                            className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 ${sortBy.startsWith('UNSCANNED')
                                ? 'border-indigo-400 bg-indigo-50/30 font-medium text-indigo-900'
                                : 'border-slate-200 text-slate-900'
                                }`}
                        >
                            <option value="UNSCANNED_DESC">Unscanned Count: High to Low (5 to 1)</option>
                            <option value="UNSCANNED_ASC">Unscanned Count: Low to High (1 to 5)</option>
                            <option value="PROPERTY_ASC">Property Number (Ascending)</option>
                            <option value="PROPERTY_DESC">Property Number (Descending)</option>
                            <option value="TOTAL_COST_DESC">Total Cost (Highest First)</option>
                            <option value="TOTAL_COST_ASC">Total Cost (Lowest First)</option>
                            <option value="DESCRIPTION_ASC">Description (A to Z)</option>
                            <option value="DATE_DESC">Date Received (Newest First)</option>
                            <option value="DATE_ASC">Date Received (Oldest First)</option>
                        </select>
                    </div>

                    {/* Search Field */}
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Search</label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                placeholder="Property, PO, item..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                            />
                        </div>
                    </div>
                </div>

                {/* Secondary Dropdown Filter Row (End User, Supplier, Reset) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* End User Dropdown */}
                        {uniqueEndUsers.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-xs text-slate-600 font-medium">End User:</span>
                                <select
                                    value={selectedEndUser}
                                    onChange={(e) => {
                                        setSelectedEndUser(e.target.value);
                                        setPage(1);
                                    }}
                                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                >
                                    <option value="ALL">All End Users ({uniqueEndUsers.length})</option>
                                    {uniqueEndUsers.map((eu) => (
                                        <option key={eu} value={eu}>
                                            {eu}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Supplier Dropdown */}
                        {uniqueSuppliers.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-xs text-slate-600 font-medium">Supplier:</span>
                                <select
                                    value={selectedSupplier}
                                    onChange={(e) => {
                                        setSelectedSupplier(e.target.value);
                                        setPage(1);
                                    }}
                                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                                >
                                    <option value="ALL">All Suppliers ({uniqueSuppliers.length})</option>
                                    {uniqueSuppliers.map((sup) => (
                                        <option key={sup} value={sup}>
                                            {sup}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Reset Filters Action */}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium py-1 px-2 rounded-md hover:bg-slate-100 transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Filters</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Department</div>
                    <div className="mt-1 text-base font-bold text-slate-900 truncate" title={currentDept?.DepartmentName}>
                        {currentDept?.DepartmentName || 'Loading...'}
                    </div>
                    <div className="text-xs text-slate-600 truncate mt-0.5" title={currentDept?.DepartmentHead || undefined}>
                        <span>Head: </span>
                        <span className="font-medium text-slate-900">{currentDept?.DepartmentHead || 'Vacant / Unassigned'}</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total Assets</div>
                    <div className="mt-1 text-2xl font-black text-slate-900">{summary?.total_items ?? 0}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                        {summary?.rpcppe_count ?? 0} RPCPPE | {summary?.rpcsep_count ?? 0} RPCSEP
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                        <span>Scan Progress</span>
                        <span className="text-emerald-700 font-bold">{scanStats.completionRate}%</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                        <div
                            className="bg-emerald-500 h-2 transition-all duration-300"
                            style={{ width: `${scanStats.completionRate}%` }}
                        />
                        {scanStats.needsAttention > 0 && (
                            <div
                                className="bg-rose-400 h-2 transition-all duration-300"
                                style={{ width: `${100 - scanStats.completionRate}%` }}
                            />
                        )}
                    </div>
                    <div className="text-xs text-slate-600 mt-2 flex items-center justify-between">
                        <span className="text-emerald-700 font-semibold">{scanStats.fullyScanned} Scanned</span>
                        <span className="text-rose-700 font-semibold">{scanStats.needsAttention} Unscanned</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total Value</div>
                    <div className="mt-1 text-2xl font-black text-slate-900">
                        ₱{fmt(summary?.total_cost ?? 0)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Acquisition cost total</div>
                </div>
            </div>

            {/* Quick Status Pill Filter Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1.5 mr-1">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Quick Filter:</span>
                </span>

                <button
                    type="button"
                    onClick={() => { setScanFilter('ALL'); setPage(1); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${scanFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    All Assets ({scanStats.totalRows})
                </button>

                <button
                    type="button"
                    onClick={() => { setScanFilter('NEEDS_ATTENTION'); setPage(1); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${scanFilter === 'NEEDS_ATTENTION'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                        }`}
                >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Needs Attention ({scanStats.needsAttention})</span>
                </button>

                <button
                    type="button"
                    onClick={() => { setScanFilter('NOT_SCANNED'); setPage(1); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${scanFilter === 'NOT_SCANNED'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100'
                        }`}
                >
                    <XCircle className="w-3 h-3" />
                    <span>Not Scanned ({scanStats.notScanned})</span>
                </button>

                <button
                    type="button"
                    onClick={() => { setScanFilter('PARTIALLY_SCANNED'); setPage(1); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${scanFilter === 'PARTIALLY_SCANNED'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-amber-50/60 border border-amber-200/80 text-amber-700 hover:bg-amber-100'
                        }`}
                >
                    <Zap className="w-3 h-3" />
                    <span>Partially Scanned ({scanStats.partiallyScanned})</span>
                </button>

                <button
                    type="button"
                    onClick={() => { setScanFilter('SCANNED'); setPage(1); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${scanFilter === 'SCANNED'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                        }`}
                >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Fully Scanned ({scanStats.fullyScanned})</span>
                </button>
            </div>

            {/* Assets Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">Assigned Assets</span>
                        {hasActiveFilters && (
                            <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-medium">
                                Filtered view ({filteredAndSortedItems.length} of {items.length})
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-slate-500">
                        Showing {filteredAndSortedItems.length ? (page - 1) * PER_PAGE + 1 : 0} to{' '}
                        {Math.min(page * PER_PAGE, filteredAndSortedItems.length)} of {filteredAndSortedItems.length}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 font-semibold border-b border-slate-200 text-slate-700">
                            <tr>
                                <th className="px-3 py-3 whitespace-nowrap">PO Number</th>
                                <th className="px-3 py-3 whitespace-nowrap min-w-[110px]">Supplier</th>
                                <th className="px-3 py-3 whitespace-nowrap">PAR/ICS Number</th>
                                <th className="px-3 py-3 text-center whitespace-nowrap">Qty</th>
                                <th className="px-3 py-3 text-center whitespace-nowrap">Unit</th>
                                <th className="px-3 py-3 min-w-[200px]">Description</th>
                                <th className="px-3 py-3 whitespace-nowrap">Property Number</th>
                                <th className="px-3 py-3 text-right whitespace-nowrap">Unit Cost</th>
                                <th className="px-3 py-3 text-right whitespace-nowrap">Total Cost</th>
                                <th className="px-3 py-3 text-center whitespace-nowrap">Date Received</th>
                                <th className="px-3 py-3 min-w-[110px]">Remarks</th>
                                <th className="px-3 py-3 min-w-[130px]">End User</th>
                                <th className="px-3 py-3 min-w-[160px] whitespace-nowrap">Scan Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 [content-visibility:auto]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                                        Loading department assets...
                                    </td>
                                </tr>
                            ) : !filteredAndSortedItems.length ? (
                                <tr>
                                    <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <p className="font-medium text-slate-700">No assets match the selected filters.</p>
                                            {hasActiveFilters && (
                                                <Button size="sm" variant="outline" onClick={handleResetFilters}>
                                                    Reset Filters
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pagedItems.map((item, idx) => (
                                    <AssetRow key={`${item.inventory_detail_id}-${item.property_number}-${idx}`} item={item} />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
                        <div className="text-xs text-slate-500">Page {page} of {totalPages}</div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-8 px-2"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="h-8 px-2"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}