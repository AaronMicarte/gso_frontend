'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Clock, FileText, Printer, XCircle } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

import transferAPI from '@/lib/api/transfer';
import { PropertyTransfer, TransferStatus } from '@/types/propertyTransfer';
import { useAuth } from '@/lib/hooks/useAuth';

const statusConfig: Record<TransferStatus, { label: string; className: string; icon: typeof Clock }> = {
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
    approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800', icon: XCircle },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-800', icon: CheckCircle },
    cancelled: { label: 'Cancelled', className: 'bg-slate-200 text-slate-700', icon: XCircle },
};

interface TransferDetailPageProps {
    baseRoute: string;
}

export function TransferDetailPage({ baseRoute }: TransferDetailPageProps) {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [transfer, setTransfer] = useState<PropertyTransfer | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectNotes, setRejectNotes] = useState('');
    const [completeNotes, setCompleteNotes] = useState('');
    const [borrowerSignedAt, setBorrowerSignedAt] = useState('');
    const [borrowingSignedAt, setBorrowingSignedAt] = useState('');
    const [rejectOpen, setRejectOpen] = useState(false);
    const [completeOpen, setCompleteOpen] = useState(false);

    const transferId = params?.id ? parseInt(params.id as string) : null;

    const canApprove = user?.UserRoleID === 1 || user?.UserRoleID === 2;

    const loadTransfer = useCallback(async () => {
        if (!transferId) return;
        try {
            setLoading(true);
            const data = await transferAPI.getById(transferId);
            setTransfer(data);
        } catch {
            toast.error('Failed to load transfer details');
            router.push(baseRoute);
        } finally {
            setLoading(false);
        }
    }, [transferId, router, baseRoute]);

    useEffect(() => {
        loadTransfer();
    }, [loadTransfer]);

    useEffect(() => {
        if (!transfer) return;
        const formatDate = (dateValue?: string | null) => {
            if (!dateValue) return '';
            return format(toZonedTime(new Date(dateValue), 'Asia/Manila'), 'yyyy-MM-dd');
        };
        setBorrowerSignedAt(formatDate(transfer.BorrowerSignedAt) || '');
        setBorrowingSignedAt(formatDate(transfer.BorrowingSignedAt) || '');
    }, [transfer]);

    const handleApprove = async () => {
        if (!transfer) return;
        try {
            setIsProcessing(true);
            await transferAPI.approve(transfer.TransferID);
            toast.success('Transfer approved. PTR is ready to print.');
            await loadTransfer();
        } catch {
            toast.error('Failed to approve transfer');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!transfer) return;
        try {
            setIsProcessing(true);
            await transferAPI.reject(transfer.TransferID, { notes: rejectNotes.trim() || null });
            toast.success('Transfer rejected');
            setRejectOpen(false);
            await loadTransfer();
        } catch {
            toast.error('Failed to reject transfer');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleComplete = async () => {
        if (!transfer) return;
        try {
            setIsProcessing(true);
            await transferAPI.complete(transfer.TransferID, {
                borrower_signed_at: borrowerSignedAt || null,
                borrowing_signed_at: borrowingSignedAt || null,
                notes: completeNotes.trim() || null,
            });
            toast.success('Transfer completed and inventory updated');
            setCompleteOpen(false);
            await loadTransfer();
        } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { message?: string } } };
            const message = maybeAxios?.response?.data?.message;
            toast.error(message || 'Failed to complete transfer');
        } finally {
            setIsProcessing(false);
        }
    };

    const canPrint = transfer?.Status === 'approved' || transfer?.Status === 'completed';

    const formatDisplayDate = (dateValue?: string | null) => {
        if (!dateValue) return '';
        return format(toZonedTime(new Date(dateValue), 'Asia/Manila'), 'MMM dd, yyyy');
    };

    const displayText = (value: string | null | undefined, missingLabel: string) => {
        const text = value?.trim();
        return text && text.length > 0 ? text : missingLabel;
    };

    const approvalDisplay = () => {
        if (!transfer) return '';
        if (transfer.Status === 'pending') return 'Pending approval';
        if (transfer.Status === 'rejected') {
            return formatDisplayDate(transfer.ApprovedAt) || 'Rejected (approval date missing)';
        }
        return formatDisplayDate(transfer.ApprovedAt) || 'Approved (date missing)';
    };

    const borrowerSignedDisplay = () => {
        if (!transfer) return '';
        if (transfer.Status === 'pending') return 'Awaiting approval';
        if (transfer.Status === 'rejected') return 'Not applicable';
        return formatDisplayDate(transfer.BorrowerSignedAt) || 'Pending releasing signature';
    };

    const borrowingSignedDisplay = () => {
        if (!transfer) return '';
        if (transfer.Status === 'pending') return 'Awaiting approval';
        if (transfer.Status === 'rejected') return 'Not applicable';
        return formatDisplayDate(transfer.BorrowingSignedAt) || 'Pending receiving signature';
    };

    const completedDisplay = () => {
        if (!transfer) return '';
        if (transfer.Status === 'completed') {
            return formatDisplayDate(transfer.CompletedAt) || 'Completed (date missing)';
        }
        if (transfer.Status === 'approved') return 'Awaiting completion';
        if (transfer.Status === 'rejected') return 'Not applicable';
        return 'Pending approval';
    };

    const statusBadge = useMemo(() => {
        if (!transfer) return null;
        const status = transfer.Status;
        const config = statusConfig[status];
        const Icon = config.icon;
        return (
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${config.className}`}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
            </span>
        );
    }, [transfer]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                    <span className="ml-3 text-gray-600">Loading transfer...</span>
                </div>
            </div>
        );
    }

    if (!transfer) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Transfer not found</div>
                    <div className="text-sm text-slate-600 mt-1">The request could not be loaded.</div>
                    <div className="mt-4">
                        <Link href={baseRoute} className="text-sm text-[var(--primary)] underline">
                            Back to transfers
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <Link href={baseRoute} className="text-sm text-[var(--primary)] underline">
                            Back to transfers
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900 mt-2">{transfer.TransferNumber}</h1>
                        <div className="mt-2">{statusBadge}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {canPrint && (
                            <button
                                onClick={() => router.push(`${baseRoute}/${transfer.TransferID}/print`)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                            >
                                <Printer className="w-4 h-4" />
                                Print PTR
                            </button>
                        )}
                        {canApprove && transfer.Status === 'pending' && (
                            <button
                                onClick={handleApprove}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Approve
                            </button>
                        )}
                        {canApprove && transfer.Status === 'pending' && (
                            <Dialog.Root open={rejectOpen} onOpenChange={setRejectOpen}>
                                <Dialog.Trigger asChild>
                                    <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                    </button>
                                </Dialog.Trigger>
                                <Dialog.Portal>
                                    <Dialog.Overlay className="fixed inset-0 bg-black/50" />
                                    <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
                                        <Dialog.Title className="text-lg font-semibold text-slate-900">Reject Transfer</Dialog.Title>
                                        <Dialog.Description className="text-sm text-slate-500 mt-1">
                                            Add notes for the requesting department (optional).
                                        </Dialog.Description>
                                        <textarea
                                            value={rejectNotes}
                                            onChange={(event) => setRejectNotes(event.target.value)}
                                            rows={3}
                                            className="mt-4 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                        />
                                        <div className="mt-6 flex justify-end gap-2">
                                            <Dialog.Close asChild>
                                                <button className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
                                            </Dialog.Close>
                                            <button
                                                onClick={handleReject}
                                                disabled={isProcessing}
                                                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                            >
                                                Confirm Reject
                                            </button>
                                        </div>
                                    </Dialog.Content>
                                </Dialog.Portal>
                            </Dialog.Root>
                        )}
                        {canApprove && transfer.Status === 'approved' && (
                            <Dialog.Root open={completeOpen} onOpenChange={setCompleteOpen}>
                                <Dialog.Trigger asChild>
                                    <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                                        <FileText className="w-4 h-4" />
                                        Mark Completed
                                    </button>
                                </Dialog.Trigger>
                                <Dialog.Portal>
                                    <Dialog.Overlay className="fixed inset-0 bg-black/50" />
                                    <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
                                        <Dialog.Title className="text-lg font-semibold text-slate-900">Complete Transfer</Dialog.Title>
                                        <Dialog.Description className="text-sm text-slate-500 mt-1">
                                            Confirm the paper signatures and update inventory ownership.
                                        </Dialog.Description>

                                        <div className="grid gap-4 mt-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-700">Borrower Signed Date</label>
                                                <input
                                                    type="date"
                                                    value={borrowerSignedAt}
                                                    onChange={(event) => setBorrowerSignedAt(event.target.value)}
                                                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-700">Borrowing Signed Date</label>
                                                <input
                                                    type="date"
                                                    value={borrowingSignedAt}
                                                    onChange={(event) => setBorrowingSignedAt(event.target.value)}
                                                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-700">GSO Notes (optional)</label>
                                                <textarea
                                                    value={completeNotes}
                                                    onChange={(event) => setCompleteNotes(event.target.value)}
                                                    rows={3}
                                                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-6 flex justify-end gap-2">
                                            <Dialog.Close asChild>
                                                <button className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
                                            </Dialog.Close>
                                            <button
                                                onClick={handleComplete}
                                                disabled={isProcessing}
                                                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                Confirm Completion
                                            </button>
                                        </div>
                                    </Dialog.Content>
                                </Dialog.Portal>
                            </Dialog.Root>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <div className="text-xs text-slate-500 uppercase">Releasing Custodian</div>
                                <div className="text-sm font-semibold text-slate-900">
                                    {displayText(transfer.fromEndUser?.FullName, 'Missing releasing custodian')}
                                    {transfer.fromEndUser?.DepartmentName
                                        ? ` - ${transfer.fromEndUser.DepartmentName}`
                                        : (transfer.fromDepartment?.DepartmentName ? ` - ${transfer.fromDepartment.DepartmentName}` : '')}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 uppercase">Receiving Custodian</div>
                                <div className="text-sm font-semibold text-slate-900">
                                    {displayText(transfer.toEndUser?.FullName, 'Missing receiving custodian')}
                                    {transfer.toEndUser?.DepartmentName
                                        ? ` - ${transfer.toEndUser.DepartmentName}`
                                        : (transfer.toDepartment?.DepartmentName ? ` - ${transfer.toDepartment.DepartmentName}` : '')}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 uppercase">Requested By</div>
                                <div className="text-sm font-semibold text-slate-900">
                                    {displayText(transfer.requestedBy?.FullName, 'Missing requester')}
                                    {transfer.requestedBy?.department?.DepartmentName
                                        ? ` - ${transfer.requestedBy.department.DepartmentName}`
                                        : ''}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 uppercase">Request Date</div>
                                <div className="text-sm font-semibold text-slate-900">
                                    {formatDisplayDate(transfer.created_at) || 'Missing request date'}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-slate-500 uppercase">Reason</div>
                            <div className="text-sm text-slate-700">
                                {displayText(transfer.Reason, 'Reason not recorded')}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="text-sm font-semibold text-slate-900">Approval & Signing</div>
                        <div className="text-xs text-slate-500">Approved At</div>
                        <div className="text-sm text-slate-800">{approvalDisplay()}</div>
                        <div className="text-xs text-slate-500">Releasing Signed</div>
                        <div className="text-sm text-slate-800">{borrowerSignedDisplay()}</div>
                        <div className="text-xs text-slate-500">Receiving Signed</div>
                        <div className="text-sm text-slate-800">{borrowingSignedDisplay()}</div>
                        <div className="text-xs text-slate-500">Completed At</div>
                        <div className="text-sm text-slate-800">{completedDisplay()}</div>
                        {transfer.GsoNotes && (
                            <div className="text-xs text-slate-500">Notes</div>
                        )}
                        {transfer.GsoNotes && (
                            <div className="text-sm text-slate-700">{transfer.GsoNotes}</div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Transferred Items</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Property #</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Serial</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Unit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {(transfer.items || []).map((item) => (
                                    <tr key={item.TransferItemID}>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {displayText(item.inventoryDetail?.PropertyNumber, 'Missing property number')}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {displayText(item.inventoryDetail?.Description, 'Missing description')}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {displayText(item.inventoryDetail?.SerialNumber, 'Missing serial')}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {displayText(item.inventoryDetail?.unitOfMeasure?.UnitName, 'Missing unit')}
                                        </td>
                                    </tr>
                                ))}
                                {(!transfer.items || transfer.items.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                                            No items recorded for this transfer.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
