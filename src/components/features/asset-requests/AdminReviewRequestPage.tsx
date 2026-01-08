'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    CheckCircle,
    XCircle,
    Loader2,
    AlertTriangle,
    Calendar,
    FileText,
    Users,
    Save
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import assetIssuanceAPI from '@/lib/api/assetIssuance';
import { AssetRequest, AssetRequestDetail, EndUser } from '@/types/assetIssuance';
import { Department } from '@/types/masterData';
import { SignatureModal } from '@/components/ui/SignatureModal';

interface AdminReviewRequestPageProps {
    baseRoute: string;
}

type ReviewItemData = AssetRequestDetail;

export function AdminReviewRequestPage({ baseRoute }: AdminReviewRequestPageProps) {
    const router = useRouter();
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [request, setRequest] = useState<AssetRequest | null>(null);
    const [reviewItems, setReviewItems] = useState<ReviewItemData[]>([]);
    const [endUsers, setEndUsers] = useState<EndUser[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [generalReviewNotes, setGeneralReviewNotes] = useState('');

    // Signature states
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [approverSignature, setApproverSignature] = useState<string | null>(null);
    const [approverSignatureSource, setApproverSignatureSource] = useState<'canvas' | 'upload' | null>(null);

    const loadRequest = useCallback(async () => {
        try {
            setLoading(true);
            const id = params.id as string;
            const requestData = await assetIssuanceAPI.requests.getById(parseInt(id));
            setRequest(requestData);

            // Initialize review items with existing data from assignments
            if (requestData.details) {
                setReviewItems(requestData.details.map(detail => {
                    // Find the latest request assignment
                    const latestRequestAssignment = detail.assignments
                        ?.filter(a => a.AssignmentType === 'request')
                        ?.sort((a, b) => new Date(b.AssignedAt).getTime() - new Date(a.AssignedAt).getTime())[0];

                    return {
                        ...detail,
                        PropertyClassification: latestRequestAssignment?.PropertyClassification || detail.PropertyClassification as 'ICS' | 'PAR' || null,
                        AssignedEndUserID: latestRequestAssignment?.AssignedUserID || detail.AssignedEndUserID || null,
                        AssignedDepartmentID: latestRequestAssignment?.AssignedDepartmentID || detail.AssignedDepartmentID || null,
                        AdminNotes: latestRequestAssignment?.AdminNotes || detail.AdminNotes || null
                    };
                }));
            }
        } catch (error: any) {
            console.error('Failed to load request:', error);

            let errorMessage = 'Failed to load asset request';
            if (error?.response?.status === 404) {
                errorMessage = 'Asset request not found';
            } else if (error?.response?.status === 403) {
                errorMessage = 'You do not have permission to view this request';
            } else if (error?.response?.status >= 500) {
                errorMessage = 'Server error. Please try again later.';
            } else if (error?.message?.includes('syntax error')) {
                errorMessage = 'Server configuration error. Please contact administrator.';
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        loadRequest();
        loadMasterData();
    }, [loadRequest]);

    const loadMasterData = async () => {
        try {
            // Load end users and departments
            const [endUsersResponse, departmentsResponse] = await Promise.all([
                assetIssuanceAPI.requests.getEndUsers(),
                assetIssuanceAPI.requests.getDepartments()
            ]);

            setEndUsers(endUsersResponse);
            setDepartments(departmentsResponse);
        } catch (error) {
            console.error('Failed to load master data:', error);
            toast.error('Failed to load required data');
        }
    };

    const updateReviewItem = (index: number, field: keyof ReviewItemData, value: string | number | null) => {
        setReviewItems(prev => prev.map((item, i) => {
            if (i === index) {
                const updatedItem = { ...item, [field]: value };

                // REAL GSO WORKFLOW LOGIC
                if (field === 'PropertyClassification') {
                    if (value === 'ICS') {
                        // ICS = Office property, auto-assign to requesting department
                        updatedItem.AssignedDepartmentID = request?.DepartmentID || null;
                        // Auto-assign to the requester (not department head)
                        updatedItem.AssignedEndUserID = request?.RequestedBy || null;
                    } else if (value === 'PAR') {
                        // PAR = Personal property, clear department assignment
                        updatedItem.AssignedDepartmentID = null;
                        // Clear end user for manual text input
                        updatedItem.AssignedEndUserID = null;
                    }
                }

                return updatedItem;
            }
            return item;
        }));
    };

    const handleSaveReview = async () => {
        try {
            setSaving(true);

            // Validation
            for (const [index, item] of reviewItems.entries()) {
                if (!item.PropertyClassification) {
                    toast.error(`Please assign property classification for item ${index + 1}`);
                    return;
                }

                if (item.PropertyClassification === 'PAR' && !item.IntendedEndUser?.trim()) {
                    toast.error(`PAR items must have an individual name (Item ${index + 1})`);
                    return;
                }

                if (item.PropertyClassification === 'ICS' && !item.AssignedEndUserID) {
                    // Auto-assign to requester if not set
                    item.AssignedEndUserID = request?.RequestedBy || null;
                    if (!item.AssignedEndUserID) {
                        toast.error(`Cannot auto-assign ICS item to requester (Item ${index + 1})`);
                        return;
                    }
                }
            }

            // Save review data
            const reviewData = {
                details: reviewItems.map(item => ({
                    RequestDetailID: item.RequestDetailID,
                    PropertyClassification: item.PropertyClassification,
                    AssignedEndUserID: item.AssignedEndUserID,
                    AssignedDepartmentID: item.AssignedDepartmentID,
                    AdminNotes: item.AdminNotes
                })),
                ReviewNotes: generalReviewNotes
            };

            const id = params.id as string;
            await assetIssuanceAPI.requests.saveReview(parseInt(id), reviewData);
            toast.success('Review data saved successfully');
            router.push('/admin/asset-requests');
        } catch (error) {
            console.error('Failed to save review:', error);
            toast.error('Failed to save review data');
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async () => {
        if (!approverSignature || !approverSignatureSource) {
            toast.error('Please provide your signature to approve this request');
            return;
        }

        try {
            setSaving(true);
            const reviewData = {
                details: reviewItems.map(item => ({
                    RequestDetailID: item.RequestDetailID,
                    PropertyClassification: item.PropertyClassification,
                    AssignedEndUserID: item.AssignedEndUserID,
                    AssignedDepartmentID: item.AssignedDepartmentID,
                    AdminNotes: item.AdminNotes
                })),
                ReviewNotes: generalReviewNotes,
                approverSignature,
                approverSignatureSource: approverSignatureSource as 'canvas' | 'upload',
            };
            const id = params.id as string;
            await assetIssuanceAPI.requests.approve(parseInt(id), reviewData);
            toast.success('Asset request approved successfully');
            router.push('/admin/asset-requests');
        } catch (error) {
            console.error('Failed to approve request:', error);
            toast.error('Failed to approve request');
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async () => {
        try {
            if (!generalReviewNotes.trim()) {
                toast.error('Please provide rejection reason in review notes');
                return;
            }

            setSaving(true);
            const reviewData = {
                details: reviewItems.map(item => ({
                    RequestDetailID: item.RequestDetailID,
                    PropertyClassification: item.PropertyClassification,
                    AssignedEndUserID: item.AssignedEndUserID,
                    AssignedDepartmentID: item.AssignedDepartmentID,
                    AdminNotes: item.AdminNotes
                })),
                ReviewNotes: generalReviewNotes
            };
            const id = params.id as string;
            await assetIssuanceAPI.requests.reject(parseInt(id), reviewData);
            toast.success('Asset request rejected');
            router.push('/admin/asset-requests');
        } catch (error) {
            console.error('Failed to reject request:', error);
            toast.error('Failed to reject request');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
                <div className="p-6 max-w-6xl mx-auto">
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
                    </div>
                </div>
            </div>
        );
    }

    if (!request) {
        return (
            <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
                <div className="p-6 max-w-6xl mx-auto">
                    <div className="text-center py-12">
                        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">Request Not Found</h2>
                        <p className="text-slate-600">The requested asset request could not be found.</p>
                    </div>
                </div>
            </div>
        );
    }

    const formatDate = (dateString: string) => {
        try {
            const date = toZonedTime(new Date(dateString), 'Asia/Manila');
            return format(date, 'MMM d, yyyy h:mm a');
        } catch {
            return 'Invalid date';
        }
    };

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        type="button"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Review Asset Request</h1>
                        <p className="text-slate-500 text-sm">Review and assign accountability for requested items</p>
                    </div>
                </div>

                {/* Request Header Info */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-slate-600" />
                            <div>
                                <p className="text-sm font-medium text-slate-700">Request Number</p>
                                <p className="text-slate-900">{request.RequestNumber}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-slate-600" />
                            <div>
                                <p className="text-sm font-medium text-slate-700">Request Date</p>
                                <p className="text-slate-900">{formatDate(request.RequestDate)}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-slate-600" />
                            <div>
                                <p className="text-sm font-medium text-slate-700">Requested By</p>
                                <p className="text-slate-900">{request.requester?.FullName || 'Unknown User'}</p>
                                <p className="text-sm text-slate-500">{request.department?.DepartmentName || 'Unknown Department'}</p>
                            </div>
                        </div>
                    </div>

                    {request.Purpose && (
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <h3 className="text-sm font-medium text-slate-700 mb-2">General Purpose</h3>
                            <p className="text-slate-900 bg-slate-50 p-4 rounded-lg">{request.Purpose}</p>
                        </div>
                    )}
                </div>

                {/* REAL GSO WORKFLOW GUIDE */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-blue-600" />
                        REAL GSO Property Classification Guide
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-semibold text-blue-800 mb-2">📋 PAR (Property Accountability Record)</h4>
                            <ul className="text-sm text-blue-700 space-y-1">
                                <li>• Personal items assigned to INDIVIDUALS</li>
                                <li>• Examples: Laptops, phones, vehicles, tools</li>
                                <li>• Individual is personally accountable</li>
                                <li>• Must select specific person</li>
                            </ul>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h4 className="font-semibold text-green-800 mb-2">🏢 ICS (Inventory Custodian Slip)</h4>
                            <ul className="text-sm text-green-700 space-y-1">
                                <li>• Office property assigned to DEPARTMENTS</li>
                                <li>• Examples: Furniture, printers, office equipment</li>
                                <li>• <strong>Department head is the custodian</strong></li>
                                <li>• Auto-assigned to requesting department + dept head</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Items Review */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-6">Items Review & Assignment</h2>

                    <div className="space-y-6">
                        {reviewItems.map((item, index) => (
                            <div key={item.RequestDetailID} className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="font-semibold text-slate-600 bg-slate-200 px-2 py-1 rounded text-sm">
                                        Item #{index + 1}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">Item Description</p>
                                        <p className="text-slate-900">{item.ItemDescription}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">Quantity</p>
                                        <p className="text-slate-900">{item.QuantityRequested} {item.Unit}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">Intended End User</p>
                                        <p className="text-slate-900">{item.IntendedEndUser || 'Not specified'}</p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="text-sm font-medium text-slate-700 mb-2">Purpose</p>
                                    <p className="text-slate-900 bg-white p-3 rounded border">{item.Purpose}</p>
                                </div>

                                {item.AdditionalNotes && (
                                    <div className="mb-4">
                                        <p className="text-sm font-medium text-slate-700 mb-2">Additional Notes</p>
                                        <p className="text-slate-600 bg-white p-3 rounded border">{item.AdditionalNotes}</p>
                                    </div>
                                )}

                                {/* Admin Assignment Section */}
                                <div className="border-t border-slate-200 pt-4 mt-4">
                                    <h4 className="font-medium text-slate-900 mb-4">Admin Assignment</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">
                                                Property Classification <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={item.PropertyClassification || ''}
                                                onChange={(e) => updateReviewItem(index, 'PropertyClassification', e.target.value as 'ICS' | 'PAR')}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                            >
                                                <option value="">Select Classification</option>
                                                <option value="ICS">ICS (Department Accountability)</option>
                                                <option value="PAR">PAR (Individual Accountability)</option>
                                            </select>
                                            <p className="text-xs text-slate-500">
                                                ICS: Semi-expendable items for department use. PAR: Non-expendable items for individual use.
                                            </p>
                                        </div>

                                        {item.PropertyClassification === 'PAR' && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Assign to Individual <span className="text-red-500">*</span>
                                                    <span className="text-xs text-blue-600 ml-2">(PAR = Personal property for individual use)</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={item.IntendedEndUser || ''}
                                                    onChange={(e) => updateReviewItem(index, 'IntendedEndUser', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                                    placeholder="Enter individual's full name..."
                                                />
                                                <p className="text-xs text-blue-600">
                                                    Type the full name of the person who will be accountable for this item
                                                </p>
                                            </div>
                                        )}

                                        {item.PropertyClassification === 'ICS' && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Assigned to Requester <span className="text-red-500">*</span>
                                                    <span className="text-xs text-green-600 ml-2">(ICS = Auto-assigned to requester)</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={request?.requester?.FullName || 'Requester'}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-green-50 text-green-800 font-medium cursor-not-allowed"
                                                    readOnly
                                                    title="ICS items are automatically assigned to the person who requested them"
                                                />
                                                <p className="text-xs text-green-600">
                                                    🔒 Auto-assigned to requester (ICS policy)
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Admin Notes</label>
                                        <textarea
                                            value={item.AdminNotes || ''}
                                            onChange={(e) => updateReviewItem(index, 'AdminNotes', e.target.value)}
                                            rows={2}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                                            placeholder="Any additional notes for this item..."
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* General Review Notes */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">General Review Notes</h3>
                    <textarea
                        value={generalReviewNotes}
                        onChange={(e) => setGeneralReviewNotes(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                        placeholder="Overall comments about this request..."
                    />
                </div>

                {/* Approver Signature */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Approver Signature</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Your Signature <span className="text-red-500">*</span>
                            </label>
                            {approverSignature ? (
                                <div className="space-y-2">
                                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                        <img
                                            src={approverSignature}
                                            alt="Your signature"
                                            className="max-h-20 max-w-full object-contain"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowSignatureModal(true)}
                                            className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded"
                                        >
                                            Change Signature
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setApproverSignature(null);
                                                setApproverSignatureSource(null);
                                            }}
                                            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowSignatureModal(true)}
                                    className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-400 transition-colors flex items-center justify-center text-slate-500"
                                >
                                    Click to add your signature
                                </button>
                            )}
                            <p className="text-xs text-slate-500 mt-1">
                                Your signature is required to approve this asset request.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Back to List
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSaveReview}
                            disabled={saving}
                            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            <Save className="h-4 w-4" />
                            Save Review
                        </button>

                        <button
                            type="button"
                            onClick={handleReject}
                            disabled={saving}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            <XCircle className="h-4 w-4" />
                            Reject Request
                        </button>

                        <button
                            type="button"
                            onClick={handleApprove}
                            disabled={saving}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            <CheckCircle className="h-4 w-4" />
                            Approve Request
                        </button>
                    </div>
                </div>

                {/* Signature Modal */}
                <SignatureModal
                    open={showSignatureModal}
                    onOpenChange={setShowSignatureModal}
                    onSave={(dataUrl, source) => {
                        setApproverSignature(dataUrl);
                        setApproverSignatureSource(source);
                    }}
                    loading={saving}
                />
            </div>
        </div>
    );
}