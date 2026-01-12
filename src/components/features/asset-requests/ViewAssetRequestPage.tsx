'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, User, Calendar, FileText, Package, Trash2, Loader2, Activity } from 'lucide-react';
import assetIssuanceAPI from '@/lib/api/assetIssuance';
import issuanceAPI from '@/lib/api/issuance';
import { AssetRequest } from '@/types/assetIssuance';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { resolveStorageUrl } from '@/lib/utils/signature';
import { useAuth } from '@/lib/hooks/useAuth';
import { SignatureModal } from '@/components/ui/SignatureModal';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
    issued: { label: 'Issued', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    received: { label: 'Received', color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
    cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
};

interface ViewAssetRequestPageProps {
    baseRoute: string;
    canCancel?: boolean;
    isAdmin?: boolean;
}

export function ViewAssetRequestPage({ baseRoute, canCancel = false, isAdmin = false }: ViewAssetRequestPageProps) {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const [request, setRequest] = useState<AssetRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [receiving, setReceiving] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('');

    useEffect(() => {
        loadRequest();
    }, [params.id]);

    const loadRequest = async () => {
        try {
            setLoading(true);
            const id = params.id as string;
            const response = await assetIssuanceAPI.requests.getById(parseInt(id));
            setRequest(response);
        } catch (error) {
            let errorMessage = 'Failed to load request details';
            if (error instanceof AxiosError && error.response?.status === 404) {
                errorMessage = 'Asset request not found';
            } else if (error instanceof AxiosError && error.response?.status === 403) {
                errorMessage = 'You do not have permission to view this request';
            } else if (error instanceof AxiosError && error.response?.status && error.response.status >= 500) {
                errorMessage = 'Server error. Please try again later.';
            }

            toast.error(errorMessage);
            router.push(`${baseRoute}/asset-requests`);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!request) return;

        try {
            setCancelling(true);
            await assetIssuanceAPI.requests.cancel(request.RequestID);
            toast.success('Request cancelled successfully');
            setShowCancelDialog(false);
            loadRequest(); // Refresh data
        } catch (error) {
            toast.error('Failed to cancel request');
        } finally {
            setCancelling(false);
        }
    };

    const handleConfirmReceipt = async (signatureDataUrl: string) => {
        if (!request) return;
        if (!user) {
            toast.error('You must be logged in to confirm receipt');
            return;
        }

        const pendingIssuances = (request.issuances || []).filter(i => i.Status === 'pending_acknowledgment');
        if (pendingIssuances.length === 0) {
            toast.info('No pending issuances to acknowledge');
            return;
        }

        try {
            setReceiving(true);
            await Promise.all(
                pendingIssuances.map((issuance) =>
                    issuanceAPI.acknowledge(issuance.IssuanceID, {
                        acknowledgment_signature: signatureDataUrl,
                        acknowledgment_notes: acknowledgmentNotes || undefined,
                        acknowledged_by: user.UserID,
                    })
                )
            );

            toast.success('Receipt acknowledged successfully');
            setAcknowledgmentNotes('');
            setShowReceiptModal(false);
            loadRequest();
        } catch (error) {
            let errorMessage = 'Failed to confirm receipt';

            if (error instanceof AxiosError) {
                const data = error.response?.data as unknown;
                if (data && typeof data === 'object' && 'message' in data) {
                    const msg = (data as { message?: unknown }).message;
                    if (typeof msg === 'string' && msg.trim() !== '') {
                        errorMessage = msg;
                    }
                }
            } else if (error instanceof Error && error.message.trim() !== '') {
                errorMessage = error.message;
            }

            toast.error(errorMessage);
        } finally {
            setReceiving(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Manila'
        });
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Manila'
        });
    };

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-slate-200 rounded w-64 mb-4"></div>
                    <div className="h-32 bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (!request) {
        return (
            <div className="p-6">
                <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Request not found</h3>
                    <Link href={`${baseRoute}/asset-requests`}>
                        <button className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
                            Back to Requests
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    const statusInfo = statusConfig[request.Status];
    const StatusIcon = statusInfo.icon;

    const isDeptHeadView = baseRoute.startsWith('/department_head');
    const canDeptHeadConfirmReceipt = () => {
        if (!isDeptHeadView) return false;
        if (!user) return false;
        // simplest, real-world check: requester or same department
        return user.UserID === request.RequestedBy || user.DepartmentID === request.DepartmentID;
    };

    const showCancelButton = canCancel && request.Status === 'pending';
    const showReviewButton = isAdmin && request.Status === 'pending';
    const showReceiveButton = request.Status === 'issued' && canDeptHeadConfirmReceipt();
    const hasPendingIssuances = (request.issuances || []).some(i => i.Status === 'pending_acknowledgment');
    const manilaNowLabel = format(toZonedTime(new Date(), 'Asia/Manila'), 'PPPp');
    const issuanceRemarksText = (request.issuances || [])
        .map((i) => {
            const notes = (i.IssuanceNotes || '').trim();
            if (!notes) return null;
            return `${i.DocumentType} ${i.DocumentNumber}: ${notes}`;
        })
        .filter(Boolean)
        .join('\n\n');

    const issuanceItemRemarks = (request.issuances || [])
        .map((i) => {
            const itemLines = (i.details || [])
                .map((d) => {
                    const remarks = (d.Remarks || '').trim();
                    if (!remarks) return null;
                    const label = (d.ItemDescription || `Item ${d.InventoryDetailID ?? ''}`).trim();
                    return `- ${label}: ${remarks}`;
                })
                .filter(Boolean);

            if (itemLines.length === 0) return null;

            return `${i.DocumentType} ${i.DocumentNumber}\n${itemLines.join('\n')}`;
        })
        .filter(Boolean)
        .join('\n\n');

    const requestDetailIssuanceRemarksMap = new Map<number, string[]>();
    (request.issuances || []).forEach((issuance) => {
        (issuance.details || []).forEach((d) => {
            const requestDetailId = d.RequestDetailID;
            if (!requestDetailId) return;
            const remarks = (d.Remarks || '').trim();
            if (!remarks) return;
            const line = `${issuance.DocumentType} ${issuance.DocumentNumber}: ${remarks}`;
            const existing = requestDetailIssuanceRemarksMap.get(requestDetailId) || [];
            existing.push(line);
            requestDetailIssuanceRemarksMap.set(requestDetailId, existing);
        });
    });

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`${baseRoute}/asset-requests`}>
                            <button className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                Back to Requests
                            </button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{request.RequestNumber}</h1>
                            <p className="text-slate-500 text-sm">Asset Request Details</p>
                        </div>
                    </div>
                </div>

                {/* Status and Request Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Status Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="p-6 text-center">
                            <StatusIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <div className="text-sm text-slate-500 mb-1">Status</div>
                            <span className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                                <StatusIcon className="w-4 h-4" />
                                {statusInfo.label}
                            </span>
                        </div>
                    </div>

                    {/* Request Date Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="p-6 text-center">
                            <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <div className="text-sm text-slate-500 mb-1">Request Date</div>
                            <div className="font-medium text-slate-900">{formatDate(request.RequestDate)}</div>
                        </div>
                    </div>

                    {/* Requester Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="p-6 text-center">
                            <User className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <div className="text-sm text-slate-500 mb-1">Requester</div>
                            <div className="font-medium text-slate-900 truncate" title={request.requester?.FullName || 'N/A'}>
                                {request.requester?.FullName || 'N/A'}
                            </div>
                        </div>
                    </div>

                    {/* Department Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="p-6 text-center">
                            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <div className="text-sm text-slate-500 mb-1">Department</div>
                            <div className="font-medium text-slate-900 truncate" title={request.department?.DepartmentName}>
                                {request.department?.DepartmentName}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Request Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Request Summary Card */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className="p-6 border-b border-slate-200">
                                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <FileText className="w-5 h-5" />
                                    Request Summary
                                </h2>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-sm text-slate-500">Total Items</div>
                                        <div className="font-medium text-lg">
                                            {request.details?.length || 0}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-500">Total Quantity</div>
                                        <div className="font-medium text-lg">
                                            {request.details?.reduce((sum, detail) => sum + detail.QuantityRequested, 0) || 0}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-500">Email</div>
                                        <div className="font-medium truncate" title={request.requester?.Email}>
                                            {request.requester?.Email}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-500">Last Updated</div>
                                        <div className="font-medium">{formatDateTime(request.updated_at || request.RequestDate)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Requested Items */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className="p-6 border-b border-slate-200">
                                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <Package className="w-5 h-5" />
                                    Requested Items ({request.details?.length || 0})
                                </h2>
                            </div>
                            <div className="p-6">
                                {request.details && request.details.length > 0 ? (
                                    <div className="space-y-4">
                                        {request.details.map((detail, index) => (
                                            <div key={detail.RequestDetailID} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-slate-900 mb-3 text-lg">
                                                            {detail.inventoryDetail?.propertyInventory?.ItemDescription || detail.ItemDescription}
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                            {detail.inventoryDetail ? (
                                                                <>
                                                                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                                                                        <div className="text-xs text-slate-500 uppercase tracking-wide">Type</div>
                                                                        <div className="font-medium text-slate-900">
                                                                            {detail.inventoryDetail?.propertyType?.PropertyName}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                                                                        <div className="text-xs text-slate-500 uppercase tracking-wide">Condition</div>
                                                                        <div className="font-medium text-slate-900">
                                                                            {detail.inventoryDetail?.condition?.ConditionName}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                                                                        <div className="text-xs text-slate-500 uppercase tracking-wide">Available</div>
                                                                        <div className="font-medium text-slate-900">
                                                                            {detail.inventoryDetail?.QuantityOnHand || 0}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                                                                        <div className="text-xs text-slate-500 uppercase tracking-wide">Requested</div>
                                                                        <div className="font-medium text-slate-900">
                                                                            {detail.QuantityRequested}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                                                                        <div className="text-xs text-slate-500 uppercase tracking-wide">Unit</div>
                                                                        <div className="font-medium text-slate-900">
                                                                            {detail.Unit || 'N/A'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-white p-3 rounded-lg border border-slate-200 md:col-span-3">
                                                                        <div className="text-xs text-slate-500 uppercase tracking-wide">Requested Quantity</div>
                                                                        <div className="font-medium text-slate-900">
                                                                            {detail.QuantityRequested}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="mt-4">
                                                            <div className="text-sm text-slate-500 mb-2 uppercase tracking-wide">Purpose</div>
                                                            <div className="text-sm bg-white p-3 rounded-lg border border-slate-200">
                                                                {detail.Purpose}
                                                            </div>
                                                        </div>

                                                        {/* Item Remarks from Issuance (propertyissuancedetail.Remarks) */}
                                                        <div className="mt-4">
                                                            <div className="text-sm text-slate-500 mb-2 uppercase tracking-wide">Item Remarks (Issuance)</div>
                                                            {request.issuances ? (
                                                                (() => {
                                                                    const lines = requestDetailIssuanceRemarksMap.get(detail.RequestDetailID) || [];
                                                                    return lines.length > 0 ? (
                                                                        <div className="text-sm bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-line">
                                                                            {lines.join('\n')}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-sm text-slate-500">No item remarks.</div>
                                                                    );
                                                                })()
                                                            ) : (
                                                                <div className="text-sm text-slate-500">No issuances loaded for this request.</div>
                                                            )}
                                                        </div>

                                                        {/* Admin Review Section */}
                                                        {(detail.PropertyClassification || detail.AdminNotes) && (
                                                            <div className="mt-4 pt-4 border-t border-slate-300">
                                                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                                                    <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                                                        <CheckCircle className="w-4 h-4" />
                                                                        Admin Review Details
                                                                    </h4>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                        {detail.PropertyClassification && (
                                                                            <div className="bg-white p-3 rounded border border-blue-200">
                                                                                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Property Classification</div>
                                                                                <div className="font-semibold text-blue-900">
                                                                                    {detail.PropertyClassification === 'PAR' ? '📋 PAR (Individual Accountability)' : '🏢 ICS (Department Accountability)'}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {detail.IntendedEndUser && (
                                                                            <div className="bg-white p-3 rounded border border-blue-200">
                                                                                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Assigned To</div>
                                                                                <div className="font-medium text-slate-900">
                                                                                    {detail.IntendedEndUser}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {detail.AdminNotes && (
                                                                        <div className="mt-3">
                                                                            <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Admin Notes</div>
                                                                            <div className="text-sm bg-white p-3 rounded border border-blue-200 text-slate-700">
                                                                                {detail.AdminNotes}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <div className="text-slate-500">No items in this request</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Issuances */}
                        {request.issuances && request.issuances.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="p-6 border-b border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900">Issuances</h2>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-4">
                                        {request.issuances.map((issuance) => (
                                            <div key={issuance.IssuanceID} className="border border-slate-200 rounded-lg p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium">
                                                            {issuance.DocumentType} - {issuance.DocumentNumber}
                                                        </div>
                                                        <div className="text-sm text-slate-500">
                                                            Issued to: {issuance.issuedToUser?.FullName}
                                                        </div>
                                                    </div>
                                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                                        {issuance.Status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Issuance Information */}
                        {(request.IssuedBy || request.IssuedAt || request.issuances) && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50">
                                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-purple-600" />
                                        Issuance Information
                                    </h3>
                                </div>
                                <div className="p-6 space-y-4">
                                    {request.issuer && (
                                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                            <div className="text-sm text-purple-700 font-medium mb-1">Issued By</div>
                                            <div className="font-semibold text-slate-900">{request.issuer.FullName}</div>
                                        </div>
                                    )}
                                    {request.IssuedAt && (
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                            <div className="text-sm text-blue-700 font-medium mb-1">Issued At</div>
                                            <div className="font-semibold text-slate-900">{formatDateTime(request.IssuedAt)}</div>
                                        </div>
                                    )}

                                    {/* Issue Notes (Property Issuance.Remarks) */}
                                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-300">
                                        <div className="text-sm text-amber-800 font-semibold mb-2 flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            Issue Notes
                                        </div>
                                        {issuanceRemarksText ? (
                                            <div className="text-sm text-slate-800 bg-white p-4 rounded border border-amber-200 leading-relaxed whitespace-pre-line">
                                                {issuanceRemarksText}
                                            </div>
                                        ) : request.issuances ? (
                                            <div className="text-sm text-slate-500">
                                                {request.issuances.length > 0 ? 'No issue notes.' : 'No issuances yet.'}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500">No issuances loaded for this request.</div>
                                        )}
                                    </div>

                                    {/* Item Remarks (Property Issuance Detail.Remarks) */}
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                        <div className="text-sm text-slate-800 font-semibold mb-2 flex items-center gap-2">
                                            <Package className="w-4 h-4" />
                                            Item Remarks
                                        </div>
                                        {issuanceItemRemarks ? (
                                            <div className="text-sm text-slate-800 bg-white p-4 rounded border border-slate-200 leading-relaxed whitespace-pre-line">
                                                {issuanceItemRemarks}
                                            </div>
                                        ) : request.issuances ? (
                                            <div className="text-sm text-slate-500">
                                                {request.issuances.length > 0 ? 'No item remarks.' : 'No issuances yet.'}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500">No issuances loaded for this request.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Review Information */}
                        {(request.ReviewedBy || request.ReviewedAt) && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-green-50">
                                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        Admin Review Information
                                    </h3>
                                </div>
                                <div className="p-6 space-y-4">
                                    {request.reviewer && (
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                            <div className="text-sm text-blue-700 font-medium mb-1">Reviewed By</div>
                                            <div className="font-semibold text-slate-900">
                                                {request.reviewer.FullName}
                                            </div>
                                        </div>
                                    )}
                                    {request.ReviewedAt && (
                                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                            <div className="text-sm text-green-700 font-medium mb-1">Reviewed At</div>
                                            <div className="font-semibold text-slate-900">{formatDateTime(request.ReviewedAt)}</div>
                                        </div>
                                    )}
                                    {request.ReviewNotes && (
                                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-300">
                                            <div className="text-sm text-amber-800 font-semibold mb-2 flex items-center gap-2">
                                                <FileText className="w-4 h-4" />
                                                General Review Notes
                                            </div>
                                            <div className="text-sm text-slate-800 bg-white p-4 rounded border border-amber-200 leading-relaxed">
                                                {request.ReviewNotes}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Signatures */}
                        {((request.signatures && request.signatures.length > 0) || (request.issuances && request.issuances.some(i => i.AcknowledgmentSignature))) && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-purple-600" />
                                        Signatures ({(request.signatures?.length || 0) + (request.issuances?.filter(i => i.AcknowledgmentSignature).length || 0)})
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-4">
                                        {/* Request Signatures */}
                                        {request.signatures && request.signatures.map((signature) => (
                                            <div key={signature.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-slate-900 capitalize mb-2">
                                                            {signature.role.replace('_', ' ')} Signature
                                                        </div>
                                                        <div className="text-sm text-slate-600 mb-3">
                                                            Signed by {signature.signedByUser?.FullName} on {formatDateTime(signature.created_at)}
                                                        </div>
                                                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                                                            <img
                                                                src={resolveStorageUrl(signature.url)}
                                                                alt={`${signature.role} signature`}
                                                                className="max-w-full h-auto max-h-32 object-contain"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Acknowledgment Signatures */}
                                        {request.issuances && request.issuances
                                            .filter(i => i.AcknowledgmentSignature)
                                            .map((issuance) => (
                                                <div key={`ack-${issuance.IssuanceID}`} className="border border-slate-200 rounded-lg p-4 bg-green-50/30">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-slate-900 mb-2">
                                                                Acknowledgment Signature - {issuance.DocumentType} {issuance.DocumentNumber}
                                                            </div>
                                                            <div className="text-sm text-slate-600 mb-3">
                                                                Signed by {issuance.acknowledger?.FullName || 'Unknown'} on {issuance.AcknowledgedAt ? formatDateTime(issuance.AcknowledgedAt) : 'Unknown date'}
                                                            </div>
                                                            {issuance.AcknowledgmentNotes && (
                                                                <div className="mb-3 p-3 bg-white rounded border border-green-200">
                                                                    <div className="text-xs text-green-700 font-medium mb-1">Acknowledgment Notes</div>
                                                                    <div className="text-sm text-slate-700">{issuance.AcknowledgmentNotes}</div>
                                                                </div>
                                                            )}
                                                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                                                                <img
                                                                    src={resolveStorageUrl(issuance.AcknowledgmentSignature)}
                                                                    alt="Acknowledgment signature"
                                                                    className="max-w-full h-auto max-h-32 object-contain"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}



                        {/* Audit Logs */}
                        {request.auditLogs && request.auditLogs.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="p-6 border-b border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                        <Activity className="w-5 h-5" />
                                        Activity Log ({request.auditLogs.length})
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-4 max-h-96 overflow-y-auto">
                                        {request.auditLogs.map((log) => (
                                            <div key={log.AuditID} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-slate-900">{log.Action}</div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        by {log.performer?.FullName} • {formatDateTime(log.CreatedAt)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className="p-6 border-b border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
                            </div>
                            <div className="p-6 space-y-3">
                                <Link href={`${baseRoute}/asset-requests`}>
                                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                                        <ArrowLeft className="w-4 h-4" />
                                        Back to Requests
                                    </button>
                                </Link>
                                {showReviewButton && (
                                    <Link href={`${baseRoute}/asset-requests/${params.id}/review`}>
                                        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
                                            <CheckCircle className="w-4 h-4" />
                                            Review Request
                                        </button>
                                    </Link>
                                )}
                                {showReceiveButton && (
                                    <button
                                        onClick={() => setShowReceiptModal(true)}
                                        disabled={receiving}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                                    >
                                        {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                                        {receiving ? 'Confirming...' : 'Confirm Receipt'}
                                    </button>
                                )}
                                {showCancelButton && (
                                    <button
                                        onClick={() => setShowCancelDialog(true)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Cancel Request
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cancel Dialog */}
                {showCancelDialog && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Cancel Asset Request</h3>
                            <p className="text-slate-600 mb-6">
                                Are you sure you want to cancel this asset request? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCancelDialog(false)}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    Keep Request
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={cancelling}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {cancelling ? 'Cancelling...' : 'Cancel Request'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <SignatureModal
                    open={showReceiptModal}
                    onOpenChange={setShowReceiptModal}
                    loading={receiving}
                    confirmText="Confirm Receipt"
                    confirmPrompt="Confirm your signature to acknowledge receipt?"
                    preContent={
                        <div className="space-y-4 pb-6 border-b border-slate-200">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                                <div className="text-slate-600 font-medium mb-1">Acknowledged At (Manila)</div>
                                <div className="font-semibold text-slate-900">{manilaNowLabel}</div>
                            </div>
                            <div>
                                <label htmlFor="acknowledgment-notes" className="block text-sm font-medium text-slate-700 mb-2">
                                    Acknowledgment Notes (optional)
                                </label>
                                <textarea
                                    id="acknowledgment-notes"
                                    rows={4}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                                    placeholder="Enter notes about receiving these assets..."
                                    value={acknowledgmentNotes}
                                    onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                                />
                                {!hasPendingIssuances && (
                                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                        No pending issuances to acknowledge for this request (it may already be acknowledged).
                                    </div>
                                )}
                            </div>
                        </div>
                    }
                    onSave={(signatureDataUrl) => handleConfirmReceipt(signatureDataUrl)}
                />
            </div>
        </div>
    );
}