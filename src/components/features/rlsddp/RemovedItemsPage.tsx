'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Trash2, RotateCcw, Search, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getRemovedItems, restoreInventoryDetail } from '@/lib/api/inventory';

interface RemovedItemsPageProps {
    baseRoute: string;
}

export function RemovedItemsPage({ baseRoute }: RemovedItemsPageProps) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [isRestoring, setIsRestoring] = useState<number | null>(null);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getRemovedItems({
                search: debouncedSearch || undefined,
                page: currentPage,
                per_page: 25,
            });
            setItems(res.data ?? []);
            setTotalPages(res.last_page ?? 1);
            setTotal(res.total ?? (res.data ? res.data.length : 0));
        } catch {
            toast.error('Failed to load removed items');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const handleRestore = async (item: any) => {
        const id = item.InventoryDetailID ?? item.InventoryDetailID;
        setIsRestoring(id);
        try {
            await restoreInventoryDetail(id);
            toast.success(`${item.PropertyNumber || 'Item'} restored to active inventory.`);
            fetchItems();
        } catch (err) {
            toast.error('Failed to restore item.');
        } finally {
            setIsRestoring(null);
        }
    };

    return (
        <div
            className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}
        >
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div>
                                    <h1 className="text-xl font-bold text-slate-900">Removed Inventory Items</h1>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        Items removed from active inventory via RLSDDP reports. Restore to re-activate.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search property, report, department..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 w-72 bg-slate-50"
                                    />
                                </div>
                            </div>
                        </div>

                        {total > 0 && (
                            <div className="mt-4 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 rounded-full text-xs font-semibold text-rose-700">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {total} removed {total === 1 ? 'item' : 'items'} hidden from active inventory
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-slate-500">Property No.</th>
                                    <th className="px-4 py-3 font-semibold text-slate-500">Description</th>
                                    <th className="px-4 py-3 font-semibold text-slate-500 text-right">Acquisition Cost</th>
                                    <th className="px-4 py-3 font-semibold text-slate-500">Department</th>
                                    <th className="px-4 py-3 font-semibold text-slate-500">Accountable Officer</th>
                                    <th className="px-4 py-3 font-semibold text-slate-500">Removed At</th>
                                    <th className="px-4 py-3 font-semibold text-slate-500 text-center w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            {Array.from({ length: 8 }).map((__, j) => (
                                                <td key={j} className="px-4 py-4">
                                                    <div className="h-4 bg-slate-200 rounded w-full" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : items.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-16 text-center">
                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                <Trash2 className="w-8 h-8 opacity-40" />
                                                <p className="font-medium text-slate-500">No removed items found</p>
                                                <p className="text-xs">Items removed from active inventory will appear here.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item) => (
                                        <tr key={item.InventoryDetailID || item.InventoryDetailID} className="hover:bg-rose-50/20 group">
                                            <td className="px-4 py-3 font-semibold text-slate-400 line-through">
                                                {item.PropertyNumber || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 max-w-xs truncate line-through" title={item.Description}>
                                                {item.Description?.replace(/\b(Brand|Model|S\.?N\.?|Serial\s*No\.?|Serial\s*Number):\s*/gi, '').trim() || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-400 line-through tabular-nums">
                                                ₱{Number(item.AcquisitionCost ?? item.UnitCost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-sm">
                                                {item.DepartmentName || item.department_name || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-sm">
                                                {item.AccountableOfficer || item.accountable_officer || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs tabular-nums whitespace-nowrap">
                                                {format(toZonedTime(new Date(item.removed_at || item.deleted_at), 'Asia/Manila'), 'MMM dd, yyyy HH:mm')}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleRestore(item)}
                                                    disabled={isRestoring === (item.InventoryDetailID ?? item.InventoryDetailID)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Restore to active inventory"
                                                >
                                                    {isRestoring === (item.InventoryDetailID ?? item.InventoryDetailID) ? (
                                                        <span className="w-3.5 h-3.5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                                                    ) : (
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                    )}
                                                    Restore
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between text-sm">
                            <p className="text-slate-500">
                                Page {currentPage} of {totalPages} · {total} total items
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
