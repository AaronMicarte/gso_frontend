'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Package,
    CheckCircle,
    Clock,
    AlertCircle,
    Archive,
    Printer,
    Users,
    Building2,
    FileCheck
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { PropertySticker } from '../inventory/PropertySticker';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import issuanceAPI from '@/lib/api/issuance';
import { AssetIssuance, AcknowledgeAssetData, InventoryDetail } from '@/types/assetIssuance';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import React from 'react';
import AssignReceiversModal, { AssignReceiversModalItem, AssignReceiversSaveResult } from './AssignReceiversModal';

const statusConfig = {
    pending_acknowledgment: {
        label: 'Pending Acknowledgment',
        className: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: Clock
    },
    acknowledged: {
        label: 'Acknowledged',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: CheckCircle
    },
    partially_acknowledged: {
        label: 'Partially Acknowledged',
        className: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        icon: CheckCircle
    },
    returned: {
        label: 'Returned',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: AlertCircle
    },
    disposed: {
        label: 'Disposed',
        className: 'bg-slate-100 text-slate-800 border-slate-200',
        icon: Archive
    },
};

const documentTypeConfig = {
    PAR: {
        label: 'PAR',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        fullName: 'Property Acknowledgment Receipt'
    },
    ICS: {
        label: 'ICS',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        fullName: 'Inventory Custodian Slip'
    },
};

interface ViewIssuancePageProps {
    baseRoute: string;
}

type InventoryDetailWithPropertyName = InventoryDetail & { PropertyName?: string };

