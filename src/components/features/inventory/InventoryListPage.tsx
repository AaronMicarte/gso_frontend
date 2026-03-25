'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useInventories, useAllInventoryItems } from '@/lib/hooks/useInventory';
import { Package, Eye, User, AlertTriangle, CheckCircle, Archive, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export function InventoryListPage({ baseRoute }: { baseRoute: string }) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');

    const { data } = useInventories({ page, per_page: 10, search });

    // Summary stats should reflect actual per-item status (same logic as AllItemsPage)
    // Use per_page=1 to avoid loading large datasets; we only need the totals.
    const { data: allItemsStats } = useAllInventoryItems({ page: 1, per_page: 1, search: '' });
    const { data: availableItemsStats } = useAllInventoryItems({ page: 1, per_page: 1, search: '', property_status_id: 1 });
    const { data: assignedItemsStats } = useAllInventoryItems({ page: 1, per_page: 1, search: '', property_status_id: 2 });

    const totalItems = allItemsStats?.total ?? 0;
    const availableItems = availableItemsStats?.total ?? 0;
    const assignedItems = assignedItemsStats?.total ?? 0;
    const otherItems = Math.max(0, totalItems - availableItems - assignedItems);


    type InventoryRowDetail = {
        PropertyStatusID?: number;
        Quantity?: number;
        QuantityAvailable?: number;
    };

    const getAvailableLeft = (details?: InventoryRowDetail[]) => {
        if (!details || details.length === 0) return 0;
        return details.reduce((sum, d) => {
            if (d.PropertyStatusID !== 1) return sum;
            const qty = d.QuantityAvailable ?? d.Quantity ?? 0;
            return sum + qty;
        }, 0);
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Property Accountability Ledger</h1>
                        <p className="text-slate-500 text-sm">Official record of all government property under GSO custody</p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <input
                            type="text"
                            placeholder="Search inventories..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        />
                        <Link
                            href={`${baseRoute}/inventory/reports`}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <Archive className="w-4 h-4" />
                            Reports
                        </Link>
                    </div>
                </div>

                {/* Summary Stats - GSO Style */}
                {data?.data && data.data.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <Package className="w-5 h-5 text-blue-600" />
                                <div className="text-sm font-medium text-slate-700">Total Assets</div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900">{totalItems}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <div className="text-sm font-medium text-slate-700">Available</div>
                            </div>
                            <div className="text-2xl font-bold text-green-600">
                                {availableItems}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <User className="w-5 h-5 text-amber-600" />
                                <div className="text-sm font-medium text-slate-700">Issued</div>
                            </div>
                            <div className="text-2xl font-bold text-amber-600">
                                {assignedItems}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <div className="text-sm font-medium text-slate-700">For Disposal</div>
                            </div>
                            <div className="text-2xl font-bold text-red-600">
                                {otherItems}
                            </div>
                        </div>
                    </div>
                )}

                {/* Property Accountability Ledger - Real GSO Style */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Property Accountability Ledger</h3>
                                <p className="text-sm text-slate-600">Complete inventory of all property under GSO accountability</p>
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
                                    <th className="px-6 py-4">Inventory Number</th>
                                    <th className="px-6 py-4">Details</th>
                                    <th className="px-6 py-4">Acquisition Date</th>
                                    <th className="px-6 py-4">Total Value</th>
                                    <th className="px-6 py-4">Property Status</th>
                                    <th className="px-6 py-4">Custodian</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {data?.data?.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No property records found
                                        </td>
                                    </tr>
                                ) : (
                                    data?.data?.map((inv: { InventoryID: number; InventoryNumber: string; DateAcquired: string; Remarks?: string; Description?: string; TotalItems: number; TotalValue: number; details?: InventoryRowDetail[]; PrimaryStatus?: 'Available' | 'Assigned'; CurrentCustodianName?: string; CurrentLocation?: string; iar?: { IARNumber: string; deliveryReceipt?: { DRNumber: string } } }) => (
                                        <tr key={inv.InventoryID} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {inv.InventoryNumber}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <div>
                                                    <div className="text-xs text-slate-500">
                                                        {inv.TotalItems} item{inv.TotalItems > 1 ? 's' : ''} • ₱{inv.TotalValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                    {inv.iar && (
                                                        <div className="text-xs text-slate-400 mt-1">
                                                            IAR: {inv.iar.IARNumber} {inv.iar.deliveryReceipt && `• DR: ${inv.iar.deliveryReceipt.DRNumber}`}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {format(toZonedTime(new Date(inv.DateAcquired), 'Asia/Manila'), 'MMM dd, yyyy')}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                ₱{inv.TotalValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getAvailableLeft(inv.details) > 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        <CheckCircle className="w-3 h-3" />
                                                        {getAvailableLeft(inv.details)} For issuance
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        <User className="w-3 h-3" />
                                                        All Issued
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <div className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {inv.CurrentCustodianName || 'Requester not set'}
                                                </div>
                                                {inv.CurrentLocation && (
                                                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                        <Building2 className="w-3 h-3" />
                                                        {inv.CurrentLocation}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`${baseRoute}/inventory/${inv.InventoryID}`}
                                                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                        title="View Property Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Link>
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
                                <div className="text-sm text-slate-500">
                                    Showing {((data.current_page - 1) * data.per_page) + 1} to {Math.min(data.current_page * data.per_page, data.total)} of {data.total} property records
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(Math.max(1, page - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-slate-600">Page {data?.current_page ?? 1} of {data?.last_page ?? 1}</span>
                                    <button
                                        onClick={() => setPage(Math.min(data?.last_page ?? 1, page + 1))}
                                        disabled={page === (data?.last_page ?? 1)}
                                        className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
