'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    ArrowLeft,
    CheckCircle,
    XCircle,
    Loader2,
    AlertTriangle,
    Calendar,
    FileText,
    Users,
    Save,
    Search,
    Package
} from 'lucide-react';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { AxiosError } from 'axios';
import assetIssuanceAPI from '@/lib/api/assetIssuance';
import { prepareRis } from '@/lib/api/ris';
import { AssetRequest, AssetRequestDetail, EndUser } from '@/types/assetIssuance';
import { Department } from '@/types/masterData';
import { SignatureModal } from '@/components/ui/SignatureModal';
import { Dialog as ConfirmDialog } from '@/components/ui/Dialog';

const risPrepareSchema = z.object({
    ris_date: z.string().min(1, 'RIS date is required'),
    entity_name: z.string().min(1, 'Entity name is required'),
    fund_cluster: z.string().min(1, 'Fund cluster is required'),
    division: z.string().min(1, 'Division is required'),
    responsibility_center_code: z.string().min(1, 'Responsibility center code is required'),
    remarks: z.string().optional(),
});

type RisPrepareFormValues = z.infer<typeof risPrepareSchema>;

interface InventoryItem {
    InventoryDetailID: number;
    Description?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    PropertyNumber?: string | null;
    SerialNumber?: string | null;
    UnitCost?: number | null;
    QuantityAvailable?: number | null;
    PropertyName?: string | null;
    UnitName?: string | null;
    dr_item_description?: string | null;
    InventoryNumber?: string | null;
    DateReceived?: string | null;
    PropertyStatusID?: number | null;
    StatusName?: string | null;
}

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

    // Inventory modal states
    const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);
    const [inventorySearch, setInventorySearch] = useState('');
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [inventoryLoading, setInventoryLoading] = useState(false);

    // Signature states
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [approverSignature, setApproverSignature] = useState<string | null>(null);
    const [approverSignatureSource, setApproverSignatureSource] = useState<'canvas' | 'upload' | null>(null);

    // Rejection modal states
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Prepare RIS modal states
    const [showPrepareRisDialog, setShowPrepareRisDialog] = useState(false);
    const [isPreparingRis, setIsPreparingRis] = useState(false);

    const {
        register: registerRis,
        handleSubmit: handleSubmitRis,
        reset: resetRisForm,
        formState: { errors: risErrors },
    } = useForm<RisPrepareFormValues>({
        resolver: zodResolver(risPrepareSchema),
        defaultValues: {
            ris_date: format(toZonedTime(new Date(), 'Asia/Manila'), 'yyyy-MM-dd'),
            entity_name: 'CITY GOVERNMENT OF EL SALVADOR',
            fund_cluster: 'GENERAL FUND',
            division: '',
            responsibility_center_code: '',
            remarks: '',
        },
    });

    const loadRequest = useCallback(async () => {
        try {
            setLoading(true);
            const id = params.id as string;
            const requestData = await assetIssuanceAPI.requests.getById(parseInt(id));
            setRequest(requestData);

            const requestDepartmentId = requestData.DepartmentID ?? null;

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
                        AssignedDepartmentID: (
                            latestRequestAssignment?.AssignedDepartmentID ||
                            detail.AssignedDepartmentID ||
                            requestDepartmentId ||
                            null
                        ),
                        AdminNotes: latestRequestAssignment?.AdminNotes || detail.AdminNotes || null,
                        IsApprovedForIssuance: Boolean(detail.IsApprovedForIssuance)
                    };
                }));
            }
        } catch (error) {
            let errorMessage = 'Failed to load asset request';
            if (error instanceof AxiosError && error.response?.status === 404) {
                errorMessage = 'Asset request not found';
            } else if (error instanceof AxiosError && error.response?.status === 403) {
                errorMessage = 'You do not have permission to view this request';
            } else if (error instanceof AxiosError && error.response?.status && error.response.status >= 500) {
                errorMessage = 'Server error. Please try again later.';
            } else if (error instanceof Error && error?.message?.includes('syntax error')) {
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
            toast.error('Failed to load required data');
        }
    };

    const updateReviewItem = (index: number, field: keyof ReviewItemData, value: string | number | null | boolean) => {
        setReviewItems(prev => prev.map((item, i) => {
            if (i === index) {
                const updatedItem = { ...item, [field]: value };

                const departmentEndUserId = request?.DepartmentID
                    ? (endUsers.find(eu => eu.DepartmentID === request.DepartmentID)?.EndUserID ?? null)
                    : null;

                // REAL GSO WORKFLOW LOGIC
                if (field === 'PropertyClassification') {
                    if (value === 'ICS') {
                        // ICS = Office property, auto-assign to requesting department
                        updatedItem.AssignedDepartmentID = request?.DepartmentID || null;
                        // IMPORTANT: AssignedEndUserID must reference `enduser.EndUserID` (NOT `user.UserID`).
                        // Prefer a department-level EndUser record if present; otherwise require manual selection.
                        updatedItem.AssignedEndUserID = departmentEndUserId;
                    } else if (value === 'PAR') {
                        // PAR = Personal property, still belongs to the requesting department for accountability grouping
                        updatedItem.AssignedDepartmentID = request?.DepartmentID || null;
                        // Clear end user for manual text input
                        updatedItem.AssignedEndUserID = null;
                    }
                }

                return updatedItem;
            }
            return item;
        }));
    };

    const openInventoryModal = async () => {
        try {
            setInventoryLoading(true);
            const items = await assetIssuanceAPI.requests.getAvailableInventory();
            setAvailableInventory(items || []);
            setShowInventoryModal(true);
        } catch (err: unknown) {
            const maybeAxios = err as { response?: { data?: { error?: string; message?: string } } };
            const serverMessage = maybeAxios?.response?.data?.error || maybeAxios?.response?.data?.message;
            toast.error(serverMessage ? `Failed to load inventory: ${serverMessage}` : 'Failed to load available inventory');
        } finally {
            setInventoryLoading(false);
        }
    };

    const handleSaveReview = async () => {
        try {
            setSaving(true);

            const departmentEndUserId = request?.DepartmentID
                ? (endUsers.find(eu => eu.DepartmentID === request.DepartmentID)?.EndUserID ?? null)
                : null;

            // Validation
            for (const [index, item] of reviewItems.entries()) {
                if (!item.IsApprovedForIssuance) {
                    continue;
                }

                // Only validate classification rules for items approved for issuance
                if (!item.IsApprovedForIssuance) {
                    continue;
                }

                if (!item.PropertyClassification) {
                    toast.error(`Please assign property classification for item ${index + 1}`);
                    return;
                }

                if (item.PropertyClassification === 'PAR' && !item.IntendedEndUser?.trim()) {
                    toast.error(`PAR items must have an individual name (Item ${index + 1})`);
                    return;
                }

                if (item.PropertyClassification === 'ICS' && !item.AssignedEndUserID) {
                    if (departmentEndUserId) {
                        toast.error(`Please select the ICS recipient End User (Item ${index + 1})`);
                    } else {
                        toast.error(`No End User record found for this department. Create/select an End User before issuing ICS (Item ${index + 1}).`);
                    }
                    return;
                }
            }

            // Save review data
            const reviewData = {
                details: reviewItems.map(item => ({
                    RequestDetailID: item.RequestDetailID,
                    PropertyClassification: item.IsApprovedForIssuance ? item.PropertyClassification : null,
                    AssignedEndUserID: item.AssignedEndUserID,
                    AssignedDepartmentID: item.AssignedDepartmentID,
                    AdminNotes: item.AdminNotes,
                    IsApprovedForIssuance: Boolean(item.IsApprovedForIssuance)
                })),
                ReviewNotes: generalReviewNotes
            };

            const id = params.id as string;
            await assetIssuanceAPI.requests.saveReview(parseInt(id), reviewData);
            toast.success('Review data saved successfully');
            router.push('/admin/asset-requests');
        } catch (error) {
            toast.error('Failed to save review data');
        } finally {
            setSaving(false);
        }
    };

    const openApproveWithRisDialog = () => {
        if (!approverSignature || !approverSignatureSource) {
            toast.error('Please provide your signature to approve this request');
            return;
        }

        const approvedCount = reviewItems.filter(item => Boolean(item.IsApprovedForIssuance)).length;
        if (approvedCount === 0) {
            toast.error('At least one item must be approved for issuance');
            return;
        }

        // Default RIS header values based on the request.
        resetRisForm({
            ris_date: format(toZonedTime(new Date(), 'Asia/Manila'), 'yyyy-MM-dd'),
            entity_name: 'CITY GOVERNMENT OF EL SALVADOR',
            fund_cluster: 'GENERAL FUND',
            division: request?.department?.DepartmentName || '',
            responsibility_center_code: request?.department?.DepartmentCode || '',
            remarks: '',
        });

        setShowPrepareRisDialog(true);
    };

    const onApproveAndPrepareRis = handleSubmitRis(async (values) => {
        if (!request) return;
        if (!approverSignature || !approverSignatureSource) return;

        try {
            setIsPreparingRis(true);
            setSaving(true);

            const reviewData = {
                details: reviewItems.map(item => ({
                    RequestDetailID: item.RequestDetailID,
                    PropertyClassification: item.IsApprovedForIssuance ? item.PropertyClassification : null,
                    AssignedEndUserID: item.AssignedEndUserID,
                    AssignedDepartmentID: item.AssignedDepartmentID,
                    AdminNotes: item.AdminNotes,
                    IsApprovedForIssuance: Boolean(item.IsApprovedForIssuance),
                })),

                ReviewNotes: generalReviewNotes,
                approverSignature,
                approverSignatureSource: approverSignatureSource as 'canvas' | 'upload',
            };

            const id = params.id as string;

            // Approve first (RIS preparation requires the request to be approved).
            await assetIssuanceAPI.requests.approve(parseInt(id), reviewData);

            const risDate = format(toZonedTime(new Date(), 'Asia/Manila'), 'yyyy-MM-dd');

            const result = await prepareRis({
                asset_request_id: request.RequestID,
                // enforce server-side: RIS date must be today's date in Asia/Manila timezone
                ris_date: risDate,
                entity_name: values.entity_name.trim(),
                fund_cluster: values.fund_cluster.trim(),
                division: values.division.trim(),
                responsibility_center_code: values.responsibility_center_code.trim(),
                remarks: values.remarks?.trim() ? values.remarks.trim() : undefined,
            });

            toast.success(`Approved & RIS prepared: ${result.ris.ris_number}`);
            setShowPrepareRisDialog(false);
            router.push('/admin/asset-requests');
        } catch (error: unknown) {
            const message = (() => {
                if (typeof error === 'object' && error && 'response' in error) {
                    const resp = (error as { response?: { data?: { message?: string } } }).response;
                    if (resp?.data?.message) return resp.data.message;
                }
                if (typeof error === 'object' && error && 'message' in error) {
                    const msg = (error as { message?: unknown }).message;
                    if (typeof msg === 'string' && msg.trim()) return msg;
                }
                return 'Failed to approve request / prepare RIS';
            })();
            toast.error(message);
        } finally {
            setSaving(false);
            setIsPreparingRis(false);
        }
    });

    const handleReject = () => {
        setShowRejectModal(true);
    };

    const handleConfirmReject = async () => {
        if (!rejectionReason.trim()) {
            toast.error('Please provide a rejection reason');
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
                    AdminNotes: item.AdminNotes,
                    IsApprovedForIssuance: Boolean(item.IsApprovedForIssuance)
                })),
                ReviewNotes: rejectionReason
            };
            const id = params.id as string;
            await assetIssuanceAPI.requests.reject(parseInt(id), reviewData);
            toast.success('Asset request rejected');
            router.push('/admin/asset-requests');
        } catch (error) {
            toast.error('Failed to reject request');
        } finally {
            setSaving(false);
            setShowRejectModal(false);
            setRejectionReason('');
        }
    };

    if (loading) {
        return null;
    }

    if (!request) {
        return (
            <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
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

    const filteredInventory = availableInventory.filter((item) => {
        if (!inventorySearch) return true;
        const search = inventorySearch.toLowerCase();
        return (
            (item.Description?.toLowerCase() || '').includes(search) ||
            (item.Brand?.toLowerCase() || '').includes(search) ||
            (item.ModelNumber?.toLowerCase() || '').includes(search) ||
            (item.PropertyNumber?.toLowerCase() || '').includes(search) ||
            (item.SerialNumber?.toLowerCase() || '').includes(search) ||
            (item.dr_item_description?.toLowerCase() || '').includes(search) ||
            (item.InventoryNumber?.toLowerCase() || '').includes(search)
        );
    });

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
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

                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={openInventoryModal}
                            disabled={inventoryLoading}
                            aria-busy={inventoryLoading}
                            aria-disabled={inventoryLoading}
                            className={`px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-2 ${inventoryLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {inventoryLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Search className="w-4 h-4" />
                            )}
                            <span className={inventoryLoading ? 'opacity-80' : ''}>
                                View Available Inventory
                            </span>
                        </button>
                        <p className="text-xs text-slate-500">
                            Use this to check if items are currently available before approving them.
                        </p>
                    </div>

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

                                    <div className="mb-4 flex items-center gap-3">
                                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(item.IsApprovedForIssuance)}
                                                onChange={(e) => updateReviewItem(index, 'IsApprovedForIssuance', e.target.checked)}
                                                className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]/20"
                                            />
                                            Approved for Issuance (available now)
                                        </label>
                                        <span className="text-xs text-slate-500">Only checked items will appear in the RIS.</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {item.IsApprovedForIssuance ? (
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
                                        ) : (
                                            <div className="text-sm text-slate-500">Not approved for issuance</div>
                                        )}

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
                                                    disabled={!item.IsApprovedForIssuance}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 disabled:opacity-60 disabled:cursor-not-allowed"
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
                                        <p className="text-xs text-slate-500 mt-1">Admin notes are editable regardless of approval — use for internal comments.</p>
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
                            onClick={openApproveWithRisDialog}
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

                {/* Prepare RIS (on Approve) */}
                <ConfirmDialog
                    title="Prepare RIS"
                    description="Fill out required RIS header fields. This is required before issuing."
                    open={showPrepareRisDialog}
                    onOpenChange={setShowPrepareRisDialog}
                    onConfirm={onApproveAndPrepareRis}
                    confirmText="Approve & Prepare RIS"
                    loading={saving || isPreparingRis}
                    contentClassName="max-w-2xl"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">RIS Date *</label>
                            <input
                                type="date"
                                {...registerRis('ris_date')}
                                readOnly
                                aria-readonly="true"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-700 cursor-not-allowed"
                            />
                            {risErrors.ris_date && <p className="mt-1 text-sm text-red-600">{risErrors.ris_date.message}</p>}
                            <p className="text-xs text-slate-500 mt-1">RIS date is locked to today (Asia/Manila).</p>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Entity Name *</label>
                            <input
                                type="text"
                                {...registerRis('entity_name')}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                            {risErrors.entity_name && <p className="mt-1 text-sm text-red-600">{risErrors.entity_name.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Fund Cluster *</label>
                            <input
                                type="text"
                                {...registerRis('fund_cluster')}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                            {risErrors.fund_cluster && <p className="mt-1 text-sm text-red-600">{risErrors.fund_cluster.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Responsibility Center Code *</label>
                            <input
                                type="text"
                                {...registerRis('responsibility_center_code')}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                            {risErrors.responsibility_center_code && <p className="mt-1 text-sm text-red-600">{risErrors.responsibility_center_code.message}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Division *</label>
                            <input
                                type="text"
                                {...registerRis('division')}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                            {risErrors.division && <p className="mt-1 text-sm text-red-600">{risErrors.division.message}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                            <textarea
                                rows={3}
                                {...registerRis('remarks')}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>
                    </div>
                </ConfirmDialog>

                {/* Inventory Modal */}
                <Dialog.Root open={showInventoryModal} onOpenChange={setShowInventoryModal}>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
                        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 space-y-4">
                            <Dialog.Title className="text-lg font-bold text-slate-900">Available Inventory</Dialog.Title>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by description, brand, model, property number..."
                                    value={inventorySearch}
                                    onChange={(e) => setInventorySearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                />
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto border border-slate-200 rounded-lg">
                                {inventoryLoading ? (
                                    <div className="p-6 text-center text-slate-500">
                                        <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                                        Loading inventory...
                                    </div>
                                ) : filteredInventory.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500">
                                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                        No matching inventory items
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-200">
                                        {filteredInventory.map((item) => (
                                            <div key={item.InventoryDetailID} className="p-4 flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-slate-900 truncate">
                                                        {item.dr_item_description || item.PropertyName || 'Unknown Item'}
                                                        {item.PropertyNumber && <span className="text-sm font-normal text-slate-600 ml-2">({item.PropertyNumber})</span>}
                                                    </div>
                                                    <div className="text-sm text-slate-600 mt-1">
                                                        {item.Description && <div className="truncate">{item.Description}</div>}
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                                                            {item.InventoryNumber && <span className="font-medium text-slate-700">Inv: {item.InventoryNumber}</span>}
                                                            {item.Brand && <span>Brand: {item.Brand}</span>}
                                                            {item.ModelNumber && <span>Model: {item.ModelNumber}</span>}
                                                            {item.SerialNumber && <span>Serial: {item.SerialNumber}</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-shrink-0 ml-4 self-center">
                                                    {typeof item.QuantityAvailable === 'number' && item.QuantityAvailable > 0 ? (
                                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-800 text-xs font-medium" aria-label="Available">
                                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"></path></svg>
                                                            <span>Available</span>
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium" aria-label="Unavailable">
                                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                                                            <span>Unavailable</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end">
                                <Dialog.Close asChild>
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        Close
                                    </button>
                                </Dialog.Close>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>

                {/* Rejection Modal */}
                <Dialog.Root open={showRejectModal} onOpenChange={setShowRejectModal}>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
                        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                            <Dialog.Title className="text-lg font-bold text-slate-900">Reject Asset Request</Dialog.Title>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Rejection Reason <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-vertical min-h-[100px]"
                                        placeholder="Please provide the reason for rejecting this request..."
                                        rows={4}
                                        maxLength={500}
                                        required
                                    />
                                    <div className="text-xs text-slate-500 mt-1">
                                        {rejectionReason.length}/500 characters
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Dialog.Close asChild>
                                        <button
                                            onClick={() => {
                                                setShowRejectModal(false);
                                                setRejectionReason('');
                                            }}
                                            className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </Dialog.Close>
                                    <button
                                        onClick={handleConfirmReject}
                                        disabled={saving || !rejectionReason.trim()}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? 'Rejecting...' : 'Reject Request'}
                                    </button>
                                </div>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            </div>
        </div>
    );
}