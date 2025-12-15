'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePurchaseOrders } from '@/lib/hooks/usePurchaseOrders';
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    Eye,
    Edit,
    Trash2,
    FileText,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';
import { format } from 'date-fns';

export default function PurchaseOrdersPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');

    const { data, isLoading } = usePurchaseOrders({
        page,
        search,
        status: statusFilter ? parseInt(statusFilter) : undefined,
        per_page: 10,
    });

    const getStatusColor = (statusId: number) => {
        switch (statusId) {
            case 1: return 'bg-yellow-100 text-yellow-800'; // Pending
            case 2: return 'bg-green-100 text-green-800'; // Approved
            case 3: return 'bg-red-100 text-red-800'; // Rejected
            case 4: return 'bg-gray-100 text-gray-800'; // Cancelled
            case 5: return 'bg-blue-100 text-blue-800'; // Completed
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    const getStatusIcon = (statusId: number) => {
        switch (statusId) {
            case 1: return <Clock className="w-3 h-3" />;
            case 2: return <CheckCircle className="w-3 h-3" />;
            case 3: return <XCircle className="w-3 h-3" />;
            default: return null;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
                    <p className="text-slate-500 text-sm">Manage purchase orders and supplier transactions</p>
                </div>
                <Link
                    href="/admin/purchase-orders/new"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Create PO
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search PO Number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                </div>
                <div className="sm:w-48">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    >
                        <option value="">All Statuses</option>
                        <option value="1">Pending</option>
                        <option value="2">Approved</option>
                        <option value="3">Rejected</option>
                        <option value="5">Completed</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">PO Number</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Supplier</th>
                                <th className="px-6 py-4">PR Reference</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                        Loading...
                                    </td>
                                </tr>
                            ) : data?.data?.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                        No purchase orders found
                                    </td>
                                </tr>
                            ) : (
                                data?.data?.map((po: any) => (
                                    <tr key={po.PurchaseOrderID} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {po.PONumber}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {format(new Date(po.PODate), 'MMM dd, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {po.supplier?.SupplierName}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {po.purchaseRequest?.PRNumber}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                                            ₱{Number(po.TotalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(po.POStatusID)}`}>
                                                {getStatusIcon(po.POStatusID)}
                                                {po.status?.StatusName}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/admin/purchase-orders/${po.PurchaseOrderID}`}
                                                    className="p-2 text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 rounded-lg transition-colors"
                                                    title="View Details"
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
                {data && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                            Showing {data.from} to {data.to} of {data.total} results
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={!data.prev_page_url}
                                className="px-3 py-1 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={!data.next_page_url}
                                className="px-3 py-1 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
