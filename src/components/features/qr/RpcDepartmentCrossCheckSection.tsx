'use client';

import React, { useState, useMemo, useEffect, memo, useRef } from 'react';
import { Building2, Printer, Search, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Department } from '@/types/masterData';
import type { DepartmentCrossCheckResponse, RpcType } from '@/types/rpcInventory';
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
    onOpenPreview: () => void;
}

const PER_PAGE = 20;

const fmt = (val: number) =>
    (val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AssetRow = memo(function AssetRow({ item }: { item: any }) {
    return (
        <tr className="hover:bg-slate-50/70">
            <td className="px-3 py-2.5">{item.po_number}</td>
            <td className="px-3 py-2.5">{item.supplier}</td>
            <td className="px-3 py-2.5">{item.par_ics_number}</td>
            <td className="px-3 py-2.5 text-center">{item.quantity}</td>
            <td className="px-3 py-2.5 text-center">{item.unit}</td>
            <td className="px-3 py-2.5">{item.description}</td>
            <td className="px-3 py-2.5">{item.property_number}</td>
            <td className="px-3 py-2.5 text-right">₱{fmt(item.unit_cost)}</td>
            <td className="px-3 py-2.5 text-right">₱{fmt(item.total_cost)}</td>
            <td className="px-3 py-2.5 text-center">{item.date_received}</td>
            <td className="px-3 py-2.5">{item.remarks}</td>
            <td className="px-3 py-2.5">{item.end_user}</td>
            <td className="px-3 py-2.5">{item.scan_status}</td>
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localSearch]);

    const items = data?.data || [];
    const summary = data?.summary;
    const currentDept = data?.department;
    const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));

    const pagedItems = useMemo(
        () => items.slice((page - 1) * PER_PAGE, page * PER_PAGE),
        [items, page]
    );

    const handleExportExcel = async () => {
        if (!data) return;
        try {
            setIsExporting(true);
            await exportDepartmentCrossCheckToExcel(data, selectedType);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <Building2 className="w-4 h-4" />
                            <span>Department Cross-Checking</span>
                        </div>
                        <h2 className="text-lg font-bold mt-1">
                            Cross-Check Assets by Department
                        </h2>
                        <p className="text-xs text-slate-500">
                            View and cross-check all physical assets issued to a specific department.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleExportExcel}
                            disabled={isLoading || !items.length || isExporting}
                            className="inline-flex items-center gap-2 whitespace-nowrap"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>{isExporting ? 'Exporting...' : 'Export to Excel'}</span>
                        </Button>
                        <Button
                            type="button"
                            onClick={onOpenPreview}
                            disabled={isLoading || !items.length}
                            className="inline-flex items-center gap-2 whitespace-nowrap"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Generate Cross-Check Preview</span>
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-100">
                    <div className="md:col-span-5">
                        <label className="block text-xs font-medium mb-1">Select Department</label>
                        <select
                            value={selectedDeptId ?? ''}
                            onChange={(e) => {
                                onSelectDeptId(Number(e.target.value));
                                setPage(1);
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        >
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name} {dept.code ? `(${dept.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-medium mb-1">Classification</label>
                        <select
                            value={selectedType}
                            onChange={(e) => {
                                onSelectType(e.target.value as 'ALL' | RpcType);
                                setPage(1);
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        >
                            <option value="ALL">All (RPCPPE & RPCSEP)</option>
                            <option value="RPCPPE">RPCPPE Only</option>
                            <option value="RPCSEP">RPCSEP Only</option>
                        </select>
                    </div>

                    <div className="md:col-span-4">
                        <label className="block text-xs font-medium mb-1">Search Assets</label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                placeholder="Search property, PO, description..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Department</div>
                    <div className="mt-1 text-base font-bold truncate" title={currentDept?.DepartmentName}>
                        {currentDept?.DepartmentName || 'Loading...'}
                    </div>
                    <div className="text-xs text-slate-600 truncate" title={currentDept?.DepartmentHead || undefined}>
                        <span className="text-slate-900">{currentDept?.DepartmentHead || 'Vacant / Unassigned'}</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Total Assets</div>
                    <div className="mt-1 text-2xl font-black">{summary?.total_items ?? 0}</div>
                    <div className="text-xs text-slate-500">Cross-checking items</div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">RPCPPE / RPCSEP</div>
                    <div className="mt-1 text-base font-bold flex items-center gap-3">
                        <span>{summary?.rpcppe_count ?? 0} PPE</span>
                        <span>|</span>
                        <span>{summary?.rpcsep_count ?? 0} SEP</span>
                    </div>
                    <div className="text-xs text-slate-500">Classification breakdown</div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Total Value</div>
                    <div className="mt-1 text-2xl font-black">
                        ₱{fmt(summary?.total_cost ?? 0)}
                    </div>
                    <div className="text-xs text-slate-500">Acquisition cost total</div>
                </div>
            </div>

            {/* Assets Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Assigned Assets</span>
                        <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full font-medium">
                            {items.length} items
                        </span>
                    </div>
                    <div className="text-xs text-slate-500">
                        Showing {items.length ? (page - 1) * PER_PAGE + 1 : 0} to {Math.min(page * PER_PAGE, items.length)} of {items.length}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 font-semibold border-b border-slate-200">
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
                                <th className="px-3 py-3 min-w-[140px] whitespace-nowrap">Scan Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 [content-visibility:auto]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                                        Loading department assets...
                                    </td>
                                </tr>
                            ) : !pagedItems.length ? (
                                <tr>
                                    <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                                        No assets found for the selected department and filters.
                                    </td>
                                </tr>
                            ) : (
                                pagedItems.map((item) => (
                                    <AssetRow key={item.inventory_detail_id} item={item} />
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