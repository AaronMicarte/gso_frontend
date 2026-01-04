'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useInventories, usePendingIngestion, useIngestFromIar } from '@/lib/hooks/useInventory';
import { Package, Eye, ArrowDownToLine, Building2, User, MapPin, AlertTriangle, CheckCircle, Clock, Archive, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

export function InventoryListPage({ baseRoute }: { baseRoute: string }) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [selectedCustodian, setSelectedCustodian] = useState<number | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

    const { data, isLoading } = useInventories({ page, per_page: 10, search });
    const { data: pendingIars, isLoading: isLoadingPending } = usePendingIngestion();
    const { mutate: ingest, isPending: isIngesting } = useIngestFromIar();

    const handleIngest = (iarId: number) => {
        ingest(iarId, {
            onSuccess: () => toast.success('Property ledger updated successfully'),
            onError: (err) => toast.error('Failed to ingest: ' + err.message)
        });
    };

    const handleViewIarDetails = (iarId: number) => {
        window.open(`${baseRoute}/inspection-acceptance-reports/${iarId}`, '_blank');
    };

    // Group inventories by property status for hierarchical display
    const groupedInventories = data?.data?.reduce((acc, inv) => {
        // Group by primary property status in the inventory
        const primaryStatus = 'Available'; // Default status since details may not be loaded in list view
        if (!acc[primaryStatus]) acc[primaryStatus] = [];
        acc[primaryStatus].push(inv);
        return acc;
    }, {} as Record<string, typeof data.data>) || {};

    return (
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
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="w-5 h-5 text-blue-600" />
                            <div className="text-sm font-medium text-slate-700">Total Assets</div>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{data.data.reduce((sum, inv) => sum + inv.TotalItems, 0)}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <div className="text-sm font-medium text-slate-700">Available</div>
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                            {data.data.reduce((sum, inv) => sum + inv.TotalItems, 0)}
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="w-5 h-5 text-amber-600" />
                            <div className="text-sm font-medium text-slate-700">Assigned</div>
                        </div>
                        <div className="text-2xl font-bold text-amber-600">
                            0
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <div className="text-sm font-medium text-slate-700">For Disposal</div>
                        </div>
                        <div className="text-2xl font-bold text-red-600">
                            0
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-amber-600" />
                            <div className="text-sm font-medium text-slate-700">Pending</div>
                        </div>
                        <div className="text-2xl font-bold text-amber-600">{pendingIars?.length ?? 0}</div>
                    </div>
                </div>
            )}

            {/* Pending Ingestion Section */}
            {isLoadingPending ? (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <ArrowDownToLine className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-amber-900">Pending Property Ingestion</h2>
                            <p className="text-sm text-amber-700">Loading accepted IARs ready for property ledger...</p>
                        </div>
                    </div>
                </div>
            ) : pendingIars && pendingIars.length > 0 ? (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <ArrowDownToLine className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-amber-900">Pending Property Ingestion</h2>
                            <p className="text-sm text-amber-700">{pendingIars.length} IAR{pendingIars.length > 1 ? 's' : ''} ready for property accountability ledger</p>
                        </div>
                    </div>
                    <p className="text-sm text-amber-700 mb-4">
                        These accepted inspection reports are ready to be added to the property accountability ledger. Click &quot;Ingest&quot; to create property records and assign accountability.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pendingIars.map((iar) => (
                            <div key={iar.IARID} className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium text-slate-900">{iar.IARNumber}</div>
                                        <button
                                            onClick={() => handleViewIarDetails(iar.IARID)}
                                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                            title="View IAR Details"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500">Accepted: {format(toZonedTime(new Date(iar.DateAccepted), 'Asia/Manila'), 'MMM dd, yyyy')}</div>
                                <div className="text-xs text-slate-500 mt-1">{iar.details.length} item{iar.details.length > 1 ? 's' : ''} • {iar.details.reduce((sum, d) => sum + d.QuantityAccepted, 0)} total quantity</div>
                                <button
                                    onClick={() => handleIngest(iar.IARID)}
                                    disabled={isIngesting}
                                    className="w-full mt-3 px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isIngesting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <ArrowDownToLine className="w-3 h-3" />
                                            Ingest to Property Ledger
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

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
                                <th className="px-6 py-4">Location</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary)]"></div>
                                            Loading property ledger...
                                        </div>
                                    </td>
                                </tr>
                            ) : data?.data?.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                        No property records found
                                    </td>
                                </tr>
                            ) : (
                                data?.data?.map((inv: { InventoryID: number; InventoryNumber: string; DateAcquired: string; Remarks?: string; Description?: string; TotalItems: number; TotalValue: number; iar?: { IARNumber: string; deliveryReceipt?: { DRNumber: string } } }) => (
                                    <tr key={inv.InventoryID} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {inv.InventoryNumber}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div>
                                                <div className="text-xs text-slate-500">
                                                    {inv.TotalItems} item{inv.TotalItems > 1 ? 's' : ''} • ₱{inv.TotalValue.toFixed(2)}
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
                                            ₱{inv.TotalValue.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckCircle className="w-3 h-3" />
                                                Available
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            GSO Property Custodian
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="flex items-center gap-1">
                                                <Building2 className="w-3 h-3" />
                                                GSO Warehouse
                                            </div>
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
    );
}
