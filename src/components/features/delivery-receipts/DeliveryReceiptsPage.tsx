'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useDeliveryReceipts, useDeleteDeliveryReceipt } from '@/lib/hooks/useDeliveryReceipts';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import {
    Search,
    Plus,
    Eye,
    Edit,
    Trash2,
    Package,
    RefreshCw,
    CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import { ViewDRPage } from './ViewDRPage';

interface DeliveryReceiptsPageProps {
    baseRoute: string;
    canDelete?: boolean;
}

const workflowBadgeStyles: Record<string, string> = {
    pending_inspection: 'bg-amber-100 text-amber-800',
    to_be_accepted: 'bg-blue-100 text-blue-800',
    to_be_issued: 'bg-indigo-100 text-indigo-800',
    issued: 'bg-emerald-100 text-emerald-800',
    acknowledged: 'bg-green-100 text-green-800',
};

export function DeliveryReceiptsPage({ baseRoute, canDelete = false }: DeliveryReceiptsPageProps) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [selectedDrId, setSelectedDrId] = useState<number | null>(null);
    const deleteMutation = useDeleteDeliveryReceipt();
    const { showConfirmDialog, ConfirmDialog } = useConfirmDialog();

    // Assuming useDeliveryReceipts accepts these params
    const { data, isLoading, refetch } = useDeliveryReceipts({
        page,
        per_page: 10,
        // We might need to implement search in the hook/API if not present
        // For now, we'll just pass page/per_page
    });

    const handleRefresh = () => {
        refetch();
        toast.success('Delivery receipts refreshed');
    };

    const handleDelete = (id: number, drNumber: string) => {
        showConfirmDialog({
            title: 'Delete Delivery Receipt',
            description: `Are you sure you want to delete Delivery Receipt ${drNumber}? This action cannot be undone.`,
            confirmText: 'Delete',
            onConfirm: async () => {
                await deleteMutation.mutateAsync(id);
                toast.success('Delivery Receipt deleted successfully');
            },
        });
    };

    const handleOpenChange = (open: boolean) => {
        setIsViewOpen(open);
        if (!open) {
            setSelectedDrId(null);
        }
    };

    const handleView = (id: number) => {
        setSelectedDrId(id);
        setIsViewOpen(true);
    };

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <ConfirmDialog />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Delivery Receipts</h1>
                        <p className="text-slate-500 text-sm">Manage delivery receipts and incoming items</p>
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
                            href={`${baseRoute}/delivery-receipts/new`}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Delivery Receipt
                        </Link>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search DR Number, PO Number, or Supplier..."
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
                                    <th className="px-6 py-4">PO Reference</th>
                                    <th className="px-6 py-4">Supplier</th>
                                    <th className="px-6 py-4">Date Received</th>
                                    <th className="px-6 py-4">Received By</th>
                                    <th className="px-6 py-4">Inspection Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
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
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No delivery receipts found
                                        </td>
                                    </tr>
                                ) : (
                                    data?.data?.map((dr) => (
                                        <tr key={dr.DRID} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {dr.DRNumber}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {dr.PONumber || <span className="text-slate-400 italic">None</span>}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {dr.SupplierName}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {format(toZonedTime(new Date(dr.DateReceived), 'Asia/Manila'), 'MMM dd, yyyy')}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {dr.receivedByUser?.FullName || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {(() => {
                                                    const fallbackStatus = (dr.inspection_status || dr.InspectionStatus) === 'inspected'
                                                        ? 'to_be_accepted'
                                                        : 'pending_inspection';
                                                    const workflowStatus = dr.workflow_status || fallbackStatus;
                                                    const workflowLabel = dr.workflow_status_label
                                                        || (workflowStatus === 'to_be_accepted' ? 'To be accepted' : 'Pending inspection');
                                                    const badgeClass = workflowBadgeStyles[workflowStatus] || workflowBadgeStyles.pending_inspection;
                                                    const showCheck = workflowStatus !== 'pending_inspection';

                                                    return (
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                                                            {showCheck && <CheckCircle className="w-3 h-3" />}
                                                            {workflowLabel}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleView(dr.DRID)}
                                                        className="p-2 text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {(dr.inspection_status || dr.InspectionStatus) !== 'inspected' && (
                                                        <>
                                                            <Link
                                                                href={`${baseRoute}/delivery-receipts/${dr.DRID}/edit`}
                                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Link>
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDelete(dr.DRID, dr.DRNumber)}
                                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination - Simplified for now */}
                    {data?.meta && data.meta.last_page > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">
                                Page {data.meta.current_page} of {data.meta.last_page}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(data.meta.last_page, p + 1))}
                                disabled={page === data.meta.last_page}
                                className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <DialogPrimitive.Root open={isViewOpen} onOpenChange={handleOpenChange}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 z-40" />
                    <DialogPrimitive.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
                        <DialogPrimitive.Title className="sr-only">Delivery Receipt Details</DialogPrimitive.Title>
                        {selectedDrId ? (
                            <ViewDRPage
                                baseRoute={baseRoute}
                                drId={selectedDrId}
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
