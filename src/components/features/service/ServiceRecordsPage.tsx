'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Plus, RefreshCw, Search, Wrench, CheckCircle2, Hammer, ShieldCheck, Clock, ListChecks, Hammer as HammerAlt, ShieldCheck as ShieldAlt, Eye as EyeAlt } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

import { Dialog } from '@/components/ui/Dialog';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';

import serviceApi from '@/lib/api/assetServices';
import { AssetServiceRecord, AssetServiceStatus } from '@/types/assetService';

const statusClasses: Record<AssetServiceStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    work_approved: 'bg-indigo-100 text-indigo-800',
    repair_in_progress: 'bg-violet-100 text-violet-800',
    verification: 'bg-cyan-100 text-cyan-800',
    fixed: 'bg-emerald-100 text-emerald-800',
    unrepairable: 'bg-rose-100 text-rose-800',
};

const statusLabel = (status: AssetServiceStatus) => status.replaceAll('_', ' ');

const statusTransitionMap: Record<AssetServiceStatus, { next: AssetServiceStatus | null; label: string; icon: React.ComponentType<{ className: string }> }> = {
    pending: { next: 'work_approved', label: 'Approve work', icon: CheckCircle2 },
    work_approved: { next: 'repair_in_progress', label: 'Repair in progress', icon: Hammer },
    repair_in_progress: { next: 'verification', label: 'Verify repairs', icon: ShieldCheck },
    verification: { next: null, label: 'Review items', icon: Clock },
    fixed: { next: null, label: 'Fixed', icon: Clock },
    unrepairable: { next: null, label: 'Unrepairable', icon: Clock },
};

const getNextStatusFor = (status: AssetServiceStatus): AssetServiceStatus | null => statusTransitionMap[status]?.next ?? null;

const formatDateReported = (dateString?: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    const zonedDate = toZonedTime(date, 'Asia/Manila');
    return format(zonedDate, 'MMMM d, yyyy');
};

const formatReportingDepartment = (record: AssetServiceRecord): string => {
    const head = record.reportingDepartmentHead?.trim();
    const dept = record.reportingDepartmentLabel?.trim()
        || record.reportingDepartment?.DepartmentCode?.trim()
        || record.reportingDepartment?.DepartmentName?.trim();

    if (head && dept) return `${head} - ${dept}`;
    if (dept) return dept;
    if (head) return head;
    return '-';
};

const getArticleLabel = (recordDetail: AssetServiceRecord['details'][number]): string => {
    return recordDetail.inventoryDetail?.drDetail?.article?.ArticleName?.trim()
        || recordDetail.inventoryDetail?.drDetail?.ItemDescription?.trim()
        || recordDetail.inventoryDetail?.PropertyName?.trim()
        || recordDetail.inventoryDetail?.Description?.trim()
        || recordDetail.ItemDescription?.trim()
        || '-';
};

const getItemDescription = (recordDetail: AssetServiceRecord['details'][number]): string => {
    return recordDetail.inventoryDetail?.drDetail?.ItemDescription?.trim()
        || recordDetail.inventoryDetail?.Description?.trim()
        || recordDetail.ItemDescription?.trim()
        || '-';
};

const getBrand = (recordDetail: AssetServiceRecord['details'][number]): string => {
    return recordDetail.inventoryDetail?.Brand?.trim() || 'Not recorded';
};

const getModel = (recordDetail: AssetServiceRecord['details'][number]): string => {
    return recordDetail.inventoryDetail?.ModelNumber?.trim() || 'Not recorded';
};

const getSerial = (recordDetail: AssetServiceRecord['details'][number]): string => {
    return recordDetail.inventoryDetail?.SerialNumber?.trim() || 'Not recorded';
};

interface ServiceRecordsPageProps {
    baseRoute: string;
    title: string;
    description: string;
    showCreate?: boolean;
}

