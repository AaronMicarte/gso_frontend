'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Package,
    FileText,
    Download,
    CheckCircle,
    Clock,
    AlertCircle,
    Archive
} from 'lucide-react';
import { PropertySticker } from '../inventory/PropertySticker';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import issuanceAPI from '@/lib/api/issuance';
import { AssetIssuance, AcknowledgeAssetData, InventoryDetail } from '@/types/assetIssuance';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import React from 'react';

const statusConfig = {
    pending_acknowledgment: {
        label: 'Pending Acknowledgment',
        color: 'bg-yellow-100 text-yellow-800',
        bgColor: 'bg-yellow-50',
        icon: Clock
    },
    acknowledged: {
        label: 'Acknowledged',
        color: 'bg-green-100 text-green-800',
        bgColor: 'bg-green-50',
        icon: CheckCircle
    },
    returned: {
        label: 'Returned',
        color: 'bg-blue-100 text-blue-800',
        bgColor: 'bg-blue-50',
        icon: AlertCircle
    },
    disposed: {
        label: 'Disposed',
        color: 'bg-gray-100 text-gray-800',
        bgColor: 'bg-gray-50',
        icon: Archive
    },
};

const documentTypeConfig = {
    PAR: {
        label: 'PAR',
        color: 'bg-purple-100 text-purple-800',
        fullName: 'Property Acknowledgment Receipt'
    },
    ICS: {
        label: 'ICS',
        color: 'bg-indigo-100 text-indigo-800',
        fullName: 'Inventory Custodian Slip'
    },
};

interface ViewIssuancePageProps {
    baseRoute: string;
}

