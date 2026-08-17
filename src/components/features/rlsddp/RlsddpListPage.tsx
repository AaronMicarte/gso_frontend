'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    Search,
    Plus,
    Eye,
    Edit,
    Package,
    RefreshCw,
    CheckCircle,
    XCircle,
    Building2,
    ShieldAlert,
} from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import { rlsddpAPI } from '@/lib/api/rlsddp';
import { PropertyRlsddpReport, RlsddpStatus } from '@/types/propertyRlsddp';
import { TransferDepartment } from '@/types/propertyTransfer';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';
import { RlsddpDetailPage } from './RlsddpDetailPage';

interface RlsddpListPageProps {
    baseRoute: string;
    pageTitle?: string;
    pageDescription?: string;
}

const statusBadgeStyles: Record<RlsddpStatus, string> = {
    Lost: 'bg-amber-100 text-amber-800',
    Stolen: 'bg-rose-100 text-rose-800',
    Damaged: 'bg-orange-100 text-orange-800',
    Destroyed: 'bg-red-100 text-red-800',
};

export function RlsddpListPage({
    baseRoute,
    pageTitle = 'Report of Lost, Stolen, Damaged or Destroyed Property',
    pageDescription = 'Manage delivery receipts and incident reports for lost, stolen, damaged, or destroyed assets',
}: RlsddpListPageProps) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedDept, setSelectedDept] = useState<number | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | RlsddpStatus>('all');
    const [departments, setDepartments] = useState<TransferDepartment[]>([]);

    const [reports, setReports] = useState<PropertyRlsddpReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [meta, setMeta] = useState<{ current_page: number; last_page: number; per_page: number; total: number } | null>(null);

    const [isViewOpen, setIsViewOpen] = useState(false);
    const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [search]);

    const loadDepartments = useCallback(async () => {
        try {
            const data = await rlsddpAPI.getDepartments();
            setDepartments(data || []);
        } catch {
            console.error('Failed to load departments');
        }
    }, []);

    const fetchReports = useCallback(async () => {
        try {
            setIsFetching(true);
            const res = await rlsddpAPI.getReports({
                search: debouncedSearch || undefined,
                department_id: selectedDept !== 'all' ? Number(selectedDept) : undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                page,
                per_page: 10,
            });
            setReports(res.data || []);
            setMeta({
                current_page: res.current_page,
                last_page: res.last_page,
                per_page: res.per_page,
                total: res.total,
            });
        } catch {
            toast.error('Failed to load RLSDDP reports');
        } finally {
            setIsLoading(false);
            setIsFetching(false);
        }
    }, [debouncedSearch, selectedDept, statusFilter, page]);

    useEffect(() => {
        loadDepartments();
    }, [loadDepartments]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleRefresh = () => {
        fetchReports();
        toast.success('RLSDDP reports refreshed');
    };

    const handleOpenChange = (open: boolean) => {
        setIsViewOpen(open);
        if (!open) {
            setSelectedReportId(null);
            fetchReports();
        }
    };

    const handleView = (id: number) => {
        setSelectedReportId(id);
        setIsViewOpen(true);
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Header matching DeliveryReceiptsPage */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
                        <p className="text-slate-500 text-sm">{pageDescription}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={isFetching}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <Link
                            href={`${baseRoute}/new`}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New RLSDDP Report
                        </Link>
                    </div>
                </div>

                {/* Filters matching DeliveryReceiptsPage */}
                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search RLSDDP Number, Officer, or Department..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') setPage(1); }}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={selectedDept}
                            onChange={(e) => { setSelectedDept(e.target.value === 'all' ? 'all' : Number(e.target.value)); setPage(1); }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            title="Department"
                        >
                            <option value="all">All departments</option>
                            {departments.map((d) => (
                                <option key={d.DepartmentID} value={d.DepartmentID}>
                                    {d.DepartmentName}
                                </option>
                            ))}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value as 'all' | RlsddpStatus); setPage(1); }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            title="Status"
                        >
                            <option value="all">All statuses</option>
                            <option value="Lost">Lost</option>
                            <option value="Stolen">Stolen</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Destroyed">Destroyed</option>
                        </select>
                    </div>
                </div>

                {/* Table matching DeliveryReceiptsPage */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">RLSDDP Number</th>
                                    <th className="px-6 py-4">Department</th>
                                    <th className="px-6 py-4">Accountable Officer</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Police Notified</th>
                                    <th className="px-6 py-4">Date Reported to Police</th>
                                    <th className="px-6 py-4">Date Created</th>
                                    <th className="px-6 py-4">Items Count</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {isLoading ? (
                                    <TableSkeletonRows columns={9} rows={10} />
                                ) : reports.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No RLSDDP reports found
                                        </td>
                                    </tr>
                                ) : (
                                    reports.map((report) => (
                                        <tr key={report.RlsddpID} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {report.RlsddpNumber}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {report.department?.DepartmentName || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {report.AccountableOfficer}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeStyles[report.Status] || 'bg-slate-100 text-slate-800'}`}>
                                                    {report.Status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {report.PoliceNotified ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                        Yes {report.PoliceStation ? `(${report.PoliceStation})` : ''}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-xs">
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        No
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {report.PoliceNotified && report.DateReported
                                                    ? format(toZonedTime(new Date(report.DateReported), 'Asia/Manila'), 'MMM dd, yyyy')
                                                    : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {format(toZonedTime(new Date(report.created_at), 'Asia/Manila'), 'MMM dd, yyyy')}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium">
                                                {report.items?.length || 0} item(s)
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleView(report.RlsddpID)}
                                                        className="p-2 text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <Link
                                                        href={`${baseRoute}/${report.RlsddpID}/edit`}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination matching DeliveryReceiptsPage */}
                    {meta && meta.last_page > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-500">
                                    Showing {((meta.current_page - 1) * meta.per_page) + 1} to {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} entries
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(Math.max(1, page - 1))}
                                        disabled={page === 1 || isFetching}
                                        className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-slate-600">
                                        Page {meta.current_page} of {meta.last_page}
                                    </span>
                                    <button
                                        onClick={() => setPage(Math.min(meta.last_page, page + 1))}
                                        disabled={page === meta.last_page || isFetching}
                                        className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Radix UI Dialog Modal matching DeliveryReceiptsPage */}
            <DialogPrimitive.Root open={isViewOpen} onOpenChange={handleOpenChange}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 z-40" />
                    <DialogPrimitive.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl p-6">
                        <DialogPrimitive.Title className="sr-only">RLSDDP Details</DialogPrimitive.Title>
                        {selectedReportId ? (
                            <RlsddpDetailPage
                                baseRoute={baseRoute}
                                reportId={selectedReportId}
                                isModal
                                onClose={() => handleOpenChange(false)}
                            />
                        ) : null}
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </div>
    );
}
