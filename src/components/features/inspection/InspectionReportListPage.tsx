'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ClipboardCheck, Eye, Package, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useInspectionReports } from '@/lib/hooks/useInspection';
import { ViewIARPage } from '@/components/features/iar/ViewIARPage';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';

interface InspectionReportListPageProps {
    baseRoute: string;
    status?: 'pending' | 'inspected';
    title?: string;
    subtitle?: string;
}

export function InspectionReportListPage({ baseRoute, status, title, subtitle }: InspectionReportListPageProps) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'inspected'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

    const { data, isLoading } = useInspectionReports({
        page,
        per_page: 10,
        // allow initial status prop (from dashboard) but override with filter dropdown when set
        ...(statusFilter !== 'all' ? { status: statusFilter } : status ? { status } : {}),
        ...(search ? { query: search } : {}),
        ...(startDate ? { start_date: startDate } : {}),
        ...(endDate ? { end_date: endDate } : {}),
    });

    const handleOpenChange = (open: boolean) => {
        setIsViewOpen(open);
        if (!open) setSelectedReportId(null);
    };

    const handleView = (id: number) => {
        setSelectedReportId(id);
        setIsViewOpen(true);
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{title || 'Inspection Reports'}</h1>
                        <p className="text-slate-500 text-sm">{subtitle || 'Inspection records for delivered items'}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search IAR Number or DR Number..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') setPage(1); }}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-56">
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value as 'all' | 'pending' | 'inspected'); setPage(1); }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            title="Filter by status"
                        >
                            <option value="all">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="inspected">Inspected</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            title="Start date"
                        />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            title="End date"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Report #</th>
                                    <th className="px-6 py-4">DR Number</th>
                                    <th className="px-6 py-4">Supplier</th>
                                    <th className="px-6 py-4">Date Inspected</th>
                                    <th className="px-6 py-4">Inspected By</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {isLoading ? (
                                    <TableSkeletonRows columns={7} rows={10} />
                                ) : data?.data?.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No inspection reports found
                                        </td>
                                    </tr>
                                ) : (
                                    data?.data?.map((report) => (
                                        <tr key={report.IARID} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">{report.IARNumber || `IAR-${report.IARID}`}</td>
                                            <td className="px-6 py-4 text-slate-600">{report.deliveryReceipt?.DRNumber || report.delivery_receipt?.DRNumber || 'N/A'}</td>
                                            <td className="px-6 py-4 text-slate-600">{report.deliveryReceipt?.SupplierName || report.delivery_receipt?.SupplierName || 'N/A'}</td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {format(toZonedTime(new Date(report.DateInspected), 'Asia/Manila'), 'MMM dd, yyyy')}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{report.inspectedByUser?.FullName || report.inspected_by_user?.FullName || 'N/A'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${report.Status === 'inspected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    <ClipboardCheck className="w-3 h-3" />
                                                    {report.Status === 'inspected' ? 'Inspected' : 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => handleView(report.IARID)}
                                                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                    title="View Details"
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

                    {data && data.last_page > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-500">
                                    Showing {((data.current_page - 1) * data.per_page) + 1} to {Math.min(data.current_page * data.per_page, data.total)} of {data.total} entries
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(Math.max(1, page - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-slate-600">
                                        Page {data.current_page} of {data.last_page}
                                    </span>
                                    <button
                                        onClick={() => setPage(Math.min(data.last_page, page + 1))}
                                        disabled={page === data.last_page}
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

            <DialogPrimitive.Root open={isViewOpen} onOpenChange={handleOpenChange}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 z-40" />
                    <DialogPrimitive.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
                        <DialogPrimitive.Title className="sr-only">Inspection and Acceptance Report Details</DialogPrimitive.Title>
                        {selectedReportId ? (
                            <ViewIARPage baseRoute={baseRoute} iarId={selectedReportId} isModal onClose={() => handleOpenChange(false)} />
                        ) : null}
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </div>
    );
}
