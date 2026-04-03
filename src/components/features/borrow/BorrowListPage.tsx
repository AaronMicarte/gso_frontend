'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, RefreshCw, Search, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

import borrowAPI from '@/lib/api/borrow';
import { PropertyBorrow, BorrowStatus } from '@/types/propertyBorrow';
import { useAuth } from '@/lib/hooks/useAuth';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';

type BorrowStatusBadge = BorrowStatus | 'overdue';

const statusConfig: Record<BorrowStatusBadge, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
    approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
    borrowed: { label: 'Borrowed', className: 'bg-indigo-100 text-indigo-800' },
    partially_returned: { label: 'Partially Returned', className: 'bg-cyan-100 text-cyan-800' },
    returned: { label: 'Returned', className: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', className: 'bg-slate-200 text-slate-700' },
    overdue: { label: 'Overdue', className: 'bg-rose-100 text-rose-700' },
};

interface BorrowListPageProps {
    baseRoute: string;
    scope?: 'incoming' | 'outgoing';
    pageTitle?: string;
    pageDescription?: string;
    showCreate?: boolean;
}

export function BorrowListPage({
    baseRoute,
    scope,
    pageTitle,
    pageDescription,
    showCreate,
}: BorrowListPageProps) {
    const { user } = useAuth();
    const [rows, setRows] = useState<PropertyBorrow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<BorrowStatus | 'all'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const canCreate = showCreate ?? (user?.UserRoleID === 4);

    const loadBorrows = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const data = await borrowAPI.getAll({
                page,
                per_page: 15,
                search: searchTerm || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                scope,
            });

            setRows(data.data || []);
            setCurrentPage(data.current_page);
            setTotalPages(data.last_page);
        } catch {
            toast.error('Failed to load borrow requests');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, statusFilter, scope]);

    useEffect(() => {
        loadBorrows(1);
    }, [loadBorrows]);

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        loadBorrows(page);
    };

    const formatDate = (dateString?: string | null) => {
        if (!dateString) return 'Missing date';
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'MMM dd, yyyy');
    };

    const isOverdue = (borrow: PropertyBorrow) => {
        if (borrow.Status !== 'borrowed' && borrow.Status !== 'partially_returned') return false;
        const dueDate = borrow.DueDate ? new Date(borrow.DueDate) : null;
        if (!dueDate) return false;
        const due = toZonedTime(dueDate, 'Asia/Manila');
        const now = toZonedTime(new Date(), 'Asia/Manila');
        return due < now;
    };

    const displayText = (value: string | null | undefined, missingLabel: string) => {
        const text = value?.trim();
        return text && text.length > 0 ? text : missingLabel;
    };

    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const searchLower = searchTerm.toLowerCase();
        return rows.filter((row) => (
            row.BorrowNumber?.toLowerCase().includes(searchLower) ||
            row.fromDepartment?.DepartmentName?.toLowerCase().includes(searchLower) ||
            row.toDepartment?.DepartmentName?.toLowerCase().includes(searchLower) ||
            row.requestedBy?.FullName?.toLowerCase().includes(searchLower) ||
            row.requestedBy?.department?.DepartmentName?.toLowerCase().includes(searchLower)
        ));
    }, [rows, searchTerm]);

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{pageTitle || 'Property Borrowing'}</h1>
                        <p className="text-slate-500 text-sm">{pageDescription || 'Track temporary borrow requests and return dates'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {canCreate && (
                            <Link
                                href={`${baseRoute}/new`}
                                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-white text-sm hover:bg-[var(--primary-hover)]"
                            >
                                <CalendarClock className="h-4 w-4" />
                                Create Borrow
                            </Link>
                        )}
                        <button
                            onClick={() => loadBorrows(currentPage)}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by PBR number, department, or requester"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as BorrowStatus | 'all')}
                            className="px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        >
                            <option value="all">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="borrowed">Borrowed</option>
                            <option value="partially_returned">Partially Returned</option>
                            <option value="returned">Returned</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">PBR #</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">From</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">To</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Requester</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Items</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loading ? (
                                    <TableSkeletonRows columns={8} rows={10} cellClassName="px-4 py-3" />
                                ) : filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                            No borrow requests found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((borrow) => {
                                        const status: BorrowStatusBadge = isOverdue(borrow) ? 'overdue' : borrow.Status;
                                        return (
                                            <tr key={borrow.BorrowID} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                                    {borrow.BorrowNumber}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    {displayText(borrow.fromDepartment?.DepartmentName, 'Missing department')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    {displayText(borrow.toDepartment?.DepartmentName, 'Missing department')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    {displayText(borrow.requestedBy?.FullName, 'Missing requester')}
                                                    {borrow.requestedBy?.department?.DepartmentName
                                                        ? ` - ${borrow.requestedBy.department.DepartmentName}`
                                                        : ''}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    {formatDate(borrow.DueDate)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    {borrow.items_count ?? borrow.items?.length ?? 0}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[status].className}`}>
                                                        {statusConfig[status].label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-center">
                                                    <div className="inline-flex items-center justify-center gap-3 text-slate-400">
                                                        <Link
                                                            href={`${baseRoute}/${borrow.BorrowID}`}
                                                            className="hover:text-slate-700"
                                                            aria-label={`View ${borrow.BorrowNumber}`}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                            <span className="sr-only">View</span>
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage <= 1}
                                className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage >= totalPages}
                                className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
