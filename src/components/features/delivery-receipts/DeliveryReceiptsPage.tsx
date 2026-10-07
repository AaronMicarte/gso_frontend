'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
    CheckCircle,
    PackagePlus,
    ClipboardCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import { ViewDRPage } from './ViewDRPage';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';
import { useAuth } from '@/lib/hooks/useAuth';
import issuanceAPI from '@/lib/api/issuance';

interface DeliveryReceiptsPageProps {
    baseRoute: string;
    canDelete?: boolean;
}

const workflowBadgeStyles: Record<string, string> = {
    to_be_issued: 'bg-indigo-100 text-indigo-800',
    issued: 'bg-emerald-100 text-emerald-800',
    acknowledged: 'bg-emerald-100 text-emerald-800',
    partially_acknowledged: 'bg-amber-100 text-amber-800',
    partial: 'bg-amber-100 text-amber-800',
};

function getDrStatusDisplay(dr: { workflow_status?: string; workflow_status_label?: string | null; is_partial?: boolean; IsPartial?: boolean; FinalizedAt?: string | null }) {
    const isPartial = Boolean(dr.is_partial ?? dr.IsPartial ?? false) && !dr.FinalizedAt;
    const workflowStatus = dr.workflow_status || 'to_be_issued';

    if (isPartial) {
        return {
            label: dr.workflow_status_label || (workflowStatus === 'partially_acknowledged' || workflowStatus === 'acknowledged' ? 'Partial / Issued' : 'Partial / For Issuance'),
            badgeClass: workflowBadgeStyles.partial,
        };
    }

    const workflowLabels: Record<string, string> = {
        to_be_issued: 'For Issuance',
        issued: 'Issued',
        acknowledged: 'Issued',
        partially_acknowledged: 'Issued',
    };

    return {
        label: dr.workflow_status_label && !dr.workflow_status_label.startsWith('Partial')
            ? dr.workflow_status_label
            : (workflowLabels[workflowStatus] || 'For Issuance'),
        badgeClass: workflowBadgeStyles[workflowStatus === 'partially_acknowledged' ? 'acknowledged' : workflowStatus] || workflowBadgeStyles.to_be_issued,
    };
}

