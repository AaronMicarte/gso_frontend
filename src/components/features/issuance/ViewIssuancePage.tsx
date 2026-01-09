'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import issuanceAPI from '@/lib/api/issuance';
import { AssetIssuance, AcknowledgeAssetData } from '@/types/assetIssuance';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { SignatureModal } from '@/components/ui/SignatureModal';
import * as DialogPrimitive from "@radix-ui/react-dialog";
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

function AcknowledgmentSignatureViewer({ url }: { url: string }) {
    const [src, setSrc] = React.useState(url);
    const [failed, setFailed] = React.useState(false);

    return (
        <>
            <DialogPrimitive.Description className="sr-only">Acknowledgment signature preview</DialogPrimitive.Description>
            <div className="flex justify-center">
                {!failed ? (
                    <img
                        src={src}
                        alt="Acknowledgment signature"
                        width={400}
                        height={120}
                        className="object-contain border rounded"
                        onError={() => setFailed(true)}
                    />
                ) : (
                    <div className="w-full max-w-md border rounded p-4 text-center">
                        <p className="text-slate-700">Signature could not be loaded.</p>
                        <a href={src} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-[var(--primary)] underline">
                            Open / download signature
                        </a>
                    </div>
                )}
            </div>
        </>
    );
}

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
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [showSignatureViewer, setShowSignatureViewer] = useState(false);
    const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('');

    const issuanceId = params?.id ? parseInt(params.id as string) : null;

    const loadIssuance = useCallback(async () => {
        if (!issuanceId) return;

        try {
            setLoading(true);
            const data = await issuanceAPI.getById(issuanceId);
            setIssuance(data);
        } catch (error) {
            console.error('Failed to load issuance:', error);
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
        } catch (error) {
            console.error('Failed to download document:', error);
            toast.error('Failed to download document');
        }
    };

    const handleAcknowledgeSignature = async (signatureData: string) => {
        if (!issuance) return;

        try {
            setIsAcknowledging(true);
            const acknowledgmentData: AcknowledgeAssetData = {
                signature: signatureData,
                notes: acknowledgmentNotes || undefined
            };

            await issuanceAPI.acknowledge(issuance.IssuanceID, acknowledgmentData);
            toast.success('Asset acknowledged successfully!');
            setShowSignatureModal(false);
            setAcknowledgmentNotes(''); // Clear notes
            loadIssuance(); // Reload to get updated data
        } catch (error) {
            console.error('Failed to acknowledge asset:', error);
            toast.error('Failed to acknowledge asset');
        } finally {
            setIsAcknowledging(false);
        }
    };

    const canAcknowledge = () => {
        return issuance &&
            issuance.Status === 'pending_acknowledgment' &&
            user &&
            user.UserID === issuance.IssuedTo;
    };

    const canViewDetails = () => {
        return user && (
            user.UserRoleID === 1 || // Admin
            user.UserID === issuance?.IssuedBy || // Issuer
            user.UserID === issuance?.IssuedTo // Recipient
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                    <span className="ml-3 text-gray-600">Loading issuance details...</span>
                </div>
            </div>
        );
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
    const issuanceDate = issuance.IssuanceDate
        ? toZonedTime(new Date(issuance.IssuanceDate), 'Asia/Manila')
        : new Date(); // Fallback to current date if null

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
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
                            className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Download {issuance.DocumentType}
                        </button>
                        {canAcknowledge() && (
                            <div className="space-y-3">
                                <div>
                                    <label htmlFor="acknowledgment-notes" className="block text-sm font-medium text-gray-700 mb-2">
                                        Optional Notes for Acknowledgment
                                    </label>
                                    <textarea
                                        id="acknowledgment-notes"
                                        rows={3}
                                        className="shadow-sm focus:ring-[var(--primary)] focus:border-[var(--primary)] block w-full sm:text-sm border-gray-300 rounded-md"
                                        placeholder="Enter any notes about receiving this asset..."
                                        value={acknowledgmentNotes}
                                        onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={() => setShowSignatureModal(true)}
                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Acknowledge Receipt
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
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property No.</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {issuance.details?.map((detail, index) => (
                                        <tr key={detail.IssuanceDetailID || index}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{detail.QuantityIssued}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{detail.inventoryDetail?.unitOfMeasure?.UnitName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                <div className="font-medium">{detail.inventoryDetail?.propertyInventory?.ItemDescription}</div>
                                                <div className="text-gray-500 text-xs mt-1">
                                                    {detail.inventoryDetail?.propertyInventory?.Brand && `Brand: ${detail.inventoryDetail.propertyInventory.Brand} `}
                                                    {detail.inventoryDetail?.propertyInventory?.ModelNumber && `Model: ${detail.inventoryDetail.propertyInventory.ModelNumber} `}
                                                    {detail.inventoryDetail?.propertyInventory?.SerialNumber && `SN: ${detail.inventoryDetail.propertyInventory.SerialNumber}`}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                                {detail.inventoryDetail?.PropertyNumber || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {detail.inventoryDetail?.UnitCost ? `₱${Number(detail.inventoryDetail.UnitCost).toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                {detail.inventoryDetail?.UnitCost ? `₱${(Number(detail.inventoryDetail.UnitCost) * detail.QuantityIssued).toLocaleString()}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!issuance.details || issuance.details.length === 0) && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-4 text-sm text-gray-500 text-center">No items found in this issuance.</td>
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
                                {issuance.AcknowledgedBy && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Acknowledged By</label>
                                        <p className="mt-1 text-sm text-gray-900">{issuance.acknowledger?.FullName}</p>
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

                            {issuance.AcknowledgmentSignature && (
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Signature</label>
                                    <button
                                        onClick={() => setShowSignatureViewer(true)}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        View Signature
                                    </button>
                                </div>
                            )}

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

                {/* Request Information */}
                {issuance.request && (
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Original Request</h3>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
                            </div>
                        </div>
                    </div>
                )}

                {/* Signature Modal for Acknowledgment */}
                <SignatureModal
                    open={showSignatureModal}
                    onOpenChange={setShowSignatureModal}
                    onSave={(signatureData) => handleAcknowledgeSignature(signatureData)}
                    loading={isAcknowledging}
                />

                {/* Signature Viewer */}
                {issuance.signature_url && (
                    <DialogPrimitive.Root open={showSignatureViewer} onOpenChange={setShowSignatureViewer}>
                        <DialogPrimitive.Portal>
                            <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
                            <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
                                <div className="flex justify-between items-center mb-4">
                                    <DialogPrimitive.Title className="text-lg font-medium">Acknowledgment Signature</DialogPrimitive.Title>
                                    <DialogPrimitive.Close className="text-gray-400 hover:text-gray-600">
                                        <span className="sr-only">Close</span>
                                        ✕
                                    </DialogPrimitive.Close>
                                </div>
                                <AcknowledgmentSignatureViewer url={issuance.signature_url} />
                            </DialogPrimitive.Content>
                        </DialogPrimitive.Portal>
                    </DialogPrimitive.Root>
                )}
            </div>
        </div>
    );
}