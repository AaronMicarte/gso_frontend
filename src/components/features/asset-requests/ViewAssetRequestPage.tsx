'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, User, Calendar, FileText, Package, Trash2, Loader2 } from 'lucide-react';
import assetIssuanceAPI from '@/lib/api/assetIssuance';
import { AssetRequest } from '@/types/assetIssuance';
import { toast } from 'sonner';

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
    issued: { label: 'Issued', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
};

interface ViewAssetRequestPageProps {
    baseRoute: string;
    requestId: string;
    canCancel?: boolean;
}

export function ViewAssetRequestPage({ baseRoute, requestId, canCancel = false }: ViewAssetRequestPageProps) {
    const router = useRouter();
    const [request, setRequest] = useState<AssetRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);

    useEffect(() => {
        loadRequest();
    }, [requestId]);

    const loadRequest = async () => {
        try {
            setLoading(true);
            const response = await assetIssuanceAPI.requests.getById(parseInt(requestId));
            setRequest(response);
        } catch (error) {
            toast.error('Failed to load request details');
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
    const showCancelButton = canCancel && request.Status === 'pending';

    return (
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

                {showCancelButton && (
                    <button
                        onClick={() => setShowCancelDialog(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Cancel Request
                    </button>
                )}
            </div>

            {/* Status Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <StatusIcon className="w-6 h-6 text-slate-400" />
                            <div>
                                <div className="text-sm text-slate-500">Status</div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                    <StatusIcon className="w-3 h-3" />
                                    {statusInfo.label}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-slate-500">Request Date</div>
                            <div className="font-medium">{formatDate(request.RequestDate)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Request Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Requester Info */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="p-6 border-b border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Requester Information
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm text-slate-500">Name</div>
                                    <div className="font-medium">
                                        {request.requester?.FirstName} {request.requester?.LastName}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500">Email</div>
                                    <div className="font-medium">{request.requester?.Email}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500">Department</div>
                                    <div className="font-medium">{request.department?.DepartmentName}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500">Request Date</div>
                                    <div className="font-medium">{formatDate(request.RequestDate)}</div>
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
                            <div className="space-y-4">
                                {request.details?.map((detail, index) => (
                                    <div key={detail.RequestDetailID} className="border border-slate-200 rounded-lg p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="font-medium text-slate-900 mb-2">
                                                    {detail.inventoryDetail?.propertyInventory?.ItemDescription || detail.ItemDescription}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                    {detail.inventoryDetail ? (
                                                        <>
                                                            <div>
                                                                <span className="text-slate-500">Type:</span>
                                                                <span className="ml-2 font-medium">
                                                                    {detail.inventoryDetail?.propertyType?.PropertyTypeName}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-500">Condition:</span>
                                                                <span className="ml-2 font-medium">
                                                                    {detail.inventoryDetail?.condition?.ConditionName}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-500">Available:</span>
                                                                <span className="ml-2 font-medium">
                                                                    {detail.inventoryDetail?.QuantityOnHand || 0}
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div>
                                                            <span className="text-slate-500">Unit:</span>
                                                            <span className="ml-2 font-medium">
                                                                {detail.Unit || 'N/A'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-slate-500">Quantity:</span>
                                                        <span className="ml-2 font-medium">
                                                            {detail.QuantityRequested}
                                                        </span>
                                                    </div>
                                                </div>
                                                <hr className="my-3 border-slate-200" />
                                                <div>
                                                    <div className="text-sm text-slate-500 mb-1">Purpose:</div>
                                                    <div className="text-sm bg-slate-50 p-3 rounded">
                                                        {detail.Purpose}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )) || (
                                        <div className="text-center py-4 text-slate-500">
                                            No items in this request
                                        </div>
                                    )}
                            </div>
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
                                                        Issued to: {issuance.issuedToUser?.FirstName} {issuance.issuedToUser?.LastName}
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
                    {/* Review Information */}
                    {(request.ReviewedBy || request.ReviewedAt) && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className="p-6 border-b border-slate-200">
                                <h2 className="text-lg font-semibold text-slate-900">Review Information</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                {request.reviewer && (
                                    <div>
                                        <div className="text-sm text-slate-500">Reviewed By</div>
                                        <div className="font-medium">
                                            {request.reviewer.FirstName} {request.reviewer.LastName}
                                        </div>
                                    </div>
                                )}
                                {request.ReviewedAt && (
                                    <div>
                                        <div className="text-sm text-slate-500">Reviewed At</div>
                                        <div className="font-medium">{formatDateTime(request.ReviewedAt)}</div>
                                    </div>
                                )}
                                {request.ReviewNotes && (
                                    <div>
                                        <div className="text-sm text-slate-500">Review Notes</div>
                                        <div className="text-sm bg-slate-50 p-3 rounded mt-1">
                                            {request.ReviewNotes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Audit Logs */}
                    {request.auditLogs && request.auditLogs.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className="p-6 border-b border-slate-200">
                                <h2 className="text-lg font-semibold text-slate-900">Activity Log</h2>
                            </div>
                            <div className="p-6">
                                <div className="space-y-3">
                                    {request.auditLogs.map((log) => (
                                        <div key={log.AuditID} className="flex gap-3">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">{log.Action}</div>
                                                <div className="text-xs text-slate-500">
                                                    by {log.performer?.FirstName} {log.performer?.LastName} • {formatDateTime(log.CreatedAt)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Cancel Dialog */}
            {showCancelDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
        </div>
    );
}