export function DeliveryReceiptsPage({ baseRoute, canDelete = false }: DeliveryReceiptsPageProps) {
    const searchParams = useSearchParams();
    const initialQuery = (searchParams.get('query') || searchParams.get('dr') || '').trim();

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState(initialQuery);
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
    const [statusFilter, setStatusFilter] = useState<'all' | 'to_be_issued' | 'acknowledged'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [selectedDrId, setSelectedDrId] = useState<number | null>(null);

    // Acknowledge confirm dialog state
    const [ackConfirmOpen, setAckConfirmOpen] = useState(false);
    const [pendingAckRow, setPendingAckRow] = useState<{
        DRID: number;
        DRNumber: string;
        IARNumber?: string | null;
    } | null>(null);
    const [officialDrNumber, setOfficialDrNumber] = useState('');
    const [ackError, setAckError] = useState<string | null>(null);
    const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

    const { user } = useAuth();
    const canEdit = !user || user?.UserRoleID === 1 || user?.UserRoleID === 2 || user?.UserRoleID === 6 || baseRoute === '/admin' || baseRoute === '/staff';
    const deleteMutation = useDeleteDeliveryReceipt();
    const { showConfirmDialog, ConfirmDialog } = useConfirmDialog();

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [search]);

    const { data, isLoading, isFetching, refetch } = useDeliveryReceipts({
        page,
        per_page: 10,
        ...(debouncedSearch ? { query: debouncedSearch } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(startDate ? { start_date: startDate } : {}),
        ...(endDate ? { end_date: endDate } : {}),
    });

    const tableRows = data?.data || [];

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

    const openAckConfirm = (row: { DRID: number; DRNumber: string; IARNumber?: string | null }) => {
        setPendingAckRow(row);
        setOfficialDrNumber('');
        setAckError(null);
        setAckConfirmOpen(true);
    };

    const confirmAcknowledge = async () => {
        if (!pendingAckRow) return;
        const row = pendingAckRow;
        const isTemp = /temp/i.test(row.DRNumber);

        if (isTemp) {
            const trimmed = officialDrNumber.trim();
            if (!trimmed) {
                setAckError('Official DR number is required.');
                return;
            }
            if (/temp/i.test(trimmed)) {
                setAckError('Official DR number cannot be a temporary name.');
                return;
            }
        }

        try {
            setAcknowledgingId(row.DRID);
            await issuanceAPI.acknowledgeInspection({
                dr_id: row.DRID,
                ...(isTemp && officialDrNumber.trim() ? { dr_number: officialDrNumber.trim() } : {})
            });
            toast.success('Delivery receipt acknowledged');
            await refetch();
            setAckConfirmOpen(false);
            setPendingAckRow(null);
            setOfficialDrNumber('');
        } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
            const resp = maybeAxios?.response?.data;
            const message = resp?.errors?.dr_number?.[0] || resp?.message;
            if (isTemp && resp?.errors?.dr_number) {
                setAckError(resp.errors.dr_number[0]);
            }
            toast.error(message || 'Failed to acknowledge delivery receipt');
        } finally {
            setAcknowledgingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
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
                            disabled={isFetching}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
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
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') setPage(1); }}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value as 'all' | 'to_be_issued' | 'acknowledged'); setPage(1); }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            title="Status"
                        >
                            <option value="all">All issuance statuses</option>
                            <option value="to_be_issued">For Issuance</option>
                            <option value="acknowledged">Issued</option>
                        </select>
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
                                    <th className="px-6 py-4">DR Number</th>
                                    <th className="px-6 py-4">IAR Number</th>
                                    <th className="px-6 py-4">PO Reference</th>
                                    <th className="px-6 py-4">Supplier</th>
                                    <th className="px-6 py-4">Date Received</th>
                                    <th className="px-6 py-4">Received By</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {isLoading ? (
                                    <TableSkeletonRows columns={8} rows={10} />
                                ) : tableRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No delivery receipts found
                                        </td>
                                    </tr>
                                ) : (
                                    tableRows.map((dr) => {
                                        const inspectionOk = (dr.inspection_status || dr.InspectionStatus) === 'inspected';
                                        const isPartialRow = Boolean(dr.is_partial ?? dr.IsPartial) && !dr.FinalizedAt;
                                        const workflowStatus = dr.workflow_status || '';
                                        const alreadyAcknowledged = workflowStatus === 'acknowledged' || workflowStatus === 'partially_acknowledged';
                                        const canAcknowledge =
                                            inspectionOk &&
                                            !alreadyAcknowledged &&
                                            !isPartialRow &&
                                            acknowledgingId !== dr.DRID;

                                        return (
                                            <tr key={dr.DRID} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 font-medium text-slate-900">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{dr.DRNumber}</span>
                                                        {/temp/i.test(dr.DRNumber) && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                                                TEMP
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {dr.IARNumber ? (
                                                        <span className="font-mono text-sm">{dr.IARNumber}</span>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-xs">Pending</span>
                                                    )}
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
                                                        const { label, badgeClass } = getDrStatusDisplay(dr);
                                                        return (
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                                                                <CheckCircle className="w-3 h-3" />
                                                                {label}
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
                                                        {canEdit && !alreadyAcknowledged && (
                                                            <Link
                                                                href={`${baseRoute}/delivery-receipts/${dr.DRID}/edit`}
                                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Link>
                                                        )}
                                                        {(dr.is_partial ?? dr.IsPartial) && (
                                                            <Link
                                                                href={`${baseRoute}/delivery-receipts/${dr.DRID}/add-items`}
                                                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                title="Add Items"
                                                            >
                                                                <PackagePlus className="w-4 h-4" />
                                                            </Link>
                                                        )}
                                                        {canAcknowledge && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openAckConfirm({ DRID: dr.DRID, DRNumber: dr.DRNumber, IARNumber: dr.IARNumber })}
                                                                disabled={acknowledgingId === dr.DRID}
                                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title={acknowledgingId === dr.DRID ? 'Acknowledging...' : 'Acknowledge'}
                                                            >
                                                                <ClipboardCheck className="w-4 h-4" />
                                                            </button>
                                                        )}
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
                                        disabled={page === 1 || isFetching}
                                        className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-slate-600">
                                        Page {data.meta.current_page} of {data.meta.last_page}
                                    </span>
                                    <button
                                        onClick={() => setPage(Math.min(data.meta.last_page, page + 1))}
                                        disabled={page === data.meta.last_page || isFetching}
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

            {/* DR View Modal */}
            <DialogPrimitive.Root open={isViewOpen} onOpenChange={handleOpenChange}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 z-40" />
                    <DialogPrimitive.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
                        <DialogPrimitive.Title className="sr-only">Delivery Receipt Details</DialogPrimitive.Title>
                        {selectedDrId ? (
                            <ViewDRPage
                                baseRoute={baseRoute}
                                drId={selectedDrId}
                                initialData={tableRows.find((r) => r.DRID === selectedDrId) ?? null}
                                isModal
                                onClose={() => handleOpenChange(false)}
                            />
                        ) : null}
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>

            {/* Acknowledge confirm modal */}
            <DialogPrimitive.Root open={ackConfirmOpen} onOpenChange={setAckConfirmOpen}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 z-40" />
                    <DialogPrimitive.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-white rounded-xl shadow-xl p-6">
                        <DialogPrimitive.Title className="text-lg font-semibold text-slate-900">
                            Confirm Acknowledgment
                        </DialogPrimitive.Title>
                        <DialogPrimitive.Description className="mt-2 text-sm text-slate-600">
                            Are you sure you want to acknowledge this IAR? Make sure the item is signed on paper by the department head or end user.
                        </DialogPrimitive.Description>

                        {pendingAckRow && (
                            <div className="mt-3 text-sm text-slate-700 space-y-0.5">
                                <div>
                                    DR: <span className="font-medium">{pendingAckRow.DRNumber}</span>
                                    {/temp/i.test(pendingAckRow.DRNumber) && (
                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                            TEMPORARY
                                        </span>
                                    )}
                                </div>
                                {pendingAckRow.IARNumber && <div>IAR: <span className="font-medium">{pendingAckRow.IARNumber}</span></div>}
                            </div>
                        )}

                        {pendingAckRow && /temp/i.test(pendingAckRow.DRNumber) && (
                            <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200 rounded-lg space-y-2">
                                <label className="block text-xs font-semibold text-slate-800">
                                    Official DR Number <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-amber-800">
                                    This receipt currently uses a temporary DR name. Please provide the official DR number to proceed with acknowledgment:
                                </p>
                                <input
                                    type="text"
                                    value={officialDrNumber}
                                    onChange={(e) => {
                                        setOfficialDrNumber(e.target.value);
                                        if (ackError) setAckError(null);
                                    }}
                                    placeholder="Enter official DR number"
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                                    autoFocus
                                />
                                {ackError && (
                                    <p className="text-xs text-red-600 font-medium">{ackError}</p>
                                )}
                            </div>
                        )}

                        <div className="mt-6 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setAckConfirmOpen(false); setPendingAckRow(null); setOfficialDrNumber(''); setAckError(null); }}
                                disabled={acknowledgingId !== null}
                                className="px-4 py-2 text-sm border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmAcknowledge}
                                disabled={acknowledgingId !== null || Boolean(pendingAckRow && /temp/i.test(pendingAckRow.DRNumber) && !officialDrNumber.trim())}
                                className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] disabled:opacity-50"
                            >
                                {acknowledgingId ? 'Processing...' : 'Yes, Acknowledge'}
                            </button>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                            This will also generate a RIS number for the delivery receipt and mark it as acknowledged.
                        </div>
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </div>
    );
}