export function ViewIssuancePage({ baseRoute }: ViewIssuancePageProps) {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [issuance, setIssuance] = useState<AssetIssuance | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAcknowledging, setIsAcknowledging] = useState(false);
    const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('');

    const issuanceId = params?.id ? parseInt(params.id as string) : null;

    const loadIssuance = useCallback(async () => {
        if (!issuanceId) return;

        try {
            setLoading(true);
            const data = await issuanceAPI.getById(issuanceId);
            setIssuance(data);
        } catch {
            toast.error('Failed to load asset issuance');
            router.push(baseRoute);
        } finally {
            setLoading(false);
        }
    }, [issuanceId, router, baseRoute]);

    useEffect(() => {
        if (issuanceId) {
            loadIssuance();
        }
    }, [issuanceId, loadIssuance]);

    const handleDownloadDocument = async () => {
        if (!issuance) return;
        if (issuance.Status === 'pending_acknowledgment') {
            toast.error('Document is available after receipt is acknowledged');
            return;
        }

        try {
            const blob = await issuanceAPI.generateDocument(issuance.IssuanceID, issuance.DocumentType);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${issuance.DocumentNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success(`Downloaded ${issuance.DocumentNumber}`);
        } catch {
            toast.error('Failed to download document');
        }
    };

    const handleOpenPrintView = () => {
        if (!issuance) return;
        if (issuance.Status === 'pending_acknowledgment') {
            toast.error('Printable document is available after receipt is acknowledged');
            return;
        }

        router.push(`${baseRoute}/${issuance.IssuanceID}/print`);
    };

    type InventoryDetailWithPropertyName = InventoryDetail & { PropertyName?: string };

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

    const getRecipientUserId = (): number | null => {
        if (!issuance) return null;

        // Real-life GSO flow (per project spec): issuance acknowledgment is by the requester / department head.
        // Even if an end-user is encoded for assignment, the receiving accountability signature is from the requester.
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
            setAcknowledgmentNotes(''); // Clear notes
            loadIssuance(); // Reload to get updated data
        } catch {
            toast.error('Failed to acknowledge asset');
        } finally {
            setIsAcknowledging(false);
        }
    };

    const canAcknowledge = () => {
        const recipientUserId = getRecipientUserId();
        return issuance &&
            issuance.Status === 'pending_acknowledgment' &&
            user &&
            user.UserRoleID !== 1 &&
            ((recipientUserId && user.UserID === recipientUserId) || (!recipientUserId && canAcknowledgeDepartment()));
    };

    const canViewDetails = () => {
        // Allow any authenticated user to view issuance details so staff can access print views.
        return Boolean(user);
    };


    const canShowQr = issuance?.Status !== 'pending_acknowledgment';

    if (loading) {
        return null;
    }

    if (!issuance || !canViewDetails()) {
        return (
            <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Issuance not found</h3>
                <p className="mt-1 text-sm text-gray-500">
                    The requested asset issuance could not be found or you don&apos;t have permission to view it.
                </p>
                <div className="mt-6">
                    <Link
                        href={baseRoute}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                    >
                        Back to Issuances
                    </Link>
                </div>
            </div>
        );
    }

    const StatusIcon = statusConfig[issuance.Status]?.icon || Clock;
    const statusInfo = statusConfig[issuance.Status] || {
        label: issuance.Status || 'Unknown',
        color: 'bg-gray-100 text-gray-800',
        bgColor: 'bg-gray-50',
        icon: Clock
    };
    const docInfo = documentTypeConfig[issuance.DocumentType] || {
        label: issuance.DocumentType || 'Unknown',
        color: 'bg-gray-100 text-gray-800',
        fullName: 'Unknown Document Type'
    };
    const linkedRis = issuance.request?.ris ?? null;
    const issuanceDate = issuance.IssuanceDate
        ? toZonedTime(new Date(issuance.IssuanceDate), 'Asia/Manila')
        : new Date(); // Fallback to current date if null

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <Link
                            href={baseRoute}
                            className="mr-4 inline-flex items-center text-sm text-slate-600 hover:text-slate-800"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back to Issuances
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{issuance.DocumentNumber}</h1>
                            <p className="mt-1 text-sm text-slate-500">
                                {docInfo.fullName} Details
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleDownloadDocument}
                            disabled={!canShowQr}
                            className={`inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] ${canShowQr
                                ? 'text-slate-700 hover:bg-slate-50'
                                : 'text-slate-400 cursor-not-allowed opacity-70'
                                }`}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Download {issuance.DocumentType}
                        </button>

                        <button
                            onClick={handleOpenPrintView}
                            disabled={!canShowQr}
                            className={`inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] ${canShowQr
                                ? 'text-slate-700 hover:bg-slate-50'
                                : 'text-slate-400 cursor-not-allowed opacity-70'
                                }`}
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            Open PAR/ICS print view
                        </button>
                        {canAcknowledge() && (
                            <div className="space-y-3">
                                <div>
                                    <label htmlFor="acknowledgment-notes" className="block text-sm font-medium text-gray-700 mb-2">
                                        Optional Notes
                                    </label>
                                    <textarea
                                        id="acknowledgment-notes"
                                        rows={3}
                                        className="shadow-sm focus:ring-[var(--primary)] focus:border-[var(--primary)] block w-full sm:text-sm border-gray-300 rounded-md"
                                        placeholder="Enter notes about receiving this asset..."
                                        value={acknowledgmentNotes}
                                        onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleAcknowledge}
                                    disabled={isAcknowledging}
                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Mark Received
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Banner */}
                <div className={`${statusInfo.bgColor} border-l-4 border-${statusInfo.color.split('-')[1]}-400 p-4`}>
                    <div className="flex items-center">
                        <StatusIcon className={`h-5 w-5 ${statusInfo.color.replace('bg-', 'text-').replace('-100', '-600')}`} />
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                                Status: {statusInfo.label}
                            </p>
                            {issuance.Status === 'pending_acknowledgment' && canAcknowledge() && (
                                <p className="text-sm text-gray-600 mt-1">
                                    Please acknowledge receipt of this asset by clicking the &ldquo;Acknowledge Receipt&rdquo; button above.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Document Information */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Document Information</h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Document Type</label>
                                <div className="mt-1 flex items-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${docInfo.color}`}>
                                        {docInfo.label}
                                    </span>
                                    <span className="ml-2 text-sm text-gray-600">{docInfo.fullName}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Document Number</label>
                                <p className="mt-1 text-sm text-gray-900">{issuance.DocumentNumber}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Issue Date</label>
                                <p className="mt-1 text-sm text-gray-900">{format(issuanceDate, 'PPPp')}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Issued By</label>
                                <p className="mt-1 text-sm text-gray-900">{issuance.issuer?.FullName}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Issued Items */}
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Issued Items</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Article</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property No.</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty × Unit Cost</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {aggregatedDetails.map((entry, index) => {
                                        const firstDetail = entry.details[0];
                                        const inv = firstDetail?.inventoryDetail;
                                        const propertyNumbers = Array.from(entry.propertyNumbers);
                                        const propertyNumber = entry.propertyNumbers.size === 1 ? propertyNumbers[0] : 'Multiple';
                                        const canShowSingleQr = entry.details.length === 1 && canShowQr && inv?.PropertyNumber && inv?.InventoryID;

                                        return (
                                            <tr key={entry.key || index}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                    {entry.itemName}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                    <div className="font-medium">{entry.description}</div>
                                                    <div className="text-gray-500 text-xs mt-1">
                                                        {entry.brand && `Brand: ${entry.brand} `}
                                                        {entry.model && `Model: ${entry.model} `}
                                                        {entry.serial && `SN: ${entry.serial}`}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                                    {entry.details.length > 1 ? (
                                                        <details>
                                                            <summary className="cursor-pointer select-none text-gray-900">
                                                                Multiple ({propertyNumbers.length})
                                                            </summary>
                                                            <div className="mt-2 space-y-1 text-xs text-gray-600">
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
                                                        propertyNumber || 'N/A'
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {entry.unitCost !== null
                                                        ? `${entry.quantity} ${entry.unitName || ''} × ₱${entry.unitCost.toLocaleString()}`.trim()
                                                        : `${entry.quantity} ${entry.unitName || ''} × -`.trim()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                    {entry.unitCost !== null ? `₱${entry.totalCost.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    {canShowSingleQr && !!inv.PropertyNumber && (
                                                        <PropertySticker
                                                            propertyNumber={inv.PropertyNumber}
                                                            itemName={inv?.propertyInventory?.ItemName || inv?.propertyInventory?.ItemDescription || 'Asset'}
                                                            category={
                                                                // Prefer the InventoryDetail -> PropertyType name (true category)
                                                                inv?.propertyType?.PropertyName ||
                                                                // Fallback to its classification name
                                                                inv?.propertyType?.propertyClassification?.ClassificationName ||
                                                                // Some backend responses include a flattened PropertyName on the inventory detail
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
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {aggregatedDetails.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-4 text-sm text-gray-500 text-center">No items found in this issuance.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Recipient Information */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recipient Information</h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Issued To</label>
                                <p className="mt-1 text-sm text-gray-900">{issuance.issuedToUser?.FullName}</p>
                            </div>
                            {issuance.issuedToUser?.department && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Department</label>
                                    <p className="mt-1 text-sm text-gray-900">{issuance.issuedToUser.department.DepartmentName}</p>
                                </div>
                            )}
                            {issuance.issuedToUser?.Email && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email</label>
                                    <p className="mt-1 text-sm text-gray-900">{issuance.issuedToUser.Email}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Issuance Notes */}
                {issuance.IssuanceNotes && (
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Issuance Notes</h3>
                            <div className="bg-gray-50 p-4 rounded-md">
                                <p className="text-sm text-gray-900">{issuance.IssuanceNotes}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Acknowledgment Information */}
                {issuance.Status !== 'pending_acknowledgment' && (
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Acknowledgment Information</h3>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                {issuance.acknowledger?.FullName && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Acknowledged By</label>
                                        <p className="mt-1 text-sm text-gray-900">{issuance.acknowledger.FullName}</p>
                                    </div>
                                )}
                                {issuance.AcknowledgedAt && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Acknowledged Date</label>
                                        <p className="mt-1 text-sm text-gray-900">
                                            {format(toZonedTime(new Date(issuance.AcknowledgedAt), 'Asia/Manila'), 'PPPp')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {issuance.AcknowledgmentNotes && (
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700">Acknowledgment Notes</label>
                                    <div className="mt-1 bg-green-50 p-4 rounded-md">
                                        <p className="text-sm text-gray-900">{issuance.AcknowledgmentNotes}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Source Information */}
                {(issuance.request || issuance.deliveryReceipt) && (
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                {issuance.request ? 'Original Request' : 'Delivery Receipt'}
                            </h3>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                {issuance.request ? (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Request Number</label>
                                            <p className="mt-1 text-sm text-gray-900">{issuance.request.RequestNumber}</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Request Date</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {issuance.request.RequestDate
                                                    ? format(toZonedTime(new Date(issuance.request.RequestDate), 'Asia/Manila'), 'PPP')
                                                    : 'N/A'
                                                }
                                            </p>
                                        </div>
                                        {issuance.request.Purpose && (
                                            <div className="sm:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700">Purpose</label>
                                                <p className="mt-1 text-sm text-gray-900">{issuance.request.Purpose}</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">DR Number</label>
                                            <p className="mt-1 text-sm text-gray-900">{issuance.deliveryReceipt?.DRNumber || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Date Received</label>
                                            <p className="mt-1 text-sm text-gray-900">
                                                {issuance.deliveryReceipt?.DateReceived
                                                    ? format(toZonedTime(new Date(issuance.deliveryReceipt.DateReceived), 'Asia/Manila'), 'PPP')
                                                    : 'N/A'
                                                }
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Requested By</label>
                                            <p className="mt-1 text-sm text-gray-900">{issuance.deliveryReceipt?.RequestedBy || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Department</label>
                                            <p className="mt-1 text-sm text-gray-900">{issuance.deliveryReceipt?.DepartmentName || 'N/A'}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Linked RIS */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">RIS Information</h3>
                        {linkedRis ? (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">RIS Number</label>
                                    <p className="mt-1 text-sm text-gray-900">{linkedRis.ris_number}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">RIS Status</label>
                                    <p className="mt-1 text-sm text-gray-900 capitalize">{linkedRis.status.replace(/_/g, ' ')}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">RIS Items</label>
                                    <p className="mt-1 text-sm text-gray-900">{linkedRis.items?.length ?? 0} line item(s)</p>
                                </div>
                                <div className="sm:col-span-2 flex flex-wrap gap-3">
                                    {user?.UserRoleID === 1 ? (
                                        <>
                                            <Link
                                                href={`/admin/ris/${linkedRis.id}`}
                                                className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md bg-white text-slate-700 hover:bg-slate-50"
                                            >
                                                View RIS
                                            </Link>
                                            <Link
                                                href={`/admin/ris/${linkedRis.id}/print`}
                                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                                            >
                                                Print RIS
                                            </Link>
                                        </>
                                    ) : (
                                        <span className="inline-flex items-center px-4 py-2 rounded-md border border-slate-200 bg-slate-50 text-slate-500 text-sm">
                                            RIS is available in the admin module
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : issuance.request ? (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                This issuance was created from an approved request, but no RIS is linked yet. Prepare the RIS first so it appears here.
                            </div>
                        ) : (
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                                This issuance came from a delivery receipt acknowledgment flow, so it does not have a request-based RIS record.
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}