'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Clock, FileText, Printer, XCircle } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import { Dialog as ConfirmDialog } from '@/components/ui/Dialog';

import transferAPI from '@/lib/api/transfer';
import { PropertyTransfer, ReleasingDecision, TransferStatus } from '@/types/propertyTransfer';
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

type PendingConfirmAction = 'approve' | null;

function displaySafeText(value: string | null | undefined, fallback: string) {
    const text = value?.trim();
    return text && text.length > 0 ? text : fallback;
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
    const [rejectOpen, setRejectOpen] = useState(false);
    const [completeOpen, setCompleteOpen] = useState(false);
    const [releasingReviewOpen, setReleasingReviewOpen] = useState(false);
    const [releasingDecision, setReleasingDecision] = useState<'approved' | 'rejected'>('approved');
    const [releasingProvidedByGroup, setReleasingProvidedByGroup] = useState<Record<string, number>>({});
    const [releasingReason, setReleasingReason] = useState('');
    const [pendingConfirmAction, setPendingConfirmAction] = useState<PendingConfirmAction>(null);

    const transferId = params?.id ? parseInt(params.id as string) : null;

    const isPrivilegedUser = user?.UserRoleID === 1 || user?.UserRoleID === 2;
    const isDepartmentHead = user?.UserRoleID === 4 && !isPrivilegedUser;
    const canApprove = isPrivilegedUser && transfer?.Status === 'pending';
    const canReleasingReview = user?.UserRoleID === 4
        && transfer?.Status === 'approved'
        && (transfer?.ReleasingDecision ?? 'pending') === 'pending'
        && Number(user?.DepartmentID ?? 0) === Number(transfer?.FromDepartmentID ?? 0);
    const canCompleteTransfer = isPrivilegedUser
        && transfer?.Status === 'approved'
        && transfer?.ReleasingDecision === 'approved';
    const isReleasingDepartmentViewer = user?.UserRoleID === 4
        && !isPrivilegedUser
        && Number(user?.DepartmentID ?? 0) === Number(transfer?.FromDepartmentID ?? 0);

    const canPrint = (transfer?.Status === 'approved' || transfer?.Status === 'completed') && !isDepartmentHead;

    const groupedRequestedItems = useMemo(() => {
        const groups = new Map<string, {
            key: string;
            label: string;
            requestedQty: number;
            itemIds: number[];
            itemById: Record<number, { requestedQty: number }>;
        }>();

        for (const item of transfer?.items ?? []) {
            const itemId = item.TransferItemID;
            const requestedQty = Number(item.Quantity ?? 1);
            const description = displaySafeText(item.inventoryDetail?.Description, 'Unspecified item');
            const unit = displaySafeText(item.inventoryDetail?.unitOfMeasure?.UnitName, 'unit');
            const groupKey = `${description}||${unit}`;

            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    key: groupKey,
                    label: `${description} (${unit})`,
                    requestedQty: 0,
                    itemIds: [],
                    itemById: {},
                });
            }

            const existing = groups.get(groupKey)!;
            existing.requestedQty += requestedQty;
            existing.itemIds.push(itemId);
            existing.itemById[itemId] = { requestedQty };
        }

        return Array.from(groups.values());
    }, [transfer?.items]);

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
        const groupedDefaults: Record<string, number> = {};
        const groups = new Map<string, number>();
        for (const item of transfer.items ?? []) {
            const description = displaySafeText(item.inventoryDetail?.Description, 'Unspecified item');
            const unit = displaySafeText(item.inventoryDetail?.unitOfMeasure?.UnitName, 'unit');
            const key = `${description}||${unit}`;
            groups.set(key, (groups.get(key) ?? 0) + Number(item.Quantity ?? 1));
        }
        groups.forEach((qty, key) => {
            groupedDefaults[key] = qty;
        });
        setReleasingProvidedByGroup(groupedDefaults);
        setReleasingDecision('approved');
        setReleasingReason(transfer.ReleasingDecisionReason ?? '');
    }, [transfer]);

    const handleApprove = async () => {
        if (!transfer) return;
        try {
            setIsProcessing(true);
            await transferAPI.approve(transfer.TransferID);
            toast.success('Transfer approved by GSO. Releasing custody can now review.');
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

    const handleReleasingReview = async () => {
        if (!transfer) return;

        const requestedCount = groupedRequestedItems.reduce((sum, group) => sum + group.requestedQty, 0);
        let approvedCount = 0;

        const approvedQuantities: Record<number, number> = {};

        for (const group of groupedRequestedItems) {
            const providedQtyRaw = Number(releasingProvidedByGroup[group.key] ?? group.requestedQty);
            const providedQty = Number.isFinite(providedQtyRaw) ? providedQtyRaw : 0;

            if (providedQty < 0) {
                toast.error(`Provided quantity cannot be negative for ${group.label}`);
                return;
            }

            if (providedQty > group.requestedQty) {
                toast.error(`Provided quantity cannot exceed requested quantity for ${group.label}`);
                return;
            }

            let remaining = providedQty;
            for (const itemId of group.itemIds) {
                const itemRequestedQty = group.itemById[itemId].requestedQty;
                const itemApprovedQty = Math.max(0, Math.min(itemRequestedQty, remaining));
                approvedQuantities[itemId] = itemApprovedQty;
                remaining -= itemApprovedQty;
            }

            approvedCount += providedQty;
        }

        if (releasingDecision === 'approved') {
            if (approvedCount > requestedCount) {
                toast.error('Approved quantity cannot exceed requested quantity');
                return;
            }
            if (approvedCount < requestedCount && releasingReason.trim() === '') {
                toast.error('Reason is required when provided quantity is less than requested');
                return;
            }
        }

        if (releasingDecision === 'rejected' && releasingReason.trim() === '') {
            toast.error('Reason is required when rejecting request');
            return;
        }

        try {
            setIsProcessing(true);
            await transferAPI.releasingReview(transfer.TransferID, {
                decision: releasingDecision,
                approved_quantities: releasingDecision === 'approved' ? approvedQuantities : {},
                reason: releasingReason.trim() || null,
            });
            toast.success('Releasing review submitted');
            setReleasingReviewOpen(false);
            await loadTransfer();
        } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { message?: string } } };
            const message = maybeAxios?.response?.data?.message;
            toast.error(message || 'Failed to submit releasing review');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleComplete = async () => {
        if (!transfer) return;

        try {
            setIsProcessing(true);
            await transferAPI.complete(transfer.TransferID, {
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

    const handleConfirmAction = async () => {
        if (!pendingConfirmAction) return;

        if (pendingConfirmAction === 'approve') {
            await handleApprove();
            setPendingConfirmAction(null);
            setPendingConfirmAction(null);
            return;
        }
    };

    const confirmDialogConfig = () => {
        if (pendingConfirmAction === 'approve') {
            return {
                title: 'Confirm GSO Approval',
                description: 'Are you sure you want to approve this transfer as GSO/Admin?',
                confirmText: 'Confirm Approval',
            };
        }

        return {
            title: 'Confirm Action',
            description: 'Proceed with this action?',
            confirmText: 'Confirm',
        };
    };

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
        if (transfer.Status === 'pending') {
            return 'Pending GSO/Admin approval';
        }
        if (transfer.Status === 'rejected') {
            return formatDisplayDate(transfer.ApprovedAt) || 'Rejected (approval date missing)';
        }
        return formatDisplayDate(transfer.ApprovedAt) || 'Approved (date missing)';
    };

    const releasingDecisionLabel = (decision?: ReleasingDecision) => {
        if (decision === 'approved') return 'Approved by releasing custody';
        if (decision === 'rejected') return 'Rejected by releasing custody';
        return 'Pending releasing custody review';
    };

    const releasingDecisionBadgeClass = (decision?: ReleasingDecision) => {
        if (decision === 'approved') return 'bg-emerald-100 text-emerald-700';
        if (decision === 'rejected') return 'bg-rose-100 text-rose-700';
        return 'bg-amber-100 text-amber-700';
    };

    const releasingReviewedAtDisplay = () => {
        if (!transfer?.ReleasingReviewedAt) return 'Pending review';
        return formatDisplayDate(transfer.ReleasingReviewedAt) || 'Pending review';
    };

    const borrowerSignedDisplay = () => {
        if (!transfer) return '';
        if (transfer.Status === 'pending') return 'Awaiting approval';
        if (transfer.Status === 'rejected') return 'Not applicable';
        return formatDisplayDate(transfer.BorrowerSignedAt) || 'Pending GSO releasing confirmation';
    };

    const borrowingSignedDisplay = () => {
        if (!transfer) return '';
        if (transfer.Status === 'pending') return 'Awaiting approval';
        if (transfer.Status === 'rejected') return 'Not applicable';
        if (!transfer.BorrowerSignedAt) return 'Waiting for GSO releasing confirmation';
        return formatDisplayDate(transfer.BorrowingSignedAt) || 'Pending receiving signature';
    };

    const completedDisplay = () => {
        if (!transfer) return '';
        if (transfer.Status === 'completed') {
            return formatDisplayDate(transfer.CompletedAt) || 'Completed (date missing)';
        }
        if (transfer.Status === 'approved' && transfer.ReleasingDecision !== 'approved') return 'Awaiting releasing custody review';
        if (transfer.Status === 'approved') return 'Awaiting final GSO completion';
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
        return null;
    }

    if (!transfer) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Transfer not found</div>
                    <div className="text-sm text-slate-600 mt-1">The request could not be loaded.</div>
                    <div className="mt-4">
                        <Link href={baseRoute} className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Back to transfers</span>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <Link href={baseRoute} className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Back to transfers</span>
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
                        {canReleasingReview && (
                            <Dialog.Root open={releasingReviewOpen} onOpenChange={setReleasingReviewOpen}>
                                <Dialog.Trigger asChild>
                                    <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
                                        <FileText className="w-4 h-4" />
                                        Releasing Review
                                    </button>
                                </Dialog.Trigger>
                                <Dialog.Portal>
                                    <Dialog.Overlay className="fixed inset-0 bg-black/50" />
                                    <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
                                        <Dialog.Title className="text-lg font-semibold text-slate-900">Releasing Custody Review</Dialog.Title>
                                        <Dialog.Description className="text-sm text-slate-500 mt-1">
                                            Enter how many items your department can actually provide per requested item.
                                        </Dialog.Description>

                                        <div className="grid gap-4 mt-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-700">Decision</label>
                                                <select
                                                    value={releasingDecision}
                                                    onChange={(event) => setReleasingDecision(event.target.value as 'approved' | 'rejected')}
                                                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                                >
                                                    <option value="approved">Approve for forwarding to GSO/Admin</option>
                                                    <option value="rejected">Reject request</option>
                                                </select>
                                            </div>

                                            {releasingDecision === 'approved' && (
                                                <div>
                                                    <label className="text-sm font-medium text-slate-700">Provided Quantity Per Requested Item</label>
                                                    <div className="mt-2 border border-slate-200 rounded-lg max-h-72 overflow-auto">
                                                        {groupedRequestedItems.map((group) => (
                                                            <div key={group.key} className="grid grid-cols-12 gap-3 p-3 border-b border-slate-100 last:border-b-0 items-center">
                                                                <div className="col-span-12 md:col-span-7 text-sm text-slate-700">
                                                                    <div className="font-medium">{group.label}</div>
                                                                    <div className="text-xs text-slate-500">Requested: {group.requestedQty}</div>
                                                                </div>
                                                                <div className="col-span-12 md:col-span-5">
                                                                    <label className="text-xs text-slate-500">Can Provide</label>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={group.requestedQty}
                                                                        value={releasingProvidedByGroup[group.key] ?? group.requestedQty}
                                                                        onChange={(event) => {
                                                                            const rawValue = Number(event.target.value || 0);
                                                                            const value = Math.max(0, Math.min(group.requestedQty, rawValue));
                                                                            setReleasingProvidedByGroup((prev) => ({
                                                                                ...prev,
                                                                                [group.key]: value,
                                                                            }));
                                                                        }}
                                                                        onBlur={(event) => {
                                                                            const rawValue = Number(event.target.value || 0);
                                                                            const value = Math.max(0, Math.min(group.requestedQty, rawValue));
                                                                            setReleasingProvidedByGroup((prev) => ({
                                                                                ...prev,
                                                                                [group.key]: value,
                                                                            }));
                                                                        }}
                                                                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                                                    />
                                                                    <p className="mt-1 text-[11px] text-slate-500">
                                                                        Max allowed: {group.requestedQty}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        Requested total: {groupedRequestedItems.reduce((sum, group) => sum + group.requestedQty, 0)} | Provided total: {groupedRequestedItems.reduce((sum, group) => sum + Number(releasingProvidedByGroup[group.key] ?? group.requestedQty), 0)}
                                                    </p>
                                                </div>
                                            )}

                                            <div>
                                                <label className="text-sm font-medium text-slate-700">Reason</label>
                                                <textarea
                                                    value={releasingReason}
                                                    onChange={(event) => setReleasingReason(event.target.value)}
                                                    rows={3}
                                                    placeholder="Required when rejecting or approving less than requested"
                                                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-6 flex justify-end gap-2">
                                            <Dialog.Close asChild>
                                                <button className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
                                            </Dialog.Close>
                                            <button
                                                onClick={handleReleasingReview}
                                                disabled={isProcessing}
                                                className="px-4 py-2 text-sm rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
                                            >
                                                Submit Review
                                            </button>
                                        </div>
                                    </Dialog.Content>
                                </Dialog.Portal>
                            </Dialog.Root>
                        )}

                        {canApprove && (
                            <button
                                onClick={() => setPendingConfirmAction('approve')}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Approve
                            </button>
                        )}
                        {isPrivilegedUser && transfer.Status === 'pending' && (
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
                        {canCompleteTransfer && (
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
                                            Releasing custody has accepted this request. Finalize the transfer and update inventory ownership.
                                        </Dialog.Description>

                                        <div className="grid gap-4 mt-4">
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
                        {isPrivilegedUser && transfer.Status === 'approved' && (transfer.ReleasingDecision ?? 'pending') === 'pending' && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                Waiting for releasing custody review before final GSO action.
                            </div>
                        )}
                        {isPrivilegedUser && transfer.Status === 'approved' && transfer.ReleasingDecision === 'approved' && (
                            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                                Ready for final GSO completion.
                            </div>
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
                            <div>
                                <div className="text-xs text-slate-500 uppercase">Requested Count</div>
                                <div className="text-sm font-semibold text-slate-900">
                                    {transfer.RequestedItemsCount ?? transfer.items?.length ?? 0}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 uppercase">Approved by Releasing</div>
                                <div className="text-sm font-semibold text-slate-900">
                                    {transfer.ReleasingApprovedCount ?? 'Pending'}
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

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="text-sm font-semibold text-slate-900">Workflow Timeline</div>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${releasingDecisionBadgeClass(transfer.ReleasingDecision)}`}>
                                {releasingDecisionLabel(transfer.ReleasingDecision)}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {!isReleasingDepartmentViewer && (
                                <>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase">GSO Approved At</div>
                                        <div className="text-sm font-medium text-slate-800 mt-1">{approvalDisplay()}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase">Releasing Reviewed At</div>
                                        <div className="text-sm font-medium text-slate-800 mt-1">{releasingReviewedAtDisplay()}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase">GSO Finalized At</div>
                                        <div className="text-sm font-medium text-slate-800 mt-1">{completedDisplay()}</div>
                                    </div>
                                </>
                            )}

                            {isReleasingDepartmentViewer && (
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Releasing Reviewed At</div>
                                    <div className="text-sm font-medium text-slate-800 mt-1">{releasingReviewedAtDisplay()}</div>
                                </div>
                            )}

                            {transfer.ReleasingDecisionReason && (
                                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                                    <div className="text-xs text-amber-700 uppercase">Releasing Reason</div>
                                    <div className="text-sm text-amber-900 mt-1">{transfer.ReleasingDecisionReason}</div>
                                </div>
                            )}

                            {transfer.GsoNotes && (
                                <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-xs text-slate-500 uppercase">Notes</div>
                                    <div className="text-sm text-slate-700 mt-1">{transfer.GsoNotes}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Transferred Items</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Qty</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Property #</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Article</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Item Description</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Full Specs</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Unit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {(transfer.items || []).map((item) => (
                                    <tr key={item.TransferItemID}>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {item.Quantity ?? 1}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {displayText(item.inventoryDetail?.PropertyNumber, 'Missing property number')}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {displayText(item.inventoryDetail?.drDetail?.article?.ArticleName, 'Missing article')}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {displayText(
                                                item.inventoryDetail?.drDetail?.ItemDescription || item.inventoryDetail?.Description,
                                                'Missing item description'
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {[
                                                item.inventoryDetail?.Brand,
                                                item.inventoryDetail?.ModelNumber,
                                                (item.inventoryDetail?.SerialNumber || item.inventoryDetail?.drDetail?.SerialNumber)
                                                    ? `SN: ${item.inventoryDetail?.SerialNumber || item.inventoryDetail?.drDetail?.SerialNumber}`
                                                    : null,
                                            ].filter(Boolean).join(' | ') || 'Missing full specs'}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {displayText(item.inventoryDetail?.unitOfMeasure?.UnitName, 'Missing unit')}
                                        </td>
                                    </tr>
                                ))}
                                {(!transfer.items || transfer.items.length === 0) && (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                                            No items recorded for this transfer.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <ConfirmDialog
                    open={pendingConfirmAction !== null}
                    onOpenChange={(open) => {
                        if (!open) setPendingConfirmAction(null);
                    }}
                    title={confirmDialogConfig().title}
                    description={confirmDialogConfig().description}
                    confirmText={confirmDialogConfig().confirmText}
                    cancelText="Cancel"
                    onConfirm={handleConfirmAction}
                    loading={isProcessing}
                />
            </div>
        </div>
    );
}
