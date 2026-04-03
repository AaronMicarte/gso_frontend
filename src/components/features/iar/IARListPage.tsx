'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useIARs, useDeleteIAR } from '@/lib/hooks/useIAR';
import {
    ClipboardCheck,
    Search,
    Eye,
    Package,
    CheckCircle,
    Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { toast } from 'sonner';
import { ViewIARPage } from './ViewIARPage';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';

interface IARListPageProps {
    baseRoute: string;
    canDelete?: boolean;
}

export function IARListPage({ baseRoute, canDelete = false }: IARListPageProps) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [searchBy, setSearchBy] = useState<'iar' | 'dr'>('iar');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [selectedIarId, setSelectedIarId] = useState<number | null>(null);
    const deleteMutation = useDeleteIAR();
    const { showConfirmDialog, ConfirmDialog } = useConfirmDialog();

    const handleDelete = (id: number, iarNumber: string) => {
        showConfirmDialog({
            title: 'Delete IAR',
            description: `Are you sure you want to delete IAR ${iarNumber}? This action cannot be undone.`,
            confirmText: 'Delete',
            onConfirm: async () => {
                await deleteMutation.mutateAsync(id);
                toast.success('IAR deleted successfully');
            },
        });
    };

    const handleOpenChange = (open: boolean) => {
        setIsViewOpen(open);
        if (!open) {
            setSelectedIarId(null);
        }
    };

    const handleView = (id: number) => {
        setSelectedIarId(id);
        setIsViewOpen(true);
    };

    const { data, isLoading } = useIARs({
        page,
        per_page: 10,
        ...(search ? (searchBy === 'iar' ? { iar_number: search } : { dr_number: search }) : {}),
        ...(startDate ? { start_date: startDate } : {}),
        ...(endDate ? { end_date: endDate } : {}),
    });

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                <ConfirmDialog />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Inspection & Acceptance Reports</h1>
                        <p className="text-slate-500 text-sm">View inspection and acceptance reports for delivered items</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search IAR Number or DR Number..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') setPage(1); }}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-56">
                        <select
                            value={searchBy}
                            onChange={(e) => { setSearchBy(e.target.value as 'iar' | 'dr'); setPage(1); }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            title="Search by"
                        >
                            <option value="iar">IAR Number</option>
                            <option value="dr">DR Number</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            title="Start date"
                        />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            title="End date"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">IAR Number</th>
                                    <th className="px-6 py-4">DR Reference</th>
                                    <th className="px-6 py-4">Supplier</th>
                                    <th className="px-6 py-4">Date Inspected</th>
                                    <th className="px-6 py-4">Inspected By</th>
                                    <th className="px-6 py-4">Accepted By</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {isLoading ? (
                                    <TableSkeletonRows columns={8} rows={10} />
                                ) : data?.data?.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No inspection reports found
                                        </td>
                                    </tr>
                                ) : (
                                    data?.data?.map((iar) => (
                                        <tr key={iar.IARID} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {iar.IARNumber}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {iar.deliveryReceipt?.DRNumber || (iar.DRID ? `DR ID: ${iar.DRID}` : 'Not linked')}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {iar.deliveryReceipt?.SupplierName || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {format(toZonedTime(new Date(iar.DateInspected), 'Asia/Manila'), 'MMM dd, yyyy')}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {iar.inspectedByUser?.FullName || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {iar.acceptedByUser?.FullName || 'Pending'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {iar.DateAccepted ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Accepted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                                        <ClipboardCheck className="w-3 h-3" />
                                                        Inspected
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleView(iar.IARID)}
                                                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => handleDelete(iar.IARID, iar.IARNumber)}
                                                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
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
            </div>

            <DialogPrimitive.Root open={isViewOpen} onOpenChange={handleOpenChange}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 z-40" />
                    <DialogPrimitive.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
                        <DialogPrimitive.Title className="sr-only">Inspection and Acceptance Report Details</DialogPrimitive.Title>
                        {selectedIarId ? (
                            <ViewIARPage
                                baseRoute={baseRoute}
                                iarId={selectedIarId}
                                isModal
                                onClose={() => handleOpenChange(false)}
                            />
                        ) : null}
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </div>
    );
}