export function ViewIssuancePage({ baseRoute }: ViewIssuancePageProps) {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [issuance, setIssuance] = useState<AssetIssuance | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAcknowledging, setIsAcknowledging] = useState(false);
    const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('');
    const [assignments, setAssignments] = useState<Array<{ issuance_detail_id: number; receiver_name: string; position_office?: string }>>([]);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);

    const issuanceId = params?.id ? parseInt(params.id as string) : null;

    const rootIssuanceRoute = useMemo(
        () => baseRoute.replace(/\/documents\/?$/, ''),
        [baseRoute]
    );

    const documentsListRoute = useMemo(
        () => `${rootIssuanceRoute}/documents`,
        [rootIssuanceRoute]
    );

    const loadIssuance = useCallback(async () => {
        if (!issuanceId) return;

        try {
            setLoading(true);
            const data = await issuanceAPI.getById(issuanceId);
            setIssuance(data);

            // Load assignments for this issuance
            try {
                const assignmentsData = await issuanceAPI.getAssignments(issuanceId);
                setAssignments(assignmentsData?.data ?? []);
            } catch {
                setAssignments([]);
            }
        } catch {
            toast.error('Failed to load asset issuance');
            router.push(documentsListRoute);
        } finally {
            setLoading(false);
        }
    }, [issuanceId, router, documentsListRoute]);

    useEffect(() => {
        if (issuanceId) {
            loadIssuance();
        }
    }, [issuanceId, loadIssuance]);

    const assignmentMap = useMemo(() => {
        const map = new Map<number, { name: string; position?: string }>();
        for (const assignment of assignments) {
            if (!map.has(assignment.issuance_detail_id)) {
                map.set(assignment.issuance_detail_id, {
                    name: assignment.receiver_name,
                    position: assignment.position_office || undefined
                });
            }
        }
        return map;
    }, [assignments]);

    const aggregatedDetails = useMemo(() => {
        const details = issuance?.details ?? [];
        const map = new Map<string, {
            key: string;
            itemName: string;
            unitName: string;
            description: string;
            brand: string;
            model: string;
            serial: string;
            unitCost: number | null;
            quantity: number;
            totalCost: number;
            propertyNumbers: Set<string>;
            details: typeof details;
        }>();

        for (const detail of details) {
            const inv = detail.inventoryDetail;
            const prop = inv?.propertyInventory;
            const itemName = prop?.ItemName || detail.ItemDescription || 'Item';
            const description = prop?.ItemDescription || '-';
            const brand = prop?.Brand || '';
            const model = prop?.ModelNumber || '';
            const serial = prop?.SerialNumber || '';
            const unitName = inv?.unitOfMeasure?.UnitName || '';
            const unitCost = inv?.UnitCost !== undefined && inv?.UnitCost !== null ? Number(inv.UnitCost) : null;
            const quantity = detail.QuantityIssued || 0;

            const key = [itemName, brand, model, serial, unitName, unitCost ?? ''].join('|');
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    itemName,
                    unitName,
                    description,
                    brand,
                    model,
                    serial,
                    unitCost,
                    quantity: 0,
                    totalCost: 0,
                    propertyNumbers: new Set<string>(),
                    details: [],
                });
            }

            const entry = map.get(key)!;
            entry.quantity += quantity;
            entry.details.push(detail);
            if (unitCost !== null) {
                entry.totalCost += unitCost * quantity;
            }
            if (inv?.PropertyNumber) {
                entry.propertyNumbers.add(inv.PropertyNumber);
            }
        }

        return Array.from(map.values());
    }, [issuance?.details]);

    const totalIssuanceCost = useMemo(() => {
        return aggregatedDetails.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    }, [aggregatedDetails]);

    const totalItemsCount = useMemo(() => {
        return aggregatedDetails.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }, [aggregatedDetails]);

    const modalItems: AssignReceiversModalItem[] = (issuance?.details || []).map(d => {
        const inv = d.inventoryDetail;
        const prop = inv?.propertyInventory;
        const dr = inv?.drDetail;
        return {
            IssuanceDetailID: d.IssuanceDetailID,
            ItemDescription: prop?.ItemDescription || d.ItemDescription || dr?.ItemDescription || null,
            QuantityIssued: d.QuantityIssued ?? null,
            Article: dr?.article?.ArticleName ?? prop?.ItemName ?? dr?.ItemDescription ?? null,
            Brand: dr?.Brand ?? prop?.Brand ?? null,
            ModelNumber: dr?.ModelNumber ?? prop?.ModelNumber ?? null,
            SerialNumber: dr?.SerialNumber ?? prop?.SerialNumber ?? null,
        };
    });

    const handleAssignSaved = (result: AssignReceiversSaveResult) => {
        setAssignModalOpen(false);
        loadIssuance();
    };

    const getEndUserName = (detail: any): string => {
        if (!detail) return 'N/A';

        const assigned = assignmentMap.get(detail.IssuanceDetailID);
        if (assigned) return assigned.name;

        return issuance?.deliveryReceipt?.DepartmentName || issuance?.request?.department?.DepartmentName || 'N/A';
    };

    const getEndUserPosition = (detail: any): string | undefined => {
        if (!detail) return undefined;

        const assigned = assignmentMap.get(detail.IssuanceDetailID);
        if (assigned?.position) return assigned.position;

        const inv = detail.inventoryDetail as any;
        return inv?.currentBorrowerDepartment || inv?.locationDepartment || issuance?.issuedToUser?.department?.DepartmentName || issuance?.deliveryReceipt?.DepartmentName || issuance?.request?.department?.DepartmentName || undefined;
    };

    const recipientOfficePosition = useMemo(() => {
        const assignedPosition = assignments.find(a => a.position_office?.trim())?.position_office?.trim();
        if (assignedPosition) return assignedPosition;

        const userAny = issuance?.issuedToUser as any;
        if (userAny?.position?.PositionName) return userAny.position.PositionName;
        if (userAny?.Position) return userAny.Position;
        if (userAny?.PositionName) return userAny.PositionName;

        return issuance?.deliveryReceipt?.DepartmentName || issuance?.request?.department?.DepartmentName || issuance?.issuedToUser?.department?.DepartmentName || '—';
    }, [assignments, issuance]);

    const getRecipientUserId = (): number | null => {
        if (!issuance) return null;

        return (
            issuance.request?.RequestedBy ??
            issuance.request?.requester?.UserID ??
            issuance.IssuedTo ??
            issuance.issuedToUser?.UserID ??
            null
        );
    };

    const canAcknowledgeDepartment = () => {
        const departmentId = issuance?.deliveryReceipt?.DepartmentID;
        return Boolean(user && departmentId && user.DepartmentID === departmentId);
    };

    const canAcknowledge = () => {
        const recipientUserId = getRecipientUserId();
        return Boolean(
            issuance &&
            issuance.Status === 'pending_acknowledgment' &&
            user &&
            user.UserRoleID !== 1 &&
            ((recipientUserId && user.UserID === recipientUserId) || (!recipientUserId && canAcknowledgeDepartment()))
        );
    };

    const handleAcknowledge = async () => {
        if (!issuance) return;
        if (!user) {
            toast.error('You must be logged in to acknowledge');
            return;
        }

        const recipientUserId = getRecipientUserId();
        if (recipientUserId && user.UserID !== recipientUserId) {
            toast.error('You are not allowed to acknowledge this issuance');
            return;
        }

        if (!recipientUserId && !canAcknowledgeDepartment()) {
            toast.error('You are not allowed to acknowledge this issuance');
            return;
        }

        try {
            setIsAcknowledging(true);
            const acknowledgmentData: AcknowledgeAssetData = {
                acknowledgment_notes: acknowledgmentNotes || undefined,
                acknowledged_by: user.UserID,
            };

            await issuanceAPI.acknowledge(issuance.IssuanceID, acknowledgmentData);
            toast.success('Asset acknowledged successfully!');
            setAcknowledgmentNotes('');
            setAcknowledgeDialogOpen(false);
            loadIssuance();
        } catch {
            toast.error('Failed to acknowledge asset');
        } finally {
            setIsAcknowledging(false);
        }
    };


    const handleOpenPrintView = () => {
        if (!issuance) return;
        if (issuance.Status === 'pending_acknowledgment') {
            toast.error('Printable document is available after receipt is acknowledged');
            return;
        }

        router.push(`${rootIssuanceRoute}/${issuance.IssuanceID}/print`);
    };

    if (loading) {
        return null;
    }

    if (!issuance) {
        return (
            <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat flex items-center justify-center p-6" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
                <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center max-w-md w-full">
                    <Package className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">Issuance not found</h3>
                    <p className="mt-1 text-sm text-slate-500">
                        The requested asset issuance could not be found or you don&apos;t have permission to view it.
                    </p>
                    <div className="mt-6">
                        <Link
                            href={documentsListRoute}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to PAR & ICS documents
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const statusInfo = statusConfig[issuance.Status as keyof typeof statusConfig] || {
        label: issuance.Status || 'Unknown',
        className: 'bg-slate-100 text-slate-800 border-slate-200',
        icon: Clock
    };
    const StatusIcon = statusInfo.icon;

    const docConfig = documentTypeConfig[issuance.DocumentType as keyof typeof documentTypeConfig] || {
        label: issuance.DocumentType || 'Document',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
        fullName: 'Property Issuance Receipt'
    };

    const issuanceDate = issuance.IssuanceDate
        ? toZonedTime(new Date(issuance.IssuanceDate), 'Asia/Manila')
        : null;

    const canShowQr = issuance.Status !== 'pending_acknowledgment';

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <Link
                            href={documentsListRoute}
                            className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Back to PAR & ICS documents</span>
                        </Link>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                            <h1 className="text-2xl font-bold text-slate-900">{issuance.DocumentNumber}</h1>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${docConfig.badgeClass}`}>
                                {issuance.DocumentType}
                            </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.className}`}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusInfo.label}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setAssignModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium shadow-xs"
                        >
                            <Users className="w-4 h-4" />
                            Assign Receivers
                        </button>

                        <button
                            onClick={handleOpenPrintView}
                            disabled={!canShowQr}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium shadow-xs ${
                                canShowQr
                                    ? 'bg-white hover:bg-slate-50 text-slate-700'
                                    : 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                            }`}
                        >
                            <Printer className="w-4 h-4" />
                            Print {issuance.DocumentType}
                        </button>

                        {canAcknowledge() && (
                            <Dialog.Root open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
                                <Dialog.Trigger asChild>
                                    <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] text-sm font-medium shadow-xs">
                                        <CheckCircle className="w-4 h-4" />
                                        Mark Received
                                    </button>
                                </Dialog.Trigger>
                                <Dialog.Portal>
                                    <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
                                    <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl z-50 space-y-4">
                                        <Dialog.Title className="text-lg font-semibold text-slate-900">
                                            Acknowledge Asset Receipt
                                        </Dialog.Title>
                                        <Dialog.Description className="text-sm text-slate-500">
                                            Confirm that you have physically received and inspected the issued items for {issuance.DocumentNumber}.
                                        </Dialog.Description>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Acknowledgment Notes (Optional)
                                            </label>
                                            <textarea
                                                rows={3}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] focus:outline-none"
                                                placeholder="Enter any observations or notes..."
                                                value={acknowledgmentNotes}
                                                onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <Dialog.Close asChild>
                                                <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                                                    Cancel
                                                </button>
                                            </Dialog.Close>
                                            <button
                                                onClick={handleAcknowledge}
                                                disabled={isAcknowledging}
                                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] disabled:opacity-50"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                {isAcknowledging ? 'Confirming...' : 'Confirm Receipt'}
                                            </button>
                                        </div>
                                    </Dialog.Content>
                                </Dialog.Portal>
                            </Dialog.Root>
                        )}
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Document Information Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <FileCheck className="w-4 h-4 text-slate-500" />
                            <h2 className="text-base font-semibold text-slate-900">Document Information</h2>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Type</div>
                                <div className="text-sm font-medium text-slate-900 mt-1">
                                    {docConfig.fullName} ({issuance.DocumentType})
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Number</div>
                                <div className="text-sm font-semibold text-slate-900 mt-1 font-mono">
                                    {issuance.DocumentNumber}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue Date</div>
                                <div className="text-sm font-medium text-slate-900 mt-1">
                                    {issuanceDate ? format(issuanceDate, 'MMM dd, yyyy h:mm a') : 'Not specified'}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issued By</div>
                                <div className="text-sm font-medium text-slate-900 mt-1">
                                    {issuance.issuer?.FullName || 'GSO Staff'}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quantity</div>
                                <div className="text-sm font-medium text-slate-900 mt-1">
                                    {totalItemsCount} {totalItemsCount === 1 ? 'unit' : 'units'}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Valuation</div>
                                <div className="text-sm font-semibold text-slate-900 mt-1">
                                    {totalIssuanceCost > 0 ? `₱${totalIssuanceCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00'}
                                </div>
                            </div>
                        </div>

                        {issuance.IssuanceNotes && (
                            <div className="pt-2 border-t border-slate-100">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issuance Notes</div>
                                <div className="mt-1 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    {issuance.IssuanceNotes}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Recipient Information Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <Building2 className="w-4 h-4 text-slate-500" />
                            <h2 className="text-base font-semibold text-slate-900">Recipient Information</h2>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Receiving Department</div>
                                <div className="text-sm font-medium text-slate-900 mt-1">
                                    {issuance.deliveryReceipt?.DepartmentName || issuance.request?.department?.DepartmentName || issuance.issuedToUser?.department?.DepartmentName || 'General Services Office'}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accountable Officer</div>
                                <div className="text-sm font-medium text-slate-900 mt-1">
                                    {issuance.issuedToUser?.FullName || issuance.IssuedToName || 'Not recorded'}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Office / Position</div>
                                <div className="text-sm font-medium text-slate-900 mt-1">
                                    {recipientOfficePosition}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    {issuance.Status === 'pending_acknowledgment' ? 'Acknowledgment Status' : 'Acknowledged Date'}
                                </div>
                                <div className="text-sm font-medium text-slate-900 mt-1">
                                    {issuance.Status === 'pending_acknowledgment' ? (
                                        <span className="text-amber-700">Pending</span>
                                    ) : (
                                        <span>
                                            {issuance.AcknowledgedAt ? format(toZonedTime(new Date(issuance.AcknowledgedAt), 'Asia/Manila'), 'MMM dd, yyyy h:mm a') : 'Acknowledged'}
                                            {issuance.acknowledger?.FullName && issuance.acknowledger.FullName !== (issuance.issuedToUser?.FullName || issuance.IssuedToName)
                                                ? ` · by ${issuance.acknowledger.FullName}`
                                                : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {issuance.AcknowledgmentNotes && (
                            <div className="pt-2 border-t border-slate-100">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Acknowledgment Notes</div>
                                <div className="mt-1 text-sm text-emerald-800 bg-emerald-50/70 p-3 rounded-lg border border-emerald-100">
                                    {issuance.AcknowledgmentNotes}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Issued Items Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-500" />
                            <h2 className="text-base font-semibold text-slate-900">Issued Items</h2>
                        </div>
                        <span className="text-xs font-medium text-slate-500">
                            {aggregatedDetails.length} {aggregatedDetails.length === 1 ? 'record' : 'records'} · {totalItemsCount} total units
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Article</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description & Specs</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Property No.</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">End User</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Qty × Unit Cost</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Cost</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {aggregatedDetails.map((entry, index) => {
                                    const firstDetail = entry.details[0];
                                    const inv = firstDetail?.inventoryDetail;
                                    const propertyNumbers = Array.from(entry.propertyNumbers);
                                    const propertyNumber = entry.propertyNumbers.size === 1 ? propertyNumbers[0] : 'Multiple';
                                    const canShowSingleQr = entry.details.length === 1 && canShowQr && inv?.PropertyNumber && inv?.InventoryID;

                                    return (
                                        <tr key={entry.key || index} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                                                {entry.itemName}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-900 max-w-xs">
                                                <div className="font-medium text-slate-900">{entry.description}</div>
                                                {(entry.brand || entry.model || entry.serial) && (
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {[
                                                            entry.brand ? `Brand: ${entry.brand}` : null,
                                                            entry.model ? `Model: ${entry.model}` : null,
                                                            entry.serial ? `SN: ${entry.serial}` : null,
                                                        ].filter(Boolean).join(' · ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-800">
                                                {entry.details.length > 1 ? (
                                                    <details className="cursor-pointer">
                                                        <summary className="select-none text-slate-900 hover:text-[var(--primary)] font-medium">
                                                            Multiple ({propertyNumbers.length})
                                                        </summary>
                                                        <div className="mt-2 space-y-1 text-xs text-slate-600 pl-2 border-l border-slate-200">
                                                            {propertyNumbers.length > 0 ? (
                                                                propertyNumbers.map((number) => (
                                                                    <div key={number}>{number}</div>
                                                                ))
                                                            ) : (
                                                                <div>No property numbers</div>
                                                            )}
                                                        </div>
                                                    </details>
                                                ) : (
                                                    propertyNumber || '—'
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                                {entry.details.length > 0 ? (
                                                    entry.details.length === 1 ? (
                                                        <div>
                                                            <div className="font-medium text-slate-900">{getEndUserName(entry.details[0])}</div>
                                                            {getEndUserPosition(entry.details[0]) && (
                                                                <div className="text-xs text-slate-500 mt-0.5">{getEndUserPosition(entry.details[0])}</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <details className="cursor-pointer">
                                                            <summary className="select-none text-slate-900 hover:text-[var(--primary)] font-medium">
                                                                Multiple ({entry.details.length})
                                                            </summary>
                                                            <div className="mt-2 space-y-1.5 text-xs text-slate-600 pl-2 border-l border-slate-200">
                                                                {entry.details.map((detail, idx) => (
                                                                    <div key={idx}>
                                                                        <div className="font-medium text-slate-900">{getEndUserName(detail)}</div>
                                                                        {getEndUserPosition(detail) && (
                                                                            <div className="text-slate-500">{getEndUserPosition(detail)}</div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    )
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {entry.unitCost !== null
                                                    ? `${entry.quantity} ${entry.unitName || ''} × ₱${entry.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
                                                    : `${entry.quantity} ${entry.unitName || ''} × —`.trim()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                                                {entry.unitCost !== null ? `₱${entry.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                {canShowSingleQr && !!inv?.PropertyNumber && (
                                                    <PropertySticker
                                                        propertyNumber={inv.PropertyNumber}
                                                        itemName={inv?.propertyInventory?.ItemName || inv?.propertyInventory?.ItemDescription || 'Asset'}
                                                        category={
                                                            inv?.propertyType?.PropertyName ||
                                                            inv?.propertyType?.propertyClassification?.ClassificationName ||
                                                            (inv as InventoryDetailWithPropertyName)?.PropertyName ||
                                                            '-'
                                                        }
                                                        url={(() => {
                                                            const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                                            const qrCodeData = (inv as unknown as { qrCode?: { QRCodeData?: string | null } | null }).qrCode?.QRCodeData;
                                                            const match = qrCodeData?.match(/\/qr\/scan\/(\d+)/);
                                                            if (match?.[1]) return `${origin}/qr/scan/${match[1]}`;

                                                            return `${origin}/admin/inventory/${inv.InventoryID}?detail=${inv.InventoryDetailID}`;
                                                        })()}
                                                        custodianName={issuance.IssuedToName || issuance.issuedToUser?.FullName || 'Unassigned'}
                                                        date={issuance.IssuanceDate ? format(toZonedTime(new Date(issuance.IssuanceDate), 'Asia/Manila'), 'MM/dd/yyyy') : '-'}
                                                        unitCost={entry.unitCost !== null ? entry.totalCost : undefined}
                                                        brand={inv?.Brand || entry.brand || ''}
                                                        serialNumber={inv?.SerialNumber || entry.serial || ''}
                                                        modelNumber={inv?.ModelNumber || entry.model || ''}
                                                        endUserName={getEndUserName(firstDetail)}
                                                        currentDepartmentHead={inv?.currentDepartmentHead || ''}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {aggregatedDetails.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                                            No items found in this issuance.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <AssignReceiversModal
                    open={assignModalOpen}
                    onOpenChange={setAssignModalOpen}
                    issuanceId={issuance?.IssuanceID ?? null}
                    documentType={issuance?.DocumentType}
                    items={modalItems}
                    onSaved={handleAssignSaved}
                    onPreparePrintTabs={(assignments, id) => {
                        const grouped = new Map<string, { receiverName: string; receiverOffice: string }>();
                        assignments.forEach((assignment) => {
                            const receiverName = assignment.receiver_name.trim() || 'Receiving Custodian';
                            const receiverOffice = assignment.position_office?.trim() || '';
                            const key = `${receiverName}||${receiverOffice}`;
                            if (!grouped.has(key)) grouped.set(key, { receiverName, receiverOffice });
                        });

                        const groups = Array.from(grouped.values());
                        const baseUrl = `${window.location.origin}${rootIssuanceRoute}/${id}/print`;

                        const docType = issuance?.DocumentType;
                        const baseWithType = docType ? `${baseUrl}?type=${encodeURIComponent(docType)}` : baseUrl;

                        if (groups.length === 1) {
                            const value = encodeURIComponent(JSON.stringify([groups[0].receiverName, groups[0].receiverOffice]));
                            const url = baseWithType.includes('?') ? `${baseWithType}&receiver_key=${value}` : `${baseWithType}?receiver_key=${value}`;
                            const win = window.open('about:blank', '_blank');
                            return { windows: [win], urls: [url] };
                        }

                        const win = window.open('about:blank', '_blank');
                        return { windows: [win], urls: [baseWithType] };
                    }}
                />
            </div>
        </div>
    );
}