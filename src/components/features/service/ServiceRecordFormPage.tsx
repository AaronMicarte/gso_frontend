'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import serviceApi from '@/lib/api/assetServices';
import {
    AssetServiceBudgetStatus,
    AssetServiceHandlingDecision,
    AssetServiceReportSource,
    AssetServiceStatus,
    ServiceHelperDepartment,
    ServiceHelperEndUser,
    ServiceHelperVendor,
    ServiceInventoryItem,
} from '@/types/assetService';

interface ServiceRecordFormPageProps {
    baseRoute: string;
    recordId?: number;
}

interface ServiceDetailFormState {
    localId: string;
    service_record_detail_id?: number;
    inventory_detail_id: number | '';
    problem_description: string;
    handling_decision: AssetServiceHandlingDecision | '';
    budget_status: AssetServiceBudgetStatus;
    status: AssetServiceStatus;
    assigned_vendor_id: number | '';
    estimated_cost: string;
    actual_cost: string;
    warranty_covered: boolean;
    warranty_outcome: string;
    completion_notes: string;
    verification_notes: string;
}

const STATUS_OPTIONS: AssetServiceStatus[] = [
    'pending',
    'under_review',
    'work_approved',
    'repair_in_progress',
    'verification',
    'closed',
    'unrepairable',
];

const REPORT_SOURCES: AssetServiceReportSource[] = ['cce_user', 'inventory_check', 'audit', 'other'];
const BUDGET_OPTIONS: AssetServiceBudgetStatus[] = ['pending_check', 'warranty_covered', 'budget_available', 'budget_unavailable'];
const HANDLING_OPTIONS: AssetServiceHandlingDecision[] = ['warranty_claim', 'vendor_repair', 'replacement_evaluation'];

function makeEmptyDetailState(): ServiceDetailFormState {
    return {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        inventory_detail_id: '',
        problem_description: '',
        handling_decision: '',
        budget_status: 'pending_check',
        status: 'pending',
        assigned_vendor_id: '',
        estimated_cost: '',
        actual_cost: '',
        warranty_covered: false,
        warranty_outcome: '',
        completion_notes: '',
        verification_notes: '',
    };
}

