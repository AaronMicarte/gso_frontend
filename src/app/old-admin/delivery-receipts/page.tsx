'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDeliveryReceipts, useDeleteDeliveryReceipt } from '@/lib/hooks/useDeliveryReceipts';
import {
    Plus,
    Search,
    Eye,
    Edit,
    Trash2,
    Package,
    ClipboardCheck,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from 'sonner';

export default function DeliveryReceiptsPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [drToDelete, setDrToDelete] = useState<{ DRID: number; DRNumber: string } | null>(null);

    const { data, isLoading } = useDeliveryReceipts({
        page,
        per_page: 10,
    });

    const deleteMutation = useDeleteDeliveryReceipt();

    const handleDelete = (dr: { DRID: number; DRNumber: string }) => {
        setDrToDelete(dr);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (drToDelete) {
            deleteMutation.mutate(drToDelete.DRID, {
                onSuccess: () => {
                    setDeleteDialogOpen(false);
                    setDrToDelete(null);
                    toast.success(`Delivery Receipt ${drToDelete.DRNumber} has been deleted successfully`);
                },
            });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Delivery Receipts</h1>
                    <p className="text-slate-500 text-sm">Manage delivery receipts and supplier deliveries</p>
                </div>
                <Link
                    href="/admin/delivery-receipts/new"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Create DR
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search DR Number, Supplier, or PO Number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">DR Number</th>
                                <th className="px-6 py-4">Supplier</th>
                                <th className="px-6 py-4">Date Received</th>
                                <th className="px-6 py-4">Total Amount</th>
                                <th className="px-6 py-4">IAR Status</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary)]"></div>
                                            Loading delivery receipts...
                                        </div>
                                    </td>
                                </tr>
                            ) : data?.data?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                        No delivery receipts found
                                    </td>
                                </tr>
                            ) : (
                                data?.data?.map((dr) => {
                                    const totalAmount = dr.details ? dr.details.reduce((sum, item) => {
                                        const cost = item.TotalCost ? parseFloat(String(item.TotalCost)) : 0;
                                        return sum + cost;
                                    }, 0) : 0;
                                    return (
                                        <tr key={dr.DRID} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {dr.DRNumber}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {dr.SupplierName || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {format(toZonedTime(new Date(dr.DateReceived), 'Asia/Manila'), 'MMM dd, yyyy')}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                ₱{totalAmount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}
                                            </td>
                                            <td className="px-6 py-4">
                                                {dr.hasIAR ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                                        <ClipboardCheck className="w-3 h-3" />
                                                        Inspected
                                                    </span>
                                                ) : dr.iar_status === 'Accepted' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Accepted
                                                    </span>
                                                ) : dr.iar_status === 'Inspected' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                                        <ClipboardCheck className="w-3 h-3" />
                                                        Inspected
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Pending IAR
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {!dr.hasIAR && (
                                                        <Link
                                                            href={`/admin/delivery-receipts/create-iar?dr_id=${dr.DRID}`}
                                                            className="p-1 text-green-600 hover:text-green-700 transition-colors"
                                                            title="Create IAR"
                                                        >
                                                            <ClipboardCheck className="w-4 h-4" />
                                                        </Link>
                                                    )}
                                                    <Link
                                                        href={`/admin/delivery-receipts/${dr.DRID}`}
                                                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Link>
                                                    <Link
                                                        href={`/admin/delivery-receipts/${dr.DRID}/edit`}
                                                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete({ DRID: dr.DRID, DRNumber: dr.DRNumber })}
                                                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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
                {data?.meta && data.meta.last_page > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-500">
                                Showing {((data.meta.current_page - 1) * data.meta.per_page) + 1} to {Math.min(data.meta.current_page * data.meta.per_page, data.meta.total)} of {data.meta.total} entries
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-slate-600">
                                    Page {data.meta.current_page} of {data.meta.last_page}
                                </span>
                                <button
                                    onClick={() => setPage(Math.min(data.meta.last_page, page + 1))}
                                    disabled={page === data.meta.last_page}
                                    className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Dialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete Delivery Receipt"
                description={`Are you sure you want to delete Delivery Receipt ${drToDelete?.DRNumber}? This action cannot be undone.`}
                onConfirm={confirmDelete}
                confirmText="Delete"
                loading={deleteMutation.isPending}
            />
        </div>
    );
}