export function ServiceRecordsPage({ baseRoute, title, description, showCreate = false }: ServiceRecordsPageProps) {
    const [rows, setRows] = useState<AssetServiceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'all' | AssetServiceStatus>('all');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
    const [selectedRecord, setSelectedRecord] = useState<AssetServiceRecord | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const [statusChangeCandidate, setStatusChangeCandidate] = useState<{ recordId: number; detailId: number; nextStatus: AssetServiceStatus; detail: AssetServiceRecord['details'][number] } | null>(null);
    const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
    const [statusConfirmMessage, setStatusConfirmMessage] = useState('');

    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [reviewRecord, setReviewRecord] = useState<AssetServiceRecord | null>(null);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [detailReviewStatus, setDetailReviewStatus] = useState<Record<number, 'fixed' | 'unrepairable' | 'repair_in_progress'>>({});
    const [headerFinalNote, setHeaderFinalNote] = useState('');

    const load = useCallback(async (targetPage = 1) => {
        try {
            setLoading(true);
            const response = await serviceApi.getAll({
                page: targetPage,
                per_page: 15,
                search: search || undefined,
                status: status === 'all' ? undefined : status,
            });
            setRows(response.data || []);
            setPage(response.current_page || 1);
            setLastPage(response.last_page || 1);
        } catch {
            toast.error('Failed to load service records');
        } finally {
            setLoading(false);
        }
    }, [search, status]);

    useEffect(() => {
        load(1);
    }, [load]);

    useEffect(() => {
        if (selectedRecordId === null) {
            setSelectedRecord(null);
            return;
        }

        const fetchRecord = async () => {
            try {
                const record = await serviceApi.getById(selectedRecordId);
                setSelectedRecord(record);
            } catch {
                toast.error('Failed to load selected service record');
            }
        };

        fetchRecord();
    }, [selectedRecordId]);

    const handleStatusRequest = (record: AssetServiceRecord, detail: AssetServiceRecord['details'][number], nextStatus: AssetServiceStatus) => {
        setSelectedRecord(record);
        setSelectedRecordId(record.ServiceRecordID);
        setStatusChangeCandidate({ recordId: record.ServiceRecordID, detailId: detail.ServiceRecordDetailID, nextStatus, detail });
        setStatusConfirmMessage(`Change ${record.ServiceNumber} from ${statusLabel(detail.Status)} to ${statusLabel(nextStatus)}?`);
        setIsStatusConfirmOpen(true);
    };

    const beginVerificationReview = async (record: AssetServiceRecord) => {
        const statusMap: Record<number, 'fixed' | 'unrepairable' | 'repair_in_progress'> = {};
        (record.details ?? []).forEach((item) => {
            statusMap[item.ServiceRecordDetailID] = 'fixed';
        });

        setReviewRecord(record);
        setDetailReviewStatus(statusMap);
        setHeaderFinalNote(record.FinalNotes ?? '');
        setReviewModalOpen(true);

        try {
            setReviewLoading(true);
            await serviceApi.update(record.ServiceRecordID, { status: 'verification' });
            const refreshed = await serviceApi.getById(record.ServiceRecordID);
            setReviewRecord(refreshed);

            const refreshedStatusMap: Record<number, 'fixed' | 'unrepairable' | 'repair_in_progress'> = {};
            (refreshed.details ?? []).forEach((item) => {
                refreshedStatusMap[item.ServiceRecordDetailID] = detailReviewStatus[item.ServiceRecordDetailID] ?? 'fixed';
            });
            setDetailReviewStatus(refreshedStatusMap);
            setHeaderFinalNote(refreshed.FinalNotes ?? '');
            await load(page);
            setSelectedRecordId(refreshed.ServiceRecordID);
        } catch {
            toast.error('Failed to set record to verification');
        } finally {
            setReviewLoading(false);
        }
    };

    const updateDetailStatus = async (recordId: number, detail: AssetServiceRecord['details'][number], newStatus: AssetServiceStatus, verificationNote?: string | null) => {
        try {
            setLoading(true);

            const payload = {
                details: [
                    {
                        service_record_detail_id: detail.ServiceRecordDetailID,
                        inventory_detail_id: detail.InventoryDetailID,
                        problem_description: detail.ProblemDescription,
                        handling_decision: detail.HandlingDecision,
                        assigned_vendor_id: detail.AssignedVendorID,
                        assigned_supplier_id: detail.AssignedSupplierID,
                        status: newStatus,
                        verification_note: verificationNote ?? null,
                        final_notes: headerFinalNote || undefined,
                        actual_cost: newStatus === 'fixed' ? detail.ActualCost : null,
                    },
                ],
            };

            await serviceApi.update(recordId, payload);
            toast.success(`Status changed to ${statusLabel(newStatus)} for ${selectedRecord?.ServiceNumber ?? 'service record'}.`);
            await load(page);
            setSelectedRecordId(selectedRecord?.ServiceRecordID ?? null);
            setStatusChangeCandidate(null);
            setIsStatusConfirmOpen(false);
        } catch {
            toast.error('Failed to change status');
        } finally {
            setLoading(false);
        }
    };

    const applyStatusConfirm = async () => {
        if (!statusChangeCandidate) return;
        await updateDetailStatus(statusChangeCandidate.recordId, statusChangeCandidate.detail, statusChangeCandidate.nextStatus);
    };

    const applyReviewResults = async () => {
        if (!reviewRecord) return;

        const items = Object.entries(detailReviewStatus).map(([detailId, status]) => {
            const detail = reviewRecord.details.find((d) => d.ServiceRecordDetailID === Number(detailId));
            if (!detail) return null;
            return {
                service_record_detail_id: detail.ServiceRecordDetailID,
                inventory_detail_id: detail.InventoryDetailID,
                problem_description: detail.ProblemDescription || '',
                handling_decision: detail.HandlingDecision,
                budget_status: detail.BudgetStatus,
                assigned_vendor_id: detail.AssignedVendorID,
                assigned_supplier_id: detail.AssignedSupplierID,
                status,
                actual_cost: detail.ActualCost,
                invoice_attachment: detail.InvoiceAttachment ?? undefined,
                supporting_attachments: detail.SupportingAttachments ?? undefined,
            };
        }).filter((x): x is NonNullable<typeof x> => Boolean(x));

        try {
            setLoading(true);
            const payload = {
                final_notes: headerFinalNote || undefined,
                details: items,
            };
            await serviceApi.update(reviewRecord.ServiceRecordID, payload);
            toast.success(`Service ${reviewRecord.ServiceNumber} verification results saved.`);
            await load(page);
            setSelectedRecordId(reviewRecord.ServiceRecordID);
            setReviewModalOpen(false);
            setReviewRecord(null);
            setDetailReviewStatus({});
            setHeaderFinalNote('');
        } catch {
            toast.error('Failed to finalize verification');
        } finally {
            setLoading(false);
        }
    };

    const statusCounts = useMemo(() => {
        const initial = { pending: 0, work_approved: 0, repair_in_progress: 0, verification: 0, fixed: 0, unrepairable: 0 } as Record<AssetServiceStatus, number>;
        return rows.reduce((acc, row) => {
            if (row.Status in acc) {
                acc[row.Status] += 1;
            }
            return acc;
        }, initial);
    }, [rows]);

    const verificationOutcomeCounts = useMemo(() => {
        return rows.reduce(
            (acc, row) => {
                (row.details ?? []).forEach((detail) => {
                    if (detail.Status === 'fixed') acc.fixed += 1;
                    if (detail.Status === 'unrepairable') acc.unrepairable += 1;
                    if (detail.Status === 'repair_in_progress') acc.repair_in_progress += 1;
                });
                return acc;
            },
            { fixed: 0, unrepairable: 0, repair_in_progress: 0 }
        );
    }, [rows]);

    const hasStillRepairingItems = useMemo(
        () => Object.values(detailReviewStatus).some((status) => status === 'repair_in_progress'),
        [detailReviewStatus]
    );


    const totalCount = rows.length;

    const filteredRows = useMemo(() => rows, [rows]);

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                        <p className="text-slate-500 text-sm">{description}</p>
                    </div>
                    <div className="flex gap-2">
                        {showCreate && (
                            <Link
                                href={`${baseRoute}/new`}
                                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-white text-sm hover:bg-[var(--primary-hover)]"
                            >
                                <Plus className="h-4 w-4" />
                                New Service Record
                            </Link>
                        )}
                        <button
                            onClick={() => load(page)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    <div className="col-span-1 bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-slate-600" />
                        <div>
                            <p className="text-xs text-slate-500">Total records</p>
                            <p className="text-2xl font-bold">{totalCount}</p>
                        </div>
                    </div>
                    <div className="col-span-1 bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-2">
                        <EyeAlt className="w-5 h-5 text-amber-600" />
                        <div>
                            <p className="text-xs text-slate-500">Pending</p>
                            <p className="text-2xl font-bold">{statusCounts.pending}</p>
                        </div>
                    </div>
                    <div className="col-span-1 bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                        <div>
                            <p className="text-xs text-slate-500">Work Approved</p>
                            <p className="text-2xl font-bold">{statusCounts.work_approved}</p>
                        </div>
                    </div>
                    <div className="col-span-1 bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-2">
                        <HammerAlt className="w-5 h-5 text-violet-600" />
                        <div>
                            <p className="text-xs text-slate-500">Repair In Progress</p>
                            <p className="text-2xl font-bold">{statusCounts.repair_in_progress}</p>
                        </div>
                    </div>
                    <div className="col-span-1 bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center gap-2">
                        <ShieldAlt className="w-5 h-5 text-cyan-600" />
                        <div className="space-y-1">
                            <p className="text-xs text-slate-500">Verification</p>
                            <p className="text-sm font-semibold text-emerald-700">Fixed items: {verificationOutcomeCounts.fixed}</p>
                            <p className="text-sm font-semibold text-rose-700">Unrepairable items: {verificationOutcomeCounts.unrepairable}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by service no, property no, issue, vendor"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as 'all' | AssetServiceStatus)}
                            className="px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="work_approved">Work Approved</option>
                            <option value="repair_in_progress">Repair In Progress</option>
                            <option value="verification">Verification</option>
                            <option value="fixed">Fixed</option>
                            <option value="unrepairable">Unrepairable</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Service #</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date Reported</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Items</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loading ? (
                                    <TableSkeletonRows columns={6} rows={10} cellClassName="px-4 py-3" />
                                ) : filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <Wrench className="w-8 h-8 text-slate-300" />
                                                No service records found
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row) => (
                                        <tr key={row.ServiceRecordID} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.ServiceNumber}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{formatDateReported(row.DateReported)}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{formatReportingDepartment(row)}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{row.details?.length || 0}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClasses[row.Status]}`}>
                                                    {statusLabel(row.Status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="inline-flex gap-2 items-center justify-center">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedRecord(row);
                                                            setSelectedRecordId(row.ServiceRecordID);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                        className="inline-flex text-slate-500 hover:text-slate-800"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    <span className="h-5 border-r border-slate-300" />

                                                    {row.Status === 'repair_in_progress' || row.Status === 'verification' ? (
                                                        <button
                                                            onClick={() => beginVerificationReview(row)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                                                        >
                                                            <Clock className="w-3 h-3" />
                                                            <span className="text-[11px]">Review Items</span>
                                                        </button>
                                                    ) : getNextStatusFor(row.Status) ? (
                                                        <button
                                                            onClick={() => {
                                                                const detail = row.details?.[0];
                                                                if (!detail) return;
                                                                handleStatusRequest(row, detail, getNextStatusFor(row.Status) as AssetServiceStatus);
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                                                        >
                                                            {(() => {
                                                                const Icon = statusTransitionMap[row.Status].icon;
                                                                return <Icon className="w-3 h-3" />;
                                                            })()}
                                                            <span className="text-[11px]">{statusTransitionMap[row.Status].label}</span>
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {lastPage > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                            <button
                                onClick={() => page > 1 && load(page - 1)}
                                disabled={page <= 1}
                                className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">Page {page} of {lastPage}</span>
                            <button
                                onClick={() => page < lastPage && load(page + 1)}
                                disabled={page >= lastPage}
                                className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <Dialog
                title={selectedRecord ? `${selectedRecord.ServiceNumber} Details` : 'Service Record Details'}
                description={selectedRecord ? `Reported on ${formatDateReported(selectedRecord.DateReported)}` : ''}
                open={isDetailModalOpen}
                onOpenChange={(open) => {
                    setIsDetailModalOpen(open);
                    if (!open) {
                        setSelectedRecordId(null);
                        setSelectedRecord(null);
                    }
                }}
                onConfirm={() => {
                    setIsDetailModalOpen(false);
                    setSelectedRecordId(null);
                    setSelectedRecord(null);
                }}
                hideConfirm
                cancelText="Close"
                contentClassName="max-w-[1200px] w-[min(98vw,1200px)] max-h-[90vh]"
            >
                {selectedRecord ? (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <div><span className="font-semibold text-slate-800">Service #:</span> {selectedRecord.ServiceNumber}</div>
                            <div><span className="font-semibold text-slate-800">Date Reported:</span> {formatDateReported(selectedRecord.DateReported)}</div>
                            <div><span className="font-semibold text-slate-800">Reporting Department:</span> {formatReportingDepartment(selectedRecord)}</div>
                            <div><span className="font-semibold text-slate-800">Status:</span> {selectedRecord.Status.replaceAll('_', ' ')}</div>
                            <div><span className="font-semibold text-slate-800">Final notes:</span> {selectedRecord.FinalNotes ? selectedRecord.FinalNotes : '-'}</div>
                            {selectedRecord.RecordNotes && <div><span className="font-medium">Notes:</span> {selectedRecord.RecordNotes}</div>}
                        </div>
                        <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
                            {(selectedRecord.details || []).map((detail) => (
                                <div key={detail.ServiceRecordDetailID} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 mb-3">
                                        <h3 className="text-sm font-semibold text-slate-900">Item #{detail.ServiceRecordDetailID}</h3>
                                        <p className="text-xs text-slate-500">Property No: {detail.PropertyNumber || '-'}</p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm text-slate-700">
                                        <div className="space-y-1">
                                            <p className="text-slate-500 text-xs uppercase tracking-wide">Article</p>
                                            <p className="font-medium text-slate-800">{getArticleLabel(detail)}</p>

                                            <p className="text-slate-500 text-xs uppercase tracking-wide mt-2">Brand</p>
                                            <p className="font-medium text-slate-800">{getBrand(detail)}</p>

                                            <p className="text-slate-500 text-xs uppercase tracking-wide mt-2">Status</p>
                                            <p className="font-medium text-slate-800">{detail.Status.replaceAll('_', ' ')}</p>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-slate-500 text-xs uppercase tracking-wide">Description</p>
                                            <p className="font-medium text-slate-800">{getItemDescription(detail)}</p>

                                            <p className="text-slate-500 text-xs uppercase tracking-wide mt-2">Model</p>
                                            <p className="font-medium text-slate-800">{getModel(detail)}</p>

                                            <p className="text-slate-500 text-xs uppercase tracking-wide mt-2">Budget</p>
                                            <p className="font-medium text-slate-800">{detail.BudgetStatus.replaceAll('_', ' ')}</p>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-slate-500 text-xs uppercase tracking-wide">Serial</p>
                                            <p className="font-medium text-slate-800">{getSerial(detail)}</p>

                                            <p className="text-slate-500 text-xs uppercase tracking-wide mt-2">Provider</p>
                                            <p className="font-medium text-slate-800">{detail.assigned_provider_name || '-'}</p>

                                            <p className="text-slate-500 text-xs uppercase tracking-wide mt-2">Handling</p>
                                            <p className="font-medium text-slate-800">{detail.HandlingDecision?.replaceAll('_', ' ') || '-'}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 border-t border-slate-100 pt-3 flex flex-wrap gap-2 items-center">
                                        <span className="text-slate-500 text-xs uppercase tracking-wide">Actions</span>
                                        {detail.Status === 'repair_in_progress' || detail.Status === 'verification' ? (
                                            <button
                                                onClick={() => beginVerificationReview(selectedRecord!)}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                                            >
                                                <Clock className="w-3 h-3" />
                                                <span className="text-[11px]">Review Items</span>
                                            </button>
                                        ) : getNextStatusFor(detail.Status) ? (
                                            <button
                                                onClick={() => handleStatusRequest(selectedRecord!, detail, getNextStatusFor(detail.Status) as AssetServiceStatus)}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                                            >
                                                {(() => {
                                                    const Icon = statusTransitionMap[detail.Status].icon;
                                                    return <Icon className="w-3 h-3" />;
                                                })()}
                                                <span className="text-[11px]">{statusTransitionMap[detail.Status].label}</span>
                                            </button>
                                        ) : (
                                            <span className="text-xs text-slate-400">No further action</span>
                                        )}
                                    </div>
                                    <div className="mt-2 border-t border-slate-100 pt-3">
                                        <p className="text-slate-500 text-xs uppercase tracking-wide">Issue</p>
                                        <p className="text-sm text-slate-700 mt-1">{detail.ProblemDescription}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 text-center text-slate-600">No service record selected.</div>
                )}
            </Dialog>

            <Dialog
                title="Confirm status change"
                description={statusConfirmMessage || 'Confirm status change'}
                open={isStatusConfirmOpen}
                onOpenChange={(open) => {
                    setIsStatusConfirmOpen(open);
                    if (!open) setStatusChangeCandidate(null);
                }}
                onConfirm={applyStatusConfirm}
                confirmText="Proceed"
                cancelText="Cancel"
                loading={loading}
            >
                <p className="text-sm text-slate-600">This action will update the current service detail status and recompute the record status.</p>
            </Dialog>

            <Dialog
                title="Verification overview"
                description={reviewRecord ? `Review items for ${reviewRecord.ServiceNumber}` : ''}
                open={reviewModalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setReviewModalOpen(false);
                        setReviewRecord(null);
                        setDetailReviewStatus({});
                        setHeaderFinalNote('');
                    }
                }}
                onConfirm={applyReviewResults}
                confirmText={hasStillRepairingItems ? 'Done' : 'Finalize'}
                cancelText="Cancel"
                loading={reviewLoading}
            >
                <div className="space-y-4 mt-2 max-h-[60vh] overflow-auto pr-1">
                    {(reviewRecord?.details ?? []).map((detail) => (
                        <div key={detail.ServiceRecordDetailID} className="border border-slate-200 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold">{getItemDescription(detail)}</p>
                                    <p className="text-xs text-slate-500">Property: {detail.PropertyNumber || '-'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400">Current: {statusLabel(detail.Status)}</p>
                                </div>
                            </div>
                            <div className="mt-2 flex items-center gap-6">
                                <label className="inline-flex items-center gap-2 text-xs">
                                    <input
                                        type="radio"
                                        name={`detail-review-${detail.ServiceRecordDetailID}`}
                                        checked={detailReviewStatus[detail.ServiceRecordDetailID] === 'fixed'}
                                        onChange={() => setDetailReviewStatus((prev) => ({ ...prev, [detail.ServiceRecordDetailID]: 'fixed' }))}
                                    />
                                    Fixed
                                </label>
                                <label className="inline-flex items-center gap-2 text-xs">
                                    <input
                                        type="radio"
                                        name={`detail-review-${detail.ServiceRecordDetailID}`}
                                        checked={detailReviewStatus[detail.ServiceRecordDetailID] === 'unrepairable'}
                                        onChange={() => setDetailReviewStatus((prev) => ({ ...prev, [detail.ServiceRecordDetailID]: 'unrepairable' }))}
                                    />
                                    Unrepairable
                                </label>
                                <label className="inline-flex items-center gap-2 text-xs">
                                    <input
                                        type="radio"
                                        name={`detail-review-${detail.ServiceRecordDetailID}`}
                                        checked={detailReviewStatus[detail.ServiceRecordDetailID] === 'repair_in_progress'}
                                        onChange={() => setDetailReviewStatus((prev) => ({ ...prev, [detail.ServiceRecordDetailID]: 'repair_in_progress' }))}
                                    />
                                    Still repairing
                                </label>
                            </div>
                        </div>
                    ))}

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Final notes</label>
                        <textarea
                            value={headerFinalNote}
                            onChange={(e) => setHeaderFinalNote(e.target.value)}
                            placeholder="Summary or final notes for service record"
                            className="mt-1 block w-full rounded-md border border-slate-300 p-2 focus:border-[var(--primary)] focus:ring focus:ring-[var(--primary)]/30"
                            rows={3}
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
