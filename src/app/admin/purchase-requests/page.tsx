'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePurchaseRequests, useDeletePurchaseRequest } from '@/lib/hooks/usePurchaseRequests';
import { showConfirmDialog } from '@/lib/utils/confirm';
import {
    Plus,
    Search,
    FileText,
    Eye,
    Trash2,
    RefreshCw,
    Filter,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';
import { format } from 'date-fns';

export default function PurchaseRequestsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Initialize status filter from URL params
    useEffect(() => {
        const statusParam = searchParams.get('status');
        if (statusParam) {
            setStatusFilter(parseInt(statusParam));
        }
    }, [searchParams]);

    const { data, isLoading, refetch } = usePurchaseRequests({
        search: debouncedSearch || undefined,
        status: statusFilter,
        page: currentPage,
        per_page: 10,
        sort_by: 'CreatedDate',
        sort_order: 'desc',
    });

    const deleteMutation = useDeletePurchaseRequest();

    const purchaseRequests = data?.data || [];
    const pagination = data;
    const totalPages = pagination?.last_page || 1;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Refetch when component mounts to ensure fresh data
    useEffect(() => {
        refetch();
    }, []);

    const handleDelete = (id: number, prNumber: string) => {
        showConfirmDialog({
            title: 'Delete Purchase Request',
            description: `Are you sure you want to delete PR #${prNumber}? This action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: () => {
                deleteMutation.mutate(id);
            },
        });
    };

    const getStatusBadge = (statusId: number, statusName: string) => {
        switch (statusId) {
            case 1: // Pending
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3" />
                        {statusName}
                    </span>
                );
            case 2: // Approved
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        {statusName}
                    </span>
                );
            case 3: // Rejected
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        {statusName}
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {statusName}
                    </span>
                );
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Purchase Requests</h1>
                    <p className="text-slate-500">Manage procurement requests</p>
                </div>
                <button
                    onClick={() => router.push('/admin/purchase-requests/new')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create New PR
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by PR Number or Purpose..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        value={statusFilter || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setStatusFilter(val ? parseInt(val) : undefined);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] text-sm"
                    >
                        <option value="">All Statuses</option>
                        <option value="1">Pending</option>
                        <option value="2">Approved</option>
                        <option value="3">Rejected</option>
                        <option value="4">Completed</option>
                    </select>
                </div>
                <button
                    onClick={() => refetch()}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">PR Number</th>
                                <th className="px-6 py-4">Date Requested</th>
                                <th className="px-6 py-4">Date Approved</th>
                                <th className="px-6 py-4">Requested By</th>
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4">Purpose</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-64"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : purchaseRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                        <p className="font-medium">No purchase requests found</p>
                                        <p className="text-xs mt-1">Try adjusting your search or filters</p>
                                    </td>
                                </tr>
                            ) : (
                                purchaseRequests.map((pr) => (
                                    <tr key={pr.PurchaseRequestID} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {pr.PRNumber}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {format(new Date(pr.DateRequested), 'MMM dd, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {pr.DateApproved ? format(new Date(pr.DateApproved), 'MMM dd, yyyy') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {pr.requester?.FullName || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {pr.department?.DepartmentName || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={pr.Purpose}>
                                            {pr.Purpose}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(pr.PRStatusID, pr.status?.StatusName || 'Unknown')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => router.push(`/admin/purchase-requests/${pr.PurchaseRequestID}`)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {pr.PRStatusID === 1 && (
                                                    <button
                                                        onClick={() => handleDelete(pr.PurchaseRequestID, pr.PRNumber)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                            Page {pagination?.current_page} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
