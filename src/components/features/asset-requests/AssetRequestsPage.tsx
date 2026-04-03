'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Plus,
    Eye,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Search,
    RefreshCw,
    Package
} from 'lucide-react';
import assetIssuanceAPI from '@/lib/api/assetIssuance';
import { AssetRequest, AssetRequestFilters } from '@/types/assetIssuance';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    waiting_for_issuance: { label: 'Waiting for Issuance', color: 'bg-emerald-100 text-emerald-800', icon: Clock },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
    issued: { label: 'Issued', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    received: { label: 'Received', color: 'bg-purple-100 text-purple-800', icon: Package },
    cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
};

interface AssetRequestsPageProps {
    baseRoute: string;
    canCreate?: boolean;
    isAdmin?: boolean;
}

export function AssetRequestsPage({ baseRoute, canCreate: initialCanCreate = true, isAdmin = false }: AssetRequestsPageProps) {
    const canCreate = initialCanCreate && !isAdmin;
    const [requests, setRequests] = useState<AssetRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<AssetRequestFilters>({
        status: undefined,
        from_date: '',
        to_date: '',
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadRequests = async (page = 1) => {
        try {
            setLoading(true);
            const response = await assetIssuanceAPI.requests.getAll({
                ...filters,
                page,
                per_page: 15,
            });

            setRequests(response.data);
            setCurrentPage(response.current_page);
            setTotalPages(response.last_page);
        } catch (error) {
            toast.error('Failed to load asset requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, [filters]);

    const handleFilterChange = (key: keyof AssetRequestFilters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    const handleRefresh = () => {
        loadRequests(currentPage);
        toast.success('Asset requests refreshed');
    };

    const filteredRequests = requests.filter(request =>
        request.RequestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requester?.FullName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (dateString: string) => {
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'MMM dd, yyyy');
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Asset Requests</h1>
                        <p className="text-slate-500 text-sm">
                            {isAdmin ? 'Review and manage all asset requests from departments' : 'Manage asset requests for your department'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        {canCreate && (
                            <Link
                                href={`${baseRoute}/asset-requests/new`}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                New Request
                            </Link>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search request number or requester name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                    </div>
                    <select
                        value={filters.status || ''}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    >
                        <option value="">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="waiting_for_issuance">Waiting for Issuance</option>
                        <option value="rejected">Rejected</option>
                        <option value="issued">Issued</option>
                        <option value="received">Received</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <input
                        type="date"
                        value={filters.from_date || ''}
                        onChange={(e) => handleFilterChange('from_date', e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        placeholder="From date"
                    />
                    <input
                        type="date"
                        value={filters.to_date || ''}
                        onChange={(e) => handleFilterChange('to_date', e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        placeholder="To date"
                    />
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Request Number</th>
                                    <th className="px-6 py-4">Requester</th>
                                    <th className="px-6 py-4">Department</th>
                                    <th className="px-6 py-4">Date Requested</th>
                                    <th className="px-6 py-4">Items</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loading ? (
                                    <TableSkeletonRows columns={7} rows={10} />
                                ) : filteredRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No asset requests found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRequests.map((request) => {
                                        const statusInfo = statusConfig[request.Status];
                                        const StatusIcon = statusInfo.icon;

                                        return (
                                            <tr key={request.RequestID} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 font-medium text-slate-900">
                                                    {request.RequestNumber}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {request.requester?.FullName || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {request.department?.DepartmentName || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {formatDate(request.RequestDate)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {request.details?.length || 0} items
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link
                                                            href={`${baseRoute}/asset-requests/${request.RequestID}`}
                                                            className="p-2 text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                                                            title="View Details"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Link>
                                                        {isAdmin && request.Status === 'pending' && (
                                                            <Link
                                                                href={`${baseRoute}/asset-requests/${request.RequestID}/review`}
                                                                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Review Request"
                                                            >
                                                                <CheckCircle className="w-4 h-4" />
                                                            </Link>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                            <button
                                onClick={() => loadRequests(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => loadRequests(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
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