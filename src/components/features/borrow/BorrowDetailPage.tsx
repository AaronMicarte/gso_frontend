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

import borrowAPI from '@/lib/api/borrow';
import { BorrowCondition, PropertyBorrow, BorrowReleasingDecision, BorrowStatus } from '@/types/propertyBorrow';
import { useAuth } from '@/lib/hooks/useAuth';

type BorrowStatusBadge = BorrowStatus | 'overdue';

const statusConfig: Record<BorrowStatusBadge, { label: string; className: string; icon: typeof Clock }> = {
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
    approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800', icon: XCircle },
    borrowed: { label: 'Borrowed', className: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
    partially_returned: { label: 'Partially Returned', className: 'bg-cyan-100 text-cyan-800', icon: CheckCircle },
    returned: { label: 'Returned', className: 'bg-green-100 text-green-800', icon: CheckCircle },
    cancelled: { label: 'Cancelled', className: 'bg-slate-200 text-slate-700', icon: XCircle },
    overdue: { label: 'Overdue', className: 'bg-rose-100 text-rose-700', icon: XCircle },
};

interface BorrowDetailPageProps {
    baseRoute: string;
}

type PendingConfirmAction = 'approve' | 'return' | null;

function displaySafeText(value: string | null | undefined, fallback: string) {
    const text = value?.trim();
    return text && text.length > 0 ? text : fallback;
}

export function BorrowDetailPage({ baseRoute }: BorrowDetailPageProps) {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [borrow, setBorrow] = useState<PropertyBorrow | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectNotes, setRejectNotes] = useState('');
    const [returnNotes, setReturnNotes] = useState('');
    const [conditions, setConditions] = useState<BorrowCondition[]>([]);
    const [returnRowsByItem, setReturnRowsByItem] = useState<Record<number, Array<{ rowId: string; conditionId: number | null; quantity: number }>>>({});
    const [rejectOpen, setRejectOpen] = useState(false);
    const [releasingReviewOpen, setReleasingReviewOpen] = useState(false);
    const [releasingDecision, setReleasingDecision] = useState<'approved' | 'rejected'>('approved');
    const [releasingProvidedByGroup, setReleasingProvidedByGroup] = useState<Record<string, number>>({});
    const [releasingReason, setReleasingReason] = useState('');
    const [pendingConfirmAction, setPendingConfirmAction] = useState<PendingConfirmAction>(null);

    const borrowId = params?.id ? parseInt(params.id as string) : null;

    const isPrivilegedUser = user?.UserRoleID === 1 || user?.UserRoleID === 2;
    const canApprove = isPrivilegedUser
        && (borrow?.Status === 'pending'
            || (borrow?.Status === 'approved' && borrow?.ReleasingDecision === 'approved'));
    const canReject = isPrivilegedUser && (borrow?.Status === 'pending' || borrow?.Status === 'approved');
    const canReleasingReview = user?.UserRoleID === 4
        && borrow?.Status === 'approved'
        && (borrow?.ReleasingDecision ?? 'pending') === 'pending'
        && Number(user?.DepartmentID ?? 0) === Number(borrow?.FromDepartmentID ?? 0);
    const canReturnBorrow = isPrivilegedUser
        && (borrow?.Status === 'borrowed' || borrow?.Status === 'partially_returned');
    const isDepartmentHead = user?.UserRoleID === 4 && !isPrivilegedUser;
    const isReleasingDepartmentViewer = user?.UserRoleID === 4
        && !isPrivilegedUser
        && Number(user?.DepartmentID ?? 0) === Number(borrow?.FromDepartmentID ?? 0);

    const addConditionRow = (borrowItemId: number) => {
        setReturnRowsByItem((prev) => {
            const rows = prev[borrowItemId] ?? [];
            const nextRowId = `${borrowItemId}-${rows.length}`;
            return {
                ...prev,
                [borrowItemId]: [...rows, { rowId: nextRowId, conditionId: null, quantity: 0 }],
            };
        });
    };

    const removeConditionRow = (borrowItemId: number, rowId: string) => {
        setReturnRowsByItem((prev) => {
            const rows = (prev[borrowItemId] ?? []).filter((row) => row.rowId !== rowId);
            return {
                ...prev,
                [borrowItemId]: rows.length > 0 ? rows : [{ rowId: `${borrowItemId}-0`, conditionId: null, quantity: 0 }],
            };
        });
    };

    const groupedRequestedItems = useMemo(() => {
        const groups = new Map<string, {
            key: string;
            label: string;
            requestedQty: number;
            itemIds: number[];
            itemById: Record<number, { requestedQty: number }>;
        }>();

        for (const item of borrow?.items ?? []) {
            const itemId = item.BorrowItemID;
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
    }, [borrow?.items]);

    const returnTotalsByItemId = useMemo(() => {
        const totals: Record<number, number> = {};
        for (const returnRecord of borrow?.returns ?? []) {
            for (const item of returnRecord.items ?? []) {
                const itemId = Number(item.BorrowItemID ?? 0);
                if (!itemId) continue;
                totals[itemId] = (totals[itemId] ?? 0) + Number(item.QuantityReturned ?? 0);
            }
        }
        return totals;
    }, [borrow?.returns]);

    const returnableItems = useMemo(() => (
        (borrow?.items ?? []).map((item) => {
            const returnedQty = returnTotalsByItemId[item.BorrowItemID] ?? 0;
            const remainingQty = Math.max(0, Number(item.Quantity ?? 0) - returnedQty);
            return {
                item,
                returnedQty,
                remainingQty,
            };
        }).filter((entry) => entry.remainingQty > 0)
    ), [borrow?.items, returnTotalsByItemId]);

    const totalBorrowed = useMemo(() => (
        (borrow?.items ?? []).reduce((sum, item) => sum + Number(item.Quantity ?? 0), 0)
    ), [borrow?.items]);

    const totalReturned = useMemo(() => (
        Object.values(returnTotalsByItemId).reduce((sum, qty) => sum + Number(qty ?? 0), 0)
    ), [returnTotalsByItemId]);

    const lastReturnAt = useMemo(() => {
        const sorted = (borrow?.returns ?? [])
            .map((entry) => entry.ReturnedAt || entry.created_at)
            .filter((value): value is string => Boolean(value));
        if (sorted.length === 0) return null;
        return sorted.sort().slice(-1)[0];
    }, [borrow?.returns]);

    const loadBorrow = useCallback(async () => {
        if (!borrowId) return;
        try {
            setLoading(true);
            const data = await borrowAPI.getById(borrowId);
            setBorrow(data);
        } catch {
            toast.error('Failed to load borrow details');
            router.push(baseRoute);
        } finally {
            setLoading(false);
        }
    }, [borrowId, router, baseRoute]);

    useEffect(() => {
        loadBorrow();
    }, [loadBorrow]);

    useEffect(() => {
        let isMounted = true;
        borrowAPI.getConditions()
            .then((data) => {
                if (isMounted) setConditions(data);
            })
            .catch(() => {
                toast.error('Failed to load return conditions');
            });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!borrow) return;
        const groupedDefaults: Record<string, number> = {};
        const groups = new Map<string, number>();
        for (const item of borrow.items ?? []) {
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
        setReleasingReason(borrow.ReleasingDecisionReason ?? '');
    }, [borrow]);

    useEffect(() => {
        if (!borrow) return;
        const nextRows: Record<number, Array<{ rowId: string; conditionId: number | null; quantity: number }>> = {};
        for (const entry of returnableItems) {
            nextRows[entry.item.BorrowItemID] = [
                {
                    rowId: `${entry.item.BorrowItemID}-0`,
                    conditionId: null,
                    quantity: entry.remainingQty,
                },
            ];
        }
        setReturnRowsByItem(nextRows);
    }, [borrow, returnableItems]);

    const handleApprove = async () => {
        if (!borrow) return;
        const isFinalAction = borrow.Status === 'approved';
        try {
            setIsProcessing(true);
            await borrowAPI.approve(borrow.BorrowID);
            toast.success(isFinalAction
                ? 'Borrow finalized and marked as borrowed.'
                : 'Borrow approved by GSO. Releasing custody can now review.');
            await loadBorrow();
        } catch {
            toast.error('Failed to approve borrow');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!borrow) return;
        try {
            setIsProcessing(true);
            await borrowAPI.reject(borrow.BorrowID, { notes: rejectNotes.trim() || null });
            toast.success('Borrow rejected');
            setRejectOpen(false);
            await loadBorrow();
        } catch {
            toast.error('Failed to reject borrow');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReleasingReview = async () => {
        if (!borrow) return;

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
            await borrowAPI.releasingReview(borrow.BorrowID, {
                decision: releasingDecision,
                approved_quantities: releasingDecision === 'approved' ? approvedQuantities : {},
                reason: releasingReason.trim() || null,
            });
            toast.success('Releasing review submitted');
            setReleasingReviewOpen(false);
            await loadBorrow();
        } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { message?: string } } };
            const message = maybeAxios?.response?.data?.message;
            toast.error(message || 'Failed to submit releasing review');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReturn = async () => {
        if (!borrow) return;

        const itemsPayload: Array<{ borrow_item_id: number; quantity: number; condition_id?: number | null }> = [];

        for (const entry of returnableItems) {
            const rows = returnRowsByItem[entry.item.BorrowItemID] || [];
            const totalRequested = Number(entry.remainingQty ?? 0);
            const totalProvided = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

            if (totalProvided > totalRequested) {
                toast.error(`Return quantity cannot exceed remaining quantity for ${displaySafeText(entry.item.inventoryDetail?.Description, 'item')}.`);
                return;
            }

            for (const row of rows) {
                const quantity = Number(row.quantity || 0);
                if (quantity < 1) continue;
                if (!row.conditionId) {
                    toast.error('Select a condition for each returned quantity');
                    return;
                }
                itemsPayload.push({
                    borrow_item_id: entry.item.BorrowItemID,
                    quantity,
                    condition_id: row.conditionId,
                });
            }
        }

        if (itemsPayload.length < 1) {
            toast.error('Select at least one item to return');
            return;
        }

        try {
            setIsProcessing(true);
            await borrowAPI.returning(borrow.BorrowID, {
                notes: returnNotes.trim() || null,
                items: itemsPayload,
            });
            toast.success('Return recorded');
            setReturnNotes('');
            await loadBorrow();
        } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { message?: string } } };
            const message = maybeAxios?.response?.data?.message;
            toast.error(message || 'Failed to record return');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmAction = async () => {
        if (!pendingConfirmAction) return;

        if (pendingConfirmAction === 'approve') {
            await handleApprove();
            setPendingConfirmAction(null);
            return;
        }

        if (pendingConfirmAction === 'return') {
            await handleReturn();
            setPendingConfirmAction(null);
        }
    };

    const confirmDialogConfig = () => {
        if (pendingConfirmAction === 'approve') {
            const isFinalAction = borrow?.Status === 'approved';
            return {
                title: isFinalAction ? 'Confirm Final GSO Action' : 'Confirm GSO Approval',
                description: isFinalAction
                    ? 'Finalize this request and mark items as borrowed?'
                    : 'Approve this borrow request so releasing custody can review?',
                confirmText: isFinalAction ? 'Finalize Borrow' : 'Confirm Approval',
            };
        }

        return {
            title: 'Confirm Return',
            description: 'Record the selected return quantities?',
            confirmText: 'Record Return',
        };
    };

    const formatDisplayDate = (dateValue?: string | null) => {
        if (!dateValue) return '';
        return format(toZonedTime(new Date(dateValue), 'Asia/Manila'), 'MMM dd, yyyy');
    };

    const formatDisplayDateTime = (dateValue?: string | null) => {
        if (!dateValue) return '';
        return format(toZonedTime(new Date(dateValue), 'Asia/Manila'), 'MMM dd, yyyy h:mm a');
    };

    const displayText = (value: string | null | undefined, missingLabel: string) => {
        const text = value?.trim();
        return text && text.length > 0 ? text : missingLabel;
    };

    const releasingDecisionLabel = (decision?: BorrowReleasingDecision) => {
        if (decision === 'approved') return 'Approved by releasing custody';
        if (decision === 'rejected') return 'Rejected by releasing custody';
        return 'Pending releasing custody review';
    };

    const releasingDecisionBadgeClass = (decision?: BorrowReleasingDecision) => {
        if (decision === 'approved') return 'bg-emerald-100 text-emerald-700';
        if (decision === 'rejected') return 'bg-rose-100 text-rose-700';
        return 'bg-amber-100 text-amber-700';
    };

    const isOverdue = () => {
        if (!borrow) return false;
        if (borrow.Status !== 'borrowed' && borrow.Status !== 'partially_returned') return false;
        if (totalBorrowed > 0 && totalReturned >= totalBorrowed) return false;
        if (!borrow.DueDate) return false;
        const due = toZonedTime(new Date(borrow.DueDate), 'Asia/Manila');
        const now = toZonedTime(new Date(), 'Asia/Manila');
        return due < now;
    };

    const statusBadge: BorrowStatusBadge = isOverdue() ? 'overdue' : (borrow?.Status ?? 'pending');

    const canPrint = (borrow?.Status === 'approved'
        || borrow?.Status === 'borrowed'
        || borrow?.Status === 'partially_returned'
        || borrow?.Status === 'returned')
        && !isDepartmentHead;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                    <span className="ml-3 text-gray-600">Loading borrow request…</span>
                </div>
            </div>
        );
    }

    if (!borrow) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Borrow request not found</div>
                    <div className="text-sm text-slate-600 mt-1">The record could not be loaded.</div>
                    <div className="mt-4">
                        <Link href={baseRoute} className="text-sm text-[var(--primary)] underline">
                            Back to borrows
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const statusMeta = statusConfig[statusBadge];
    const StatusIcon = statusMeta.icon;

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <Link href={baseRoute} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                            <ArrowLeft className="w-4 h-4" />
                            Back to borrows
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900">Borrow Request {borrow.BorrowNumber}</h1>
                        <p className="text-sm text-slate-500">Track approvals, release, and return status</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${statusMeta.className}`}>
                            <StatusIcon className="w-4 h-4" />
                            {statusMeta.label}
                        </span>
                        {canPrint && (
                            <Link
                                href={`${baseRoute}/${borrow.BorrowID}/print`}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                                <Printer className="w-4 h-4" />
                                Print
                            </Link>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Releasing Custodian</div>
                                    <div className="text-sm font-semibold text-slate-900">
                                        {displayText(borrow.fromEndUser?.FullName, 'Missing releasing custodian')}
                                        {borrow.fromEndUser?.DepartmentName
                                            ? ` - ${borrow.fromEndUser.DepartmentName}`
                                            : (borrow.fromDepartment?.DepartmentName ? ` - ${borrow.fromDepartment.DepartmentName}` : '')}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Borrowing Custodian</div>
                                    <div className="text-sm font-semibold text-slate-900">
                                        {displayText(borrow.toEndUser?.FullName, 'Missing borrowing custodian')}
                                        {borrow.toEndUser?.DepartmentName
                                            ? ` - ${borrow.toEndUser.DepartmentName}`
                                            : (borrow.toDepartment?.DepartmentName ? ` - ${borrow.toDepartment.DepartmentName}` : '')}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Requested By</div>
                                    <div className="text-sm font-semibold text-slate-900">
                                        {displayText(borrow.requestedBy?.FullName, 'Missing requester')}
                                        {borrow.requestedBy?.department?.DepartmentName
                                            ? ` - ${borrow.requestedBy.department.DepartmentName}`
                                            : ''}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Due Date</div>
                                    <div className={`text-sm font-semibold ${isOverdue() ? 'text-rose-600' : 'text-slate-900'}`}>
                                        {formatDisplayDate(borrow.DueDate) || 'Missing due date'}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 uppercase">Purpose</div>
                                <div className="text-sm text-slate-700">
                                    {displayText(borrow.Purpose, 'No purpose provided')}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-900">Borrowed Items</h2>
                                <span className="text-sm text-slate-500">{borrow.items?.length ?? 0} item(s)</span>
                            </div>
                            <div className="divide-y divide-slate-200">
                                {(borrow.items ?? []).map((item) => (
                                    <div key={item.BorrowItemID} className="py-3">
                                        <div className="text-sm font-semibold text-slate-900">
                                            {displayText(item.inventoryDetail?.Description, 'Unspecified item')}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {displayText(item.inventoryDetail?.propertyType?.PropertyName, 'Unclassified')}
                                            {' • '}Unit: {displayText(item.inventoryDetail?.unitOfMeasure?.UnitName, 'unit')}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Property #: {displayText(item.inventoryDetail?.PropertyNumber, 'Missing')} | Serial: {displayText(item.inventoryDetail?.SerialNumber, 'Missing')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div className="text-sm font-semibold text-slate-900">Workflow Timeline</div>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${releasingDecisionBadgeClass(borrow.ReleasingDecision)}`}>
                                    {releasingDecisionLabel(borrow.ReleasingDecision)}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                {!isReleasingDepartmentViewer && (
                                    <>
                                        <div>
                                            <div className="text-xs text-slate-500 uppercase">GSO Approved At</div>
                                            <div className="text-sm font-medium text-slate-800 mt-1">
                                                {borrow.ApprovedAt ? formatDisplayDateTime(borrow.ApprovedAt) : 'Pending approval'}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <div className="text-xs text-slate-500 uppercase">Releasing Reviewed At</div>
                                    <div className="text-sm font-medium text-slate-800 mt-1">
                                        {formatDisplayDateTime(borrow.ReleasingReviewedAt) || 'Pending review'}
                                    </div>
                                </div>

                                {!isReleasingDepartmentViewer && (
                                    <>
                                        <div>
                                            <div className="text-xs text-slate-500 uppercase">Borrow Delivered At</div>
                                            <div className="text-sm font-medium text-slate-800 mt-1">
                                                {borrow.BorrowedAt ? formatDisplayDateTime(borrow.BorrowedAt) : 'Not yet delivered'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500 uppercase">Returned At</div>
                                            <div className="text-sm font-medium text-slate-800 mt-1">
                                                {lastReturnAt ? formatDisplayDateTime(lastReturnAt) : 'Not returned'}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {borrow.ReleasingDecisionReason && (
                                    <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                                        <div className="text-xs text-amber-700 uppercase">Releasing Reason</div>
                                        <div className="text-sm text-amber-900 mt-1">{borrow.ReleasingDecisionReason}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isReleasingDepartmentViewer && (
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-slate-900">Return History</h2>
                                    <span className="text-sm text-slate-500">{totalReturned} of {totalBorrowed} returned</span>
                                </div>
                                {(borrow.returns ?? []).length === 0 ? (
                                    <div className="text-sm text-slate-500">No returns recorded yet.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {(borrow.returns ?? []).map((returnRecord) => (
                                            <div key={returnRecord.ReturnID} className="rounded-lg border border-slate-200 p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="text-sm font-semibold text-slate-900">
                                                        {returnRecord.ReturnNumber || `Return #${returnRecord.ReturnID}`}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {formatDisplayDateTime(returnRecord.ReturnedAt || returnRecord.created_at) || 'Missing return date'}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Returned by {displayText(returnRecord.returnedBy?.FullName, 'Unknown user')}
                                                </div>
                                                {returnRecord.Notes && (
                                                    <div className="text-xs text-slate-600 mt-2">Notes: {returnRecord.Notes}</div>
                                                )}
                                                <div className="mt-3 space-y-2">
                                                    {(returnRecord.items ?? []).map((item) => (
                                                        <div key={item.ReturnItemID} className="flex items-center justify-between text-xs text-slate-700">
                                                            <div>
                                                                {displayText(item.inventoryDetail?.Description, 'Unspecified item')}
                                                                {item.condition?.ConditionName
                                                                    ? ` · ${item.condition.ConditionName}`
                                                                    : ''}
                                                            </div>
                                                            <div className="font-semibold">Qty: {item.QuantityReturned}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
                            <h2 className="text-lg font-semibold text-slate-900">Actions</h2>

                            {canReleasingReview && (
                                <button
                                    type="button"
                                    onClick={() => setReleasingReviewOpen(true)}
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-white text-sm hover:bg-amber-600"
                                >
                                    <FileText className="w-4 h-4" />
                                    Releasing Review
                                </button>
                            )}

                            {canApprove && (
                                <button
                                    type="button"
                                    onClick={() => setPendingConfirmAction('approve')}
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm hover:bg-emerald-700"
                                >
                                    {borrow.Status === 'approved' ? 'Finalize Borrow' : 'Approve (GSO)'}
                                </button>
                            )}

                            {canReject && (
                                <button
                                    type="button"
                                    onClick={() => setRejectOpen(true)}
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-rose-600 text-sm hover:bg-rose-50"
                                >
                                    Reject Borrow
                                </button>
                            )}

                            {canReturnBorrow && (
                                <div className="space-y-3">
                                    {returnableItems.length === 0 ? (
                                        <div className="text-sm text-slate-500">All items have been returned.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {returnableItems.map((entry) => (
                                                <div key={entry.item.BorrowItemID} className="space-y-2 rounded-lg border border-slate-200 p-3">
                                                    <div className="text-sm text-slate-700 font-medium">
                                                        {displayText(entry.item.inventoryDetail?.Description, 'Unspecified item')}
                                                        <span className="text-xs text-slate-400"> · Remaining: {entry.remainingQty}</span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {(returnRowsByItem[entry.item.BorrowItemID] ?? []).map((row) => (
                                                            <div key={row.rowId} className="flex flex-wrap items-center gap-2">
                                                                <select
                                                                    value={row.conditionId ?? ''}
                                                                    onChange={(event) => {
                                                                        const nextValue = event.target.value ? Number(event.target.value) : null;
                                                                        setReturnRowsByItem((prev) => ({
                                                                            ...prev,
                                                                            [entry.item.BorrowItemID]: (prev[entry.item.BorrowItemID] ?? []).map((existing) => (
                                                                                existing.rowId === row.rowId
                                                                                    ? { ...existing, conditionId: nextValue }
                                                                                    : existing
                                                                            )),
                                                                        }));
                                                                    }}
                                                                    className="min-w-[220px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)]"
                                                                >
                                                                    <option value="">Select condition</option>
                                                                    {conditions.map((condition) => (
                                                                        <option key={condition.ConditionID} value={condition.ConditionID}>
                                                                            {condition.ConditionName}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={entry.remainingQty}
                                                                    value={row.quantity}
                                                                    onChange={(event) => {
                                                                        const nextValue = Math.max(0, Number(event.target.value));
                                                                        setReturnRowsByItem((prev) => ({
                                                                            ...prev,
                                                                            [entry.item.BorrowItemID]: (prev[entry.item.BorrowItemID] ?? []).map((existing) => (
                                                                                existing.rowId === row.rowId
                                                                                    ? { ...existing, quantity: nextValue }
                                                                                    : existing
                                                                            )),
                                                                        }));
                                                                    }}
                                                                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)]"
                                                                />
                                                                {(returnRowsByItem[entry.item.BorrowItemID] ?? []).length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeConditionRow(entry.item.BorrowItemID, row.rowId)}
                                                                        className="text-xs text-rose-600 hover:text-rose-700"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => addConditionRow(entry.item.BorrowItemID)}
                                                        className="text-xs text-[var(--primary)] hover:underline"
                                                    >
                                                        Add condition row
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <textarea
                                        rows={3}
                                        value={returnNotes}
                                        onChange={(event) => setReturnNotes(event.target.value)}
                                        placeholder="Return notes (optional)"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setPendingConfirmAction('return')}
                                        disabled={returnableItems.length === 0}
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                        Record Return
                                    </button>
                                </div>
                            )}

                            {!canReleasingReview && !canApprove && !canReject && !canReturnBorrow && (
                                <div className="text-sm text-slate-500">No actions available for your role.</div>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="text-lg font-semibold text-slate-900">Borrow Summary</h2>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>
                                    {statusMeta.label}
                                </span>
                            </div>
                            <div className="text-sm text-slate-600">Requested on: {formatDisplayDateTime(borrow.created_at) || 'Unknown'}</div>
                            {!isReleasingDepartmentViewer && (
                                <>
                                    <div className="text-sm text-slate-600">Borrowed at: {formatDisplayDateTime(borrow.BorrowedAt) || 'Not yet borrowed'}</div>
                                    <div className="text-sm text-slate-600">Returned at: {formatDisplayDateTime(lastReturnAt) || 'Not yet returned'}</div>
                                    <div className="text-sm text-slate-600">Returned items: {totalReturned} of {totalBorrowed}</div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Dialog.Root open={releasingReviewOpen} onOpenChange={setReleasingReviewOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
                    <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4">
                        <Dialog.Title className="text-lg font-bold text-slate-900">Releasing Review</Dialog.Title>
                        <Dialog.Description className="text-slate-600 text-sm">Approve or reject the borrow request from your department.</Dialog.Description>

                        <div className="space-y-3">
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="radio"
                                        checked={releasingDecision === 'approved'}
                                        onChange={() => setReleasingDecision('approved')}
                                    />
                                    Approve
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="radio"
                                        checked={releasingDecision === 'rejected'}
                                        onChange={() => setReleasingDecision('rejected')}
                                    />
                                    Reject
                                </label>
                            </div>

                            {releasingDecision === 'approved' && (
                                <div className="space-y-3">
                                    {groupedRequestedItems.map((group) => (
                                        <div key={group.key} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                                            <div className="text-sm text-slate-700">{group.label}</div>
                                            <input
                                                type="number"
                                                min={0}
                                                max={group.requestedQty}
                                                value={releasingProvidedByGroup[group.key] ?? group.requestedQty}
                                                onChange={(event) => setReleasingProvidedByGroup((prev) => ({
                                                    ...prev,
                                                    [group.key]: Number(event.target.value),
                                                }))}
                                                className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)]"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-medium text-slate-700">Reason / Notes</label>
                                <textarea
                                    rows={3}
                                    value={releasingReason}
                                    onChange={(event) => setReleasingReason(event.target.value)}
                                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)]"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Dialog.Close asChild>
                                <button className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium text-sm">
                                    Cancel
                                </button>
                            </Dialog.Close>
                            <button
                                onClick={handleReleasingReview}
                                disabled={isProcessing}
                                className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors font-medium text-sm disabled:opacity-60"
                            >
                                {isProcessing ? 'Processing...' : 'Submit Review'}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            <ConfirmDialog
                title={confirmDialogConfig().title}
                description={confirmDialogConfig().description}
                confirmText={confirmDialogConfig().confirmText}
                open={pendingConfirmAction !== null}
                onOpenChange={() => setPendingConfirmAction(null)}
                onConfirm={handleConfirmAction}
                loading={isProcessing}
            />

            <ConfirmDialog
                title="Reject Borrow"
                description="Provide a reason for rejection"
                confirmText="Reject Borrow"
                open={rejectOpen}
                onOpenChange={setRejectOpen}
                onConfirm={handleReject}
                loading={isProcessing}
            >
                <textarea
                    rows={3}
                    value={rejectNotes}
                    onChange={(event) => setRejectNotes(event.target.value)}
                    placeholder="Reason for rejection"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
            </ConfirmDialog>
        </div>
    );
}
