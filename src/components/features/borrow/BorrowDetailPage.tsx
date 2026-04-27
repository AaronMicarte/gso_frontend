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
import { BorrowCondition, PropertyBorrow, PropertyBorrowItem, BorrowReleasingDecision, BorrowStatus } from '@/types/propertyBorrow';
import { useAuth } from '@/lib/hooks/useAuth';

type BorrowStatusBadge = BorrowStatus | 'overdue';

const statusConfig: Record<BorrowStatusBadge, { label: string; className: string; icon: typeof Clock }> = {
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
    approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800', icon: XCircle },
    borrowed: { label: 'Borrowed', className: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
    partially_returned: { label: 'Partially Returned', className: 'bg-cyan-100 text-cyan-800', icon: CheckCircle },
    returned: { label: 'Returned', className: 'bg-green-100 text-green-800', icon: CheckCircle },
    completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
    cancelled: { label: 'Cancelled', className: 'bg-slate-200 text-slate-700', icon: XCircle },
    overdue: { label: 'Overdue', className: 'bg-rose-100 text-rose-700', icon: XCircle },
};

interface BorrowDetailPageProps {
    baseRoute: string;
}

type PendingConfirmAction = 'deliver' | 'return' | 'complete' | null;

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
    const [releasingStatusByGroup, setReleasingStatusByGroup] = useState<Record<string, 'approved' | 'rejected'>>({});
    const [releasingReason, setReleasingReason] = useState('');
    const [pendingConfirmAction, setPendingConfirmAction] = useState<PendingConfirmAction>(null);

    const borrowId = params?.id ? parseInt(params.id as string) : null;

    const isPrivilegedUser = user?.UserRoleID === 1 || user?.UserRoleID === 2;
    const canApprove = false;
    const canDeliver = isPrivilegedUser && borrow?.Status === 'approved';
    const canReject = isPrivilegedUser && (borrow?.Status === 'pending' || borrow?.Status === 'approved');
    const canReleasingReview = isPrivilegedUser
        && borrow?.Status === 'approved'
        && (borrow?.ReleasingDecision ?? 'pending') === 'pending';
    const canReturnBorrow = isPrivilegedUser
        && (borrow?.Status === 'borrowed' || borrow?.Status === 'partially_returned');
    const canCompleteBorrow = isPrivilegedUser && borrow?.Status === 'returned';
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
            fullSpecs: string;
            propertyNumbers: string[];
            requestedQty: number;
            itemIds: number[];
            itemById: Record<number, { requestedQty: number }>;
        }>();

        for (const item of borrow?.items ?? []) {
            const itemId = item.BorrowItemID;
            const requestedQty = Number(item.Quantity ?? 1);
            const article = displaySafeText(item.inventoryDetail?.drDetail?.article?.ArticleName, 'Missing article');
            const description = displaySafeText(item.inventoryDetail?.drDetail?.ItemDescription || item.inventoryDetail?.Description, 'Unspecified item');
            const unit = displaySafeText(item.inventoryDetail?.unitOfMeasure?.UnitName, 'unit');
            const fullSpecs = [
                item.inventoryDetail?.Brand,
                item.inventoryDetail?.ModelNumber,
                item.inventoryDetail?.SerialNumber
                    ? `SN: ${item.inventoryDetail.SerialNumber}`
                    : null,
            ].filter(Boolean).join(' | ') || 'Missing full specs';
            const groupKey = `${article}||${description}||${fullSpecs}||${unit}`;

            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    key: groupKey,
                    label: `${article} · ${description} (${unit})`,
                    fullSpecs,
                    propertyNumbers: [],
                    requestedQty: 0,
                    itemIds: [],
                    itemById: {},
                });
            }

            const existing = groups.get(groupKey)!;
            existing.requestedQty += requestedQty;
            existing.itemIds.push(itemId);
            existing.itemById[itemId] = { requestedQty };
            existing.propertyNumbers.push(displaySafeText(item.inventoryDetail?.PropertyNumber, 'Missing property number'));
        }

        return Array.from(groups.values());
    }, [borrow?.items]);

    const groupedBorrowRows = useMemo(() => {
        const groups = new Map<string, {
            key: string;
            requestedQty: number;
            approvedQty: number;
            article: string;
            itemDescription: string;
            fullSpecs: string;
            unit: string;
            propertyNumbers: Array<{
                propertyNumber: string;
                requestedQty: number;
                approvedQty: number;
                statusClass: string;
                statusLabel: string;
            }>;
            statusClass: string;
            statusLabel: string;
        }>();

        for (const item of borrow?.items ?? []) {
            const article = displaySafeText(item.inventoryDetail?.drDetail?.article?.ArticleName, 'Missing article');
            const itemDescription = displaySafeText(item.inventoryDetail?.drDetail?.ItemDescription || item.inventoryDetail?.Description, 'Missing item description');
            const unit = displaySafeText(item.inventoryDetail?.unitOfMeasure?.UnitName, 'Missing unit');
            const fullSpecs = [
                item.inventoryDetail?.Brand,
                item.inventoryDetail?.ModelNumber,
                item.inventoryDetail?.SerialNumber
                    ? `SN: ${item.inventoryDetail.SerialNumber}`
                    : null,
            ].filter(Boolean).join(' | ') || 'Missing full specs';
            const key = `${article}||${itemDescription}||${fullSpecs}||${unit}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    requestedQty: 0,
                    approvedQty: 0,
                    article,
                    itemDescription,
                    fullSpecs,
                    unit,
                    propertyNumbers: [],
                    statusClass: 'bg-amber-100 text-amber-700',
                    statusLabel: 'Pending',
                });
            }

            const entry = groups.get(key)!;
            const requested = Number(item.Quantity ?? 0);
            const approved = Number(item.ApprovedQuantity ?? item.Quantity ?? 0);
            entry.requestedQty += requested;
            entry.approvedQty += approved;
            const propertyNumber = displaySafeText(item.inventoryDetail?.PropertyNumber, 'Missing property number');
            const itemStatus = !borrow || borrow.Status === 'pending'
                ? { statusClass: 'bg-amber-100 text-amber-700', statusLabel: 'Pending' }
                : approved <= 0
                    ? { statusClass: 'bg-rose-100 text-rose-700', statusLabel: 'Rejected' }
                    : approved < requested
                        ? { statusClass: 'bg-yellow-100 text-yellow-800', statusLabel: 'Partially Approved' }
                        : { statusClass: 'bg-emerald-100 text-emerald-700', statusLabel: 'Approved' };
            entry.propertyNumbers.push({
                propertyNumber,
                requestedQty: requested,
                approvedQty: approved,
                statusClass: itemStatus.statusClass,
                statusLabel: itemStatus.statusLabel,
            });

        }

        for (const entry of groups.values()) {
            if (!borrow || borrow.Status === 'pending') {
                entry.statusClass = 'bg-amber-100 text-amber-700';
                entry.statusLabel = 'Pending';
            } else if (entry.approvedQty <= 0) {
                entry.statusClass = 'bg-rose-100 text-rose-700';
                entry.statusLabel = 'Rejected';
            } else if (entry.approvedQty < entry.requestedQty) {
                entry.statusClass = 'bg-yellow-100 text-yellow-800';
                entry.statusLabel = 'Partially Approved';
            } else {
                entry.statusClass = 'bg-emerald-100 text-emerald-700';
                entry.statusLabel = 'Approved';
            }
        }

        return Array.from(groups.values());
    }, [borrow, borrow?.items]);

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
            const effectiveQty = Number(item.ApprovedQuantity ?? item.Quantity ?? 0);
            const remainingQty = Math.max(0, effectiveQty - returnedQty);
            return {
                item,
                effectiveQty,
                returnedQty,
                remainingQty,
            };
        }).filter((entry) => entry.remainingQty > 0)
    ), [borrow?.items, returnTotalsByItemId]);

    const totalBorrowed = useMemo(() => (
        (borrow?.items ?? []).reduce((sum, item) => sum + Number(item.ApprovedQuantity ?? item.Quantity ?? 0), 0)
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
        setReleasingStatusByGroup(Object.fromEntries(Object.keys(groupedDefaults).map((key) => [key, 'approved'])));
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

    const handleDeliver = async () => {
        if (!borrow) return;
        try {
            setIsProcessing(true);
            await borrowAPI.deliver(borrow.BorrowID);
            toast.success('Borrow marked as delivered.');
            await loadBorrow();
        } catch {
            toast.error('Failed to mark borrow as delivered');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleComplete = async () => {
        if (!borrow) return;
        try {
            setIsProcessing(true);
            await borrowAPI.complete(borrow.BorrowID, { notes: returnNotes.trim() || null });
            toast.success('Borrow marked as completed.');
            await loadBorrow();
        } catch {
            toast.error('Failed to complete borrow');
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
            const groupStatus = releasingStatusByGroup[group.key] ?? 'approved';
            const providedQtyRaw = groupStatus === 'rejected'
                ? 0
                : Number(releasingProvidedByGroup[group.key] ?? group.requestedQty);
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

        if (pendingConfirmAction === 'deliver') {
            await handleDeliver();
            setPendingConfirmAction(null);
            return;
        }

        if (pendingConfirmAction === 'return') {
            await handleReturn();
            setPendingConfirmAction(null);
            return;
        }

        if (pendingConfirmAction === 'complete') {
            await handleComplete();
            setPendingConfirmAction(null);
        }
    };

    const confirmDialogConfig = () => {
        if (pendingConfirmAction === 'deliver') {
            return {
                title: 'Confirm Delivered',
                description: 'Mark this borrow request as delivered now?',
                confirmText: 'Mark Delivered',
            };
        }

        if (pendingConfirmAction === 'complete') {
            return {
                title: 'Confirm Completion',
                description: 'Mark this fully returned borrow as completed?',
                confirmText: 'Mark Completed',
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

    const getBorrowItemStatus = (item: PropertyBorrowItem) => {
        const approvedQuantity = Number(item.ApprovedQuantity ?? item.Quantity ?? 0);
        const requestedQuantity = Number(item.Quantity ?? 0);

        if (!borrow || borrow.Status === 'pending') {
            return { label: 'Pending', className: 'bg-amber-100 text-amber-700' };
        }

        if (approvedQuantity <= 0) {
            return { label: 'Rejected', className: 'bg-rose-100 text-rose-700' };
        }

        if (approvedQuantity < requestedQuantity) {
            return { label: 'Partially Approved', className: 'bg-yellow-100 text-yellow-800' };
        }

        return { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' };
    };

    const releasingDecisionBadgeClass = (decision?: BorrowReleasingDecision) => {
        if (decision === 'approved') return 'bg-emerald-100 text-emerald-700';
        if (decision === 'rejected') return 'bg-rose-100 text-rose-700';
        return 'bg-amber-100 text-amber-700';
    };

    const borrowProgressPercent = useMemo(() => {
        if (totalBorrowed <= 0) return 0;
        return Math.min(100, Math.round((totalReturned / totalBorrowed) * 100));
    }, [totalBorrowed, totalReturned]);

    const workflowTimelineItems = useMemo(() => {
        const items = [
            {
                label: 'Request Submitted',
                value: formatDisplayDateTime(borrow?.created_at) || 'Unknown',
                completed: Boolean(borrow?.created_at),
            },
            {
                label: 'GSO Approved',
                value: borrow?.ApprovedAt ? formatDisplayDateTime(borrow.ApprovedAt) : 'Pending approval',
                completed: Boolean(borrow?.ApprovedAt),
            },
            {
                label: 'Borrow Delivered',
                value: borrow?.BorrowedAt ? formatDisplayDateTime(borrow.BorrowedAt) : 'Not yet delivered',
                completed: Boolean(borrow?.BorrowedAt),
            },
            {
                label: 'Returned',
                value: lastReturnAt ? formatDisplayDateTime(lastReturnAt) : 'Not returned',
                completed: Boolean(lastReturnAt),
            },
            {
                label: 'Completed',
                value: borrow?.Status === 'completed'
                    ? (formatDisplayDateTime(borrow.updated_at) || 'Completed')
                    : 'Not completed',
                completed: borrow?.Status === 'completed',
            },
        ];

        return isReleasingDepartmentViewer ? items.slice(0, 2) : items;
    }, [borrow, formatDisplayDateTime, isReleasingDepartmentViewer, lastReturnAt]);

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
        || borrow?.Status === 'returned'
        || borrow?.Status === 'completed')
        && !isDepartmentHead;

    const statusBadgeNode = useMemo(() => {
        const config = statusConfig[statusBadge];
        const Icon = config.icon;
        return (
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${config.className}`}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
            </span>
        );
    }, [statusBadge]);

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
                        <Link href={baseRoute} className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Back to borrows</span>
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
                            <span className="hidden sm:inline">Back to borrows</span>
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900 mt-2">{borrow.BorrowNumber}</h1>
                        <div className="mt-2">{statusBadgeNode}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {canReleasingReview && (
                            <button
                                type="button"
                                onClick={() => setReleasingReviewOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                            >
                                <FileText className="w-4 h-4" />
                                Releasing Review
                            </button>
                        )}
                        {canDeliver && (
                            <button
                                type="button"
                                onClick={() => setPendingConfirmAction('deliver')}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                                Mark as Delivered
                            </button>
                        )}
                        {canReject && (
                            <button
                                type="button"
                                onClick={() => setRejectOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                            >
                                <XCircle className="w-4 h-4" />
                                Reject Borrow
                            </button>
                        )}
                        {canCompleteBorrow && (
                            <button
                                type="button"
                                onClick={() => setPendingConfirmAction('complete')}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                                <FileText className="w-4 h-4" />
                                Mark as Completed
                            </button>
                        )}
                        {canPrint && (
                            <Link
                                href={`${baseRoute}/${borrow.BorrowID}/print`}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                            >
                                <Printer className="w-4 h-4" />
                                Print PBR
                            </Link>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
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

                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div className="text-sm font-semibold text-slate-900">Workflow Timeline</div>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${releasingDecisionBadgeClass(borrow.ReleasingDecision)}`}>
                                    {borrow.Status === 'completed' ? 'Completed' : 'Auto-approved by GSO'}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {workflowTimelineItems.map((entry) => (
                                    <div key={entry.label} className="relative flex gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                                        <div className="mt-0.5 flex flex-col items-center">
                                            <span className={`h-2.5 w-2.5 rounded-full ${entry.completed ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                            <span className="mt-1 h-full min-h-6 w-px bg-slate-200" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs uppercase tracking-wide text-slate-500">{entry.label}</div>
                                            <div className={`mt-0.5 text-sm font-medium ${entry.completed ? 'text-slate-900' : 'text-slate-600'}`}>{entry.value}</div>
                                        </div>
                                    </div>
                                ))}

                                {borrow.ReleasingDecisionReason && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                                        <div className="text-xs text-amber-700 uppercase">Releasing Reason</div>
                                        <div className="text-sm text-amber-900 mt-1">{borrow.ReleasingDecisionReason}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="text-lg font-semibold text-slate-900">Borrow Summary</h2>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusConfig[statusBadge].className}`}>
                                    {statusConfig[statusBadge].label}
                                </span>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs uppercase tracking-wide text-slate-500">Return Progress</div>
                                <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                                    <div
                                        className="h-2 rounded-full bg-emerald-500 transition-all"
                                        style={{ width: `${borrowProgressPercent}%` }}
                                    />
                                </div>
                                <div className="mt-2 text-sm font-medium text-slate-700">{totalReturned} of {totalBorrowed} returned ({borrowProgressPercent}%)</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-slate-200 p-2.5">
                                    <div className="text-[11px] uppercase text-slate-500">Requested</div>
                                    <div className="text-sm font-semibold text-slate-800">{formatDisplayDateTime(borrow.created_at) || 'Unknown'}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 p-2.5">
                                    <div className="text-[11px] uppercase text-slate-500">Borrowed</div>
                                    <div className="text-sm font-semibold text-slate-800">{formatDisplayDateTime(borrow.BorrowedAt) || 'Not yet borrowed'}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 p-2.5">
                                    <div className="text-[11px] uppercase text-slate-500">Returned</div>
                                    <div className="text-sm font-semibold text-slate-800">{formatDisplayDateTime(lastReturnAt) || 'Not yet returned'}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 p-2.5">
                                    <div className="text-[11px] uppercase text-slate-500">Completed</div>
                                    <div className="text-sm font-semibold text-slate-800">{borrow.Status === 'completed' ? (formatDisplayDateTime(borrow.updated_at) || 'Completed') : 'Not yet completed'}</div>
                                </div>
                            </div>
                            {!isReleasingDepartmentViewer && (
                                <div className="text-xs text-slate-500">
                                    Due date: {formatDisplayDate(borrow.DueDate) || 'Missing due date'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">Borrowed Items</h2>
                        <span className="text-sm text-slate-500">{borrow.items?.length ?? 0} item(s)</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Requested</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Approved</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Property #</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Article</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Full Specs</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Unit</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {groupedBorrowRows.map((row) => (
                                    <tr key={row.key}>
                                        <td className="px-3 py-2 text-sm text-slate-700">{row.requestedQty}</td>
                                        <td className="px-3 py-2 text-sm text-slate-700">{row.approvedQty}</td>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            {row.propertyNumbers.length <= 1 ? (
                                                <div>
                                                    <div>{row.propertyNumbers[0]?.propertyNumber || 'Missing property number'}</div>
                                                    <div className="mt-1">
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.propertyNumbers[0]?.statusClass || row.statusClass}`}>
                                                            {row.propertyNumbers[0]?.statusLabel || row.statusLabel}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <details>
                                                    <summary className="cursor-pointer text-slate-700">Multiple ({row.propertyNumbers.length})</summary>
                                                    <div className="mt-2 space-y-2 text-xs text-slate-500">
                                                        {row.propertyNumbers.map((entry, idx) => (
                                                            <div key={`${row.key}-property-${entry.propertyNumber}-${idx}`} className="flex flex-wrap items-center justify-between gap-2">
                                                                <span>{entry.propertyNumber}</span>
                                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${entry.statusClass}`}>
                                                                    {entry.statusLabel}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-slate-700">{row.article}</td>
                                        <td className="px-3 py-2 text-sm text-slate-700">{row.itemDescription}</td>
                                        <td className="px-3 py-2 text-sm text-slate-700">{row.fullSpecs}</td>
                                        <td className="px-3 py-2 text-sm text-slate-700">{row.unit}</td>
                                        <td className="px-3 py-2 text-sm text-slate-700">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${row.statusClass}`}>
                                                {row.statusLabel}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {groupedBorrowRows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-3 py-6 text-center text-slate-500">No items recorded for this borrow.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
                                                        {item.condition?.ConditionName ? ` · ${item.condition.ConditionName}` : ''}
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

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <h2 className="text-lg font-semibold text-slate-900">Actions</h2>

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
                                Return Item(s)
                            </button>
                        </div>
                    )}

                    {!canReleasingReview && !canApprove && !canDeliver && !canReject && !canReturnBorrow && !canCompleteBorrow && (
                        <div className="text-sm text-slate-500">No actions available for your role.</div>
                    )}
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
                                        <div key={group.key} className="grid grid-cols-12 gap-3 border border-slate-200 rounded-lg px-3 py-3 items-center">
                                            <div className="col-span-12 md:col-span-6 text-sm text-slate-700">
                                                <div className="font-medium">{group.label}</div>
                                                <div className="text-xs text-slate-500">Requested: {group.requestedQty}</div>
                                                <div className="text-xs text-slate-500">{group.fullSpecs}</div>
                                                <details className="mt-1">
                                                    <summary className="cursor-pointer text-xs text-slate-500">Property numbers ({group.propertyNumbers.length})</summary>
                                                    <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                                                        {group.propertyNumbers.map((propertyNumber, idx) => (
                                                            <div key={`${group.key}-${propertyNumber}-${idx}`}>{propertyNumber}</div>
                                                        ))}
                                                    </div>
                                                </details>
                                            </div>
                                            <div className="col-span-12 md:col-span-3">
                                                <label className="text-xs text-slate-500">Item Status</label>
                                                <select
                                                    value={releasingStatusByGroup[group.key] ?? 'approved'}
                                                    onChange={(event) => {
                                                        const nextStatus = event.target.value as 'approved' | 'rejected';
                                                        setReleasingStatusByGroup((prev) => ({ ...prev, [group.key]: nextStatus }));
                                                        if (nextStatus === 'rejected') {
                                                            setReleasingProvidedByGroup((prev) => ({ ...prev, [group.key]: 0 }));
                                                        } else if ((releasingProvidedByGroup[group.key] ?? 0) === 0) {
                                                            setReleasingProvidedByGroup((prev) => ({ ...prev, [group.key]: group.requestedQty }));
                                                        }
                                                    }}
                                                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)]"
                                                >
                                                    <option value="approved">Approved</option>
                                                    <option value="rejected">Rejected</option>
                                                </select>
                                            </div>
                                            <div className="col-span-12 md:col-span-3">
                                                <label className="text-xs text-slate-500">Can Provide</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={group.requestedQty}
                                                    disabled={(releasingStatusByGroup[group.key] ?? 'approved') === 'rejected'}
                                                    value={releasingProvidedByGroup[group.key] ?? group.requestedQty}
                                                    onChange={(event) => setReleasingProvidedByGroup((prev) => ({
                                                        ...prev,
                                                        [group.key]: Math.max(0, Math.min(group.requestedQty, Number(event.target.value || 0))),
                                                    }))}
                                                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)]"
                                                />
                                            </div>
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