export function ServiceRecordFormPage({ baseRoute, recordId }: ServiceRecordFormPageProps) {
    const router = useRouter();
    const isEditMode = !!recordId;

    const [loading, setLoading] = useState(false);

    const [vendors, setVendors] = useState<ServiceHelperVendor[]>([]);
    const [departments, setDepartments] = useState<ServiceHelperDepartment[]>([]);
    const [endUsers, setEndUsers] = useState<ServiceHelperEndUser[]>([]);
    const [inventory, setInventory] = useState<ServiceInventoryItem[]>([]);

    const [inventorySearch, setInventorySearch] = useState('');

    const [dateReported, setDateReported] = useState(() => new Date().toISOString().split('T')[0]);
    const [reportSource, setReportSource] = useState<AssetServiceReportSource>('other');
    const [submittedByName, setSubmittedByName] = useState('');
    const [submittedByEndUserId, setSubmittedByEndUserId] = useState<number | ''>('');
    const [reportingDepartmentId, setReportingDepartmentId] = useState<number | ''>('');
    const [status, setStatus] = useState<AssetServiceStatus>('pending');
    const [recordNotes, setRecordNotes] = useState('');
    const [details, setDetails] = useState<ServiceDetailFormState[]>([makeEmptyDetailState()]);

    useEffect(() => {
        const loadHelpers = async () => {
            try {
                const [v, d, inv] = await Promise.all([
                    serviceApi.getVendors(),
                    serviceApi.getDepartments(),
                    serviceApi.getInventory(),
                ]);
                setVendors(v);
                setDepartments(d);
                setInventory(inv);
            } catch {
                toast.error('Failed to load form helpers');
            }
        };

        loadHelpers();
    }, []);

    useEffect(() => {
        const run = async () => {
            if (!reportingDepartmentId) {
                setEndUsers([]);
                return;
            }
            try {
                const rows = await serviceApi.getEndUsers(Number(reportingDepartmentId));
                setEndUsers(rows);
            } catch {
                toast.error('Failed to load end users');
            }
        };

        run();
    }, [reportingDepartmentId]);

    useEffect(() => {
        const run = async () => {
            if (!isEditMode || !recordId) return;
            try {
                setLoading(true);
                const data = await serviceApi.getById(recordId);

                setDateReported(data.DateReported || '');
                setReportSource(data.ReportSource);
                setSubmittedByName(data.SubmittedByName || '');
                setSubmittedByEndUserId(data.SubmittedByEndUserID || '');
                setReportingDepartmentId(data.ReportingDepartmentID || '');
                setStatus(data.Status);
                setRecordNotes(data.RecordNotes || '');

                const mappedDetails: ServiceDetailFormState[] = (data.details || []).map((detail): ServiceDetailFormState => ({
                    localId: `${detail.ServiceRecordDetailID}-${Math.random().toString(36).slice(2, 8)}`,
                    service_record_detail_id: detail.ServiceRecordDetailID,
                    inventory_detail_id: detail.InventoryDetailID ? Number(detail.InventoryDetailID) : '',
                    problem_description: detail.ProblemDescription || '',
                    handling_decision: (detail.HandlingDecision as AssetServiceHandlingDecision) || '',
                    budget_status: detail.BudgetStatus || 'pending_check',
                    status: detail.Status || data.Status,
                    assigned_vendor_id: detail.AssignedVendorID ? Number(detail.AssignedVendorID) : '',
                    estimated_cost: detail.EstimatedCost != null ? String(detail.EstimatedCost) : '',
                    actual_cost: detail.ActualCost != null ? String(detail.ActualCost) : '',
                    warranty_covered: !!detail.WarrantyCovered,
                    warranty_outcome: detail.WarrantyOutcome || '',
                    completion_notes: detail.CompletionNotes || '',
                    verification_notes: detail.VerificationNotes || '',
                }));

                setDetails(mappedDetails.length > 0 ? mappedDetails : [makeEmptyDetailState()]);
            } catch {
                toast.error('Failed to load service record');
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [isEditMode, recordId]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                const rows = await serviceApi.getInventory(inventorySearch || undefined);
                setInventory(rows);
            } catch {
                // no-op
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [inventorySearch]);

    const updateDetailField = <K extends keyof ServiceDetailFormState>(localId: string, key: K, value: ServiceDetailFormState[K]) => {
        setDetails((prev) => prev.map((detail) => (detail.localId === localId ? { ...detail, [key]: value } : detail)));
    };

    const addDetail = () => {
        setDetails((prev) => [...prev, makeEmptyDetailState()]);
    };

    const removeDetail = (localId: string) => {
        setDetails((prev) => {
            if (prev.length <= 1) {
                return prev;
            }
            return prev.filter((detail) => detail.localId !== localId);
        });
    };

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (details.length === 0) {
            toast.error('At least one service detail is required');
            return;
        }

        const hasInvalidDetail = details.some((detail) => !detail.inventory_detail_id || !detail.problem_description.trim());
        if (hasInvalidDetail) {
            toast.error('Each detail must have an inventory item and problem description');
            return;
        }

        const payload = {
            date_reported: dateReported,
            report_source: reportSource,
            submitted_by_name: submittedByName || undefined,
            submitted_by_end_user_id: submittedByEndUserId ? Number(submittedByEndUserId) : null,
            reporting_department_id: reportingDepartmentId ? Number(reportingDepartmentId) : null,
            status,
            record_notes: recordNotes || undefined,
            details: details.map((detail) => ({
                service_record_detail_id: detail.service_record_detail_id,
                inventory_detail_id: Number(detail.inventory_detail_id),
                problem_description: detail.problem_description,
                handling_decision: detail.handling_decision || undefined,
                budget_status: detail.budget_status,
                status: detail.status,
                assigned_vendor_id: detail.assigned_vendor_id ? Number(detail.assigned_vendor_id) : null,
                estimated_cost: detail.estimated_cost ? Number(detail.estimated_cost) : null,
                actual_cost: detail.actual_cost ? Number(detail.actual_cost) : null,
                warranty_covered: detail.warranty_covered,
                warranty_outcome: detail.warranty_outcome || undefined,
                completion_notes: detail.completion_notes || undefined,
                verification_notes: detail.verification_notes || undefined,
            })),
        };

        try {
            setLoading(true);
            if (isEditMode && recordId) {
                await serviceApi.update(recordId, payload);
                toast.success('Service record updated');
                router.push(`${baseRoute}/${recordId}`);
            } else {
                const created = await serviceApi.create(payload);
                toast.success('Service record created');
                router.push(`${baseRoute}/${created.record.ServiceRecordID}`);
            }
        } catch (error: unknown) {
            const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || 'Failed to save service record');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-app print:hidden">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                                {isEditMode ? 'Edit Service Record' : 'New Service Record'}
                            </h1>
                            <p className="text-sm text-slate-500">Repair and service transaction details</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
                <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Date Reported</label>
                            <input type="date" value={dateReported} onChange={(e) => setDateReported(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Report Source</label>
                            <select value={reportSource} onChange={(e) => setReportSource(e.target.value as AssetServiceReportSource)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                {REPORT_SOURCES.map((source) => (
                                    <option key={source} value={source}>{source.replaceAll('_', ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Record Status</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value as AssetServiceStatus)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Reporting Department</label>
                            <select value={reportingDepartmentId} onChange={(e) => setReportingDepartmentId(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                <option value="">Select department</option>
                                {departments.map((department) => (
                                    <option key={department.DepartmentID} value={department.DepartmentID}>{department.DepartmentName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Submitted by (Name)</label>
                            <input value={submittedByName} onChange={(e) => setSubmittedByName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Submitted by (End User)</label>
                            <select value={submittedByEndUserId} onChange={(e) => setSubmittedByEndUserId(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                <option value="">Select end user</option>
                                {endUsers.map((endUser) => (
                                    <option key={endUser.EndUserID} value={endUser.EndUserID}>{endUser.FullName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-3">
                            <h2 className="text-lg font-semibold text-slate-800">Service Details</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-[minmax(280px,1fr)_auto] gap-2">
                                <input
                                    value={inventorySearch}
                                    onChange={(e) => setInventorySearch(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    placeholder="Search inventory list for all detail rows"
                                />
                                <button
                                    type="button"
                                    onClick={addDetail}
                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Detail Row
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {details.map((detail, index) => {
                                const selectedInventory = inventory.find((item) => item.InventoryDetailID === Number(detail.inventory_detail_id));
                                return (
                                    <div key={detail.localId} className="rounded-lg border border-slate-200 p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-semibold text-slate-700">Detail #{index + 1}</h3>
                                            <button
                                                type="button"
                                                onClick={() => removeDetail(detail.localId)}
                                                disabled={details.length <= 1}
                                                className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-40"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Remove
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Inventory Item</label>
                                                <select
                                                    value={detail.inventory_detail_id}
                                                    onChange={(e) => updateDetailField(detail.localId, 'inventory_detail_id', e.target.value ? Number(e.target.value) : '')}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                    required
                                                >
                                                    <option value="">Select item</option>
                                                    {inventory.map((item) => (
                                                        <option key={item.InventoryDetailID} value={item.InventoryDetailID}>
                                                            {(item.PropertyNumber || 'No Property #')} - {item.Description || item.Brand || 'No Description'}
                                                        </option>
                                                    ))}
                                                </select>
                                                {selectedInventory && (
                                                    <p className="text-xs text-slate-500 mt-2">
                                                        Selected: {selectedInventory.PropertyNumber || 'No Property #'} | {selectedInventory.Description || 'No Description'}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Problem Description</label>
                                                <textarea
                                                    value={detail.problem_description}
                                                    onChange={(e) => updateDetailField(detail.localId, 'problem_description', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                    rows={3}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Handling Decision</label>
                                                <select
                                                    value={detail.handling_decision}
                                                    onChange={(e) => updateDetailField(detail.localId, 'handling_decision', e.target.value as AssetServiceHandlingDecision | '')}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                >
                                                    <option value="">Select decision</option>
                                                    {HANDLING_OPTIONS.map((option) => (
                                                        <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Budget Status</label>
                                                <select
                                                    value={detail.budget_status}
                                                    onChange={(e) => updateDetailField(detail.localId, 'budget_status', e.target.value as AssetServiceBudgetStatus)}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                >
                                                    {BUDGET_OPTIONS.map((option) => (
                                                        <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Detail Status</label>
                                                <select
                                                    value={detail.status}
                                                    onChange={(e) => updateDetailField(detail.localId, 'status', e.target.value as AssetServiceStatus)}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                >
                                                    {STATUS_OPTIONS.map((option) => (
                                                        <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Assigned Vendor</label>
                                                <select
                                                    value={detail.assigned_vendor_id}
                                                    onChange={(e) => updateDetailField(detail.localId, 'assigned_vendor_id', e.target.value ? Number(e.target.value) : '')}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                >
                                                    <option value="">Select vendor</option>
                                                    {vendors.map((vendor) => (
                                                        <option key={vendor.VendorID} value={vendor.VendorID}>{vendor.VendorName}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Estimated Cost</label>
                                                <input
                                                    value={detail.estimated_cost}
                                                    onChange={(e) => updateDetailField(detail.localId, 'estimated_cost', e.target.value)}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Actual Cost</label>
                                                <input
                                                    value={detail.actual_cost}
                                                    onChange={(e) => updateDetailField(detail.localId, 'actual_cost', e.target.value)}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2">
                                            <input
                                                id={`warranty-covered-${detail.localId}`}
                                                type="checkbox"
                                                checked={detail.warranty_covered}
                                                onChange={(e) => updateDetailField(detail.localId, 'warranty_covered', e.target.checked)}
                                            />
                                            <label htmlFor={`warranty-covered-${detail.localId}`} className="text-sm font-medium text-slate-700">Warranty covered</label>
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Warranty Outcome</label>
                                                <input
                                                    value={detail.warranty_outcome}
                                                    onChange={(e) => updateDetailField(detail.localId, 'warranty_outcome', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Completion Notes</label>
                                                <input
                                                    value={detail.completion_notes}
                                                    onChange={(e) => updateDetailField(detail.localId, 'completion_notes', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Verification Notes</label>
                                                <input
                                                    value={detail.verification_notes}
                                                    onChange={(e) => updateDetailField(detail.localId, 'verification_notes', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Record Notes</label>
                        <textarea value={recordNotes} onChange={(e) => setRecordNotes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={3} />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
                        <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50">
                            <Save className="w-4 h-4" />
                            {loading ? 'Saving...' : isEditMode ? 'Update Service Record' : 'Create Service Record'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
