'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Building2, User, Calendar, CheckCircle, XCircle, FileText, FileSpreadsheet, X, Trash2, RotateCcw, AlertTriangle, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { rlsddpAPI } from '@/lib/api/rlsddp';
import { removeInventoryDetail, restoreInventoryDetail } from '@/lib/api/inventory';
import { PropertyRlsddpReport, PropertyRlsddpItem, RlsddpStatus } from '@/types/propertyRlsddp';
import { exportRlsddpToExcel } from './RlsddpExport';
import { useAuth } from '@/lib/hooks/useAuth';

interface RlsddpDetailPageProps {
    baseRoute: string;
    reportId?: number;
    isModal?: boolean;
    onClose?: () => void;
}

const statusBadgeStyles: Record<RlsddpStatus, string> = {
    Lost: 'bg-amber-100 text-amber-800',
    Stolen: 'bg-rose-100 text-rose-800',
    Damaged: 'bg-orange-100 text-orange-800',
    Destroyed: 'bg-red-100 text-red-800',
};

// ─── Remove Confirmation Modal ──────────────────────────────────────────────
interface RemoveModalProps {
    item: PropertyRlsddpItem;
    isLoading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

function RemoveConfirmModal({ item, isLoading, onConfirm, onCancel }: RemoveModalProps) {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-start gap-3 p-6 pb-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">Remove from Active Inventory</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                            This will hide the item from active inventory, department lists, and exports. The RLSDDP record will be preserved.
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Item details */}
                <div className="mx-6 mb-5 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm">
                    <div className="flex justify-between items-center gap-2">
                        <span className="font-semibold text-slate-900">{item.PropertyNumber || 'N/A'}</span>
                        <span className="text-slate-600 font-medium">
                            ₱{Number(item.AcquisitionCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    {item.Description && (
                        <p className="text-slate-500 mt-1 text-xs line-clamp-2">
                            {item.Description?.replace(/\b(Brand|Model|S\.?N\.?|Serial\s*No\.?|Serial\s*Number):\s*/gi, '').trim()}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 px-6 pb-6">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Removing…
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                Confirm Remove
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Rejection Modal ──────────────────────────────────────────────────────────
interface RejectionModalProps {
    isOpen: boolean;
    isLoading: boolean;
    onConfirm: (notes: string) => void;
    onCancel: () => void;
}

function RejectionModal({ isOpen, isLoading, onConfirm, onCancel }: RejectionModalProps) {
    const [rejectionNotes, setRejectionNotes] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (rejectionNotes.trim().length < 5) {
            toast.error('Rejection notes must be at least 5 characters');
            return;
        }
        onConfirm(rejectionNotes);
        setRejectionNotes('');
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-start gap-3 p-6 pb-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <Ban className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">Reject RLSDDP Report</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Provide reason for rejection. All items will be restored for reselection.
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Input */}
                <div className="px-6 pb-4">
                    <label className="block text-sm font-medium text-slate-900 mb-2">Rejection Reason</label>
                    <textarea
                        value={rejectionNotes}
                        onChange={(e) => setRejectionNotes(e.target.value)}
                        disabled={isLoading}
                        placeholder="Enter at least 5 characters explaining why this report is being rejected..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm resize-none disabled:opacity-50"
                        rows={4}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                        {rejectionNotes.length}/1000 characters
                    </p>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 px-6 pb-6">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || rejectionNotes.trim().length < 5}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Rejecting…
                            </>
                        ) : (
                            <>
                                <Ban className="w-4 h-4" />
                                Confirm Rejection
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function RlsddpDetailPage({ baseRoute, reportId, isModal = false, onClose }: RlsddpDetailPageProps) {
    const params = useParams();
    const router = useRouter();

    const [report, setReport] = useState<PropertyRlsddpReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    // Modal state for remove confirmation
    const [removingItem, setRemovingItem] = useState<PropertyRlsddpItem | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [isRestoring, setIsRestoring] = useState<number | null>(null);

    // Modal state for rejection
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
    const [isRejectingReport, setIsRejectingReport] = useState(false);

    const resolvedId = reportId ?? (params?.id ? Number(params.id) : null);
    const { user } = useAuth();
    const isPrivileged = user?.Role === 'Admin' || user?.Role === 'GSO Staff';

    const fetchReport = useCallback(async (isSilent = false) => {
        if (!resolvedId) return;
        try {
            if (!isSilent) setLoading(true);
            const data = await rlsddpAPI.getReport(resolvedId);
            setReport(data);
        } catch {
            toast.error('Failed to load RLSDDP details');
            if (isModal) {
                onClose?.();
            } else {
                router.push(baseRoute);
            }
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [resolvedId, isModal, onClose, router, baseRoute]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleRemoveConfirm = async () => {
        if (!removingItem?.RlsddpItemID) return;
        setIsRemoving(true);
        try {
            if (!removingItem?.InventoryDetailID) throw new Error('No inventory detail id');
            await removeInventoryDetail(removingItem.InventoryDetailID);
            toast.success('Item removed from active inventory.');
            setRemovingItem(null);
            await fetchReport(true);
        } catch (err) {
            toast.error('Failed to remove item.');
        } finally {
            setIsRemoving(false);
        }
    };

    const handleRestoreItem = async (itemIdOrInventoryDetailId: number, isRlsddpItem = false) => {
        // If called with an RLSDDP item id, map to inventory detail id via report items list
        let inventoryDetailId = itemIdOrInventoryDetailId;
        setIsRestoring(itemIdOrInventoryDetailId);
        try {
            // If the id passed is an RlsddpItemID, find the matching item in report
            if (isRlsddpItem && report) {
                const found = report.removedItems?.find(it => it.RlsddpItemID === itemIdOrInventoryDetailId);
                if (found) inventoryDetailId = found.InventoryDetailID;
            }
            if (!inventoryDetailId) throw new Error('No inventory detail id to restore');
            await restoreInventoryDetail(inventoryDetailId);
            toast.success('Item restored to active inventory.');
            await fetchReport(true);
        } catch {
            toast.error('Failed to restore item.');
        } finally {
            setIsRestoring(null);
        }
    };

    const isApprovedRemovalStatus = report?.Status === 'Lost' || report?.Status === 'Stolen' || report?.Status === 'Destroyed';

    const handleApprovedTransfer = async () => {
        if (!report?.RlsddpID || !isApprovedRemovalStatus) return;

        setIsRemoving(true);
        try {
            await rlsddpAPI.approveReport(report.RlsddpID);
            toast.success('Report approved and items transferred to removed inventory.');
            await fetchReport(true);
        } catch {
            toast.error('Failed to approve RLSDDP report.');
        } finally {
            setIsRemoving(false);
        }
    };

    const handleRejectReport = async (rejectionNotes: string) => {
        if (!report?.RlsddpID) return;

        setIsRejectingReport(true);
        try {
            await rlsddpAPI.rejectReport(report.RlsddpID, rejectionNotes);
            toast.success('RLSDDP report rejected. All items have been restored for reselection.');
            setIsRejectionModalOpen(false);
            await fetchReport(true);
        } catch {
            toast.error('Failed to reject RLSDDP report.');
        } finally {
            setIsRejectingReport(false);
        }
    };

    const handleExcelExport = async () => {
        if (!report) return;
        try {
            setIsExporting(true);
            await exportRlsddpToExcel(report);
            toast.success('RLSDDP exported successfully');
        } catch (err) {
            toast.error('Failed to export RLSDDP');
            console.error(err);
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading RLSDDP report...</div>;
    }

    if (!report) {
        return <div className="p-8 text-center text-slate-500">RLSDDP report not found.</div>;
    }

    const createdBy = report.createdBy ?? report.created_by ?? null;
    const createdByName = createdBy?.FullName?.trim() || 'Unknown user';

    const content = (
        <div className="space-y-6 w-full">
            {/* Remove Confirmation Modal */}
            {removingItem && (
                <RemoveConfirmModal
                    item={removingItem}
                    isLoading={isRemoving}
                    onConfirm={handleRemoveConfirm}
                    onCancel={() => !isRemoving && setRemovingItem(null)}
                />
            )}

            {/* Rejection Modal */}
            <RejectionModal
                isOpen={isRejectionModalOpen}
                isLoading={isRejectingReport}
                onConfirm={handleRejectReport}
                onCancel={() => !isRejectingReport && setIsRejectionModalOpen(false)}
            />

            {/* Header section matching ViewDRPage */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                    {!isModal && (
                        <Link
                            href={baseRoute}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                    )}
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900">{report.RlsddpNumber}</h1>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeStyles[report.Status] || 'bg-slate-100 text-slate-800'}`}>
                                {report.Status}
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm mt-0.5">
                            Created on {format(toZonedTime(new Date(report.created_at), 'Asia/Manila'), 'MMM dd, yyyy')} by {createdByName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExcelExport}
                        disabled={isExporting}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 border border-green-200 rounded-lg shadow-sm transition-colors"
                    >
                        {isExporting ? (
                            <>
                                <span className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                Export Excel
                            </>
                        )}
                    </button>
                    <Link
                        href={`${baseRoute}/${report.RlsddpID}/edit`}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-sm font-medium"
                    >
                        <Edit className="w-4 h-4" />
                        Edit Report
                    </Link>
                    {isModal && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* General Info Grid */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                    <span className="text-slate-400 text-xs block">Department</span>
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {report.department?.DepartmentName || 'N/A'}
                    </div>
                </div>

                <div>
                    <span className="text-slate-400 text-xs block">Accountable Officer</span>
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <User className="w-4 h-4 text-slate-400" />
                        {report.AccountableOfficer}
                    </div>
                </div>

                <div>
                    <span className="text-slate-400 text-xs block">Police Notified</span>
                    <div className="font-semibold text-slate-900 mt-0.5">
                        {report.PoliceNotified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Yes {report.PoliceStation ? `(${report.PoliceStation})` : ''}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-semibold">
                                <XCircle className="w-3.5 h-3.5" />
                                No
                            </span>
                        )}
                    </div>
                </div>

                {report.PoliceNotified && report.DateReported && (
                    <div>
                        <span className="text-slate-400 text-xs block">Date Reported to Police</span>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {format(toZonedTime(new Date(report.DateReported), 'Asia/Manila'), 'MMM dd, yyyy')}
                        </div>
                    </div>
                )}
            </div>

            {report.Remarks && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Circumstances / Remarks</span>
                    <p className="text-slate-800">{report.Remarks}</p>
                </div>
            )}

            {/* Approval Status Section */}
            <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 text-sm">Review Status</h3>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Approval Status:</span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${report.ApprovalStatus === 'Approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : report.ApprovalStatus === 'Rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                            {report.ApprovalStatus ?? 'Pending'}
                        </span>
                    </div>

                    {report.ApprovalStatus === 'Rejected' && report.RejectionNotes && (
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Rejection Reason</label>
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
                                {report.RejectionNotes}
                            </div>
                            {report.RejectedAt && (
                                <p className="text-xs text-slate-500 mt-2">
                                    Rejected on {format(toZonedTime(new Date(report.RejectedAt), 'Asia/Manila'), 'MMM dd, yyyy HH:mm')}
                                </p>
                            )}
                        </div>
                    )}

                    {isPrivileged && report.ApprovalStatus !== 'Approved' && report.ApprovalStatus !== 'Rejected' && (
                        <div className="flex gap-2 pt-2">
                            {isApprovedRemovalStatus && (
                                <button
                                    onClick={handleApprovedTransfer}
                                    disabled={isRemoving}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isRemoving ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Approving…
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Approve & Transfer
                                        </>
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => setIsRejectionModalOpen(true)}
                                disabled={isRejectingReport}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isRejectingReport ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
                                        Rejecting…
                                    </>
                                ) : (
                                    <>
                                        <Ban className="w-4 h-4" />
                                        Reject & Restore
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--primary)]" />
                    Reported Assets ({report.items?.length ?? 0})
                </h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Property No.</th>
                                <th className="px-4 py-3 text-right">Acquisition Cost</th>
                                <th className="px-4 py-3">Generated Description</th>
                                {/* {isPrivileged && <th className="px-4 py-3 text-center w-28">Actions</th>} */}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {(report.items ?? []).map((item) => (
                                <tr key={item.RlsddpItemID} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-semibold text-slate-900">
                                        {item.PropertyNumber || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                                        ₱{Number(item.AcquisitionCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {item.Description?.replace(/\b(Brand|Model|S\.?N\.?|Serial\s*No\.?|Serial\s*Number):\s*/gi, '').trim() || '—'}
                                    </td>
                                    {/* {isPrivileged && report.ApprovalStatus !== 'Rejected' && (
                                        <td className="px-4 py-3 text-center">
                                            {isApprovedRemovalStatus ? (
                                                <button
                                                    onClick={handleApprovedTransfer}
                                                    disabled={isRemoving}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Approve and transfer to removed inventory"
                                                >
                                                    {isRemoving ? (
                                                        <span className="w-3.5 h-3.5 border-2 border-rose-600/30 border-t-rose-600 rounded-full animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    )}
                                                    Transfer
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setRemovingItem(item)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                                                    title="Remove from active inventory"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    )} */}
                                </tr>
                            ))}
                            {(report.items ?? []).length === 0 && (
                                <tr>
                                    <td colSpan={isPrivileged ? 4 : 3} className="px-4 py-6 text-center text-slate-400 text-sm">
                                        No active items.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Removed Items Table */}
            {isPrivileged && report.ApprovalStatus !== 'Rejected' && (report.removedItems ?? []).length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        Removed Items ({report.removedItems!.length})
                    </h3>

                    <div className="border border-rose-200 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-rose-50 text-rose-600 font-medium border-b border-rose-200">
                                <tr>
                                    <th className="px-4 py-3">Property No.</th>
                                    <th className="px-4 py-3 text-right">Acquisition Cost</th>
                                    <th className="px-4 py-3">Generated Description</th>
                                    <th className="px-4 py-3 text-center w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-rose-100">
                                {report.removedItems!.map((item) => (
                                    <tr key={item.RlsddpItemID} className="bg-rose-50/30 hover:bg-rose-50/60">
                                        <td className="px-4 py-3 font-semibold text-slate-400 line-through">
                                            {item.PropertyNumber || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-400 line-through">
                                            ₱{Number(item.AcquisitionCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 line-through">
                                            {item.Description?.replace(/\b(Brand|Model|S\.?N\.?|Serial\s*No\.?|Serial\s*Number):\s*/gi, '').trim() || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => item.RlsddpItemID && handleRestoreItem(item.RlsddpItemID, true)}
                                                disabled={isRestoring === item.RlsddpItemID}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                                                title="Restore to active inventory"
                                            >
                                                {isRestoring === item.RlsddpItemID ? (
                                                    <span className="w-3.5 h-3.5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                )}
                                                Restore
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );

    if (isModal) {
        return content;
    }

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm w-full">
                    {content}
                </div>
            </div>
        </div>
    );
}