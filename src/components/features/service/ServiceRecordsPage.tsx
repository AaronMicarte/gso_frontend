'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Plus, RefreshCw, Search, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

import { Dialog } from '@/components/ui/Dialog';

import serviceApi from '@/lib/api/assetServices';
import { AssetServiceRecord, AssetServiceStatus } from '@/types/assetService';

const statusClasses: Record<AssetServiceStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    under_review: 'bg-sky-100 text-sky-800',
    work_approved: 'bg-indigo-100 text-indigo-800',
    repair_in_progress: 'bg-violet-100 text-violet-800',
    verification: 'bg-cyan-100 text-cyan-800',
    closed: 'bg-emerald-100 text-emerald-800',
    unrepairable: 'bg-rose-100 text-rose-800',
};

const statusLabel = (status: AssetServiceStatus) => status.replaceAll('_', ' ');

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
                            <option value="under_review">Under Review</option>
                            <option value="work_approved">Work Approved</option>
                            <option value="repair_in_progress">Repair In Progress</option>
                            <option value="verification">Verification</option>
                            <option value="closed">Closed</option>
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
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading...</td>
                                    </tr>
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
                            {selectedRecord.RecordNotes && <div><span className="font-medium">Notes:</span> {selectedRecord.RecordNotes}</div>}
                        </div>
                        <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
                            {selectedRecord.details.map((detail) => (
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

                                    <div className="mt-4 border-t border-slate-100 pt-3">
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
        </div>
    );
}
