'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Plus,
    Eye,
    Clock,
    CheckCircle,
    AlertCircle,
    Search,
    RefreshCw,
    Package,
    Download,
    Archive,
    ChevronDown,
    ChevronRight,
    Users,
    FileText,
    User
} from 'lucide-react';
import issuanceAPI from '@/lib/api/issuance';
import { AssetIssuance, AssetIssuanceFilters } from '@/types/assetIssuance';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

const statusConfig = {
    pending_acknowledgment: {
        label: 'Pending Acknowledgment',
        color: 'bg-yellow-100 text-yellow-800',
        icon: Clock
    },
    acknowledged: {
        label: 'Acknowledged',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle
    },
    returned: {
        label: 'Returned',
        color: 'bg-blue-100 text-blue-800',
        icon: AlertCircle
    },
    disposed: {
        label: 'Disposed',
        color: 'bg-gray-100 text-gray-800',
        icon: Archive
    },
};

const documentTypeConfig = {
    PAR: {
        label: 'PAR',
        color: 'bg-purple-100 text-purple-800',
        fullName: 'Property Acknowledgment Receipt'
    },
    ICS: {
        label: 'ICS',
        color: 'bg-indigo-100 text-indigo-800',
        fullName: 'Inventory Custodian Slip'
    },
};

interface GroupedIssuance {
    RequestID: number;
    RequestNumber: string;
    RequestDate: string;
    requester: {
        FullName: string;
        Department: string;
    };
    department: {
        DepartmentName: string;
    };
    issuances: AssetIssuance[];
    totalItems: number;
    isExpanded?: boolean;
}

interface IssuanceListPageProps {
    baseRoute: string;
    canIssue?: boolean;
    isAdmin?: boolean;
}

export function IssuanceListPage({ baseRoute, canIssue = false }: IssuanceListPageProps) {
    const [groupedIssuances, setGroupedIssuances] = useState<GroupedIssuance[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<AssetIssuanceFilters>({
        status: undefined,
        document_type: undefined,
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadIssuances = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const response = await issuanceAPI.getAll({
                ...filters,
                page,
                per_page: 15,
            });

            setGroupedIssuances(response.data);
            setCurrentPage(response.current_page);
            setTotalPages(response.last_page);
        } catch (error) {
            console.error('Failed to load issuances:', error);
            toast.error('Failed to load asset issuances');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadIssuances(1);
    }, [loadIssuances]);

    const handleRefresh = () => {
        loadIssuances(currentPage);
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            loadIssuances(page);
        }
    };

    const toggleExpand = (requestId: number) => {
        setGroupedIssuances(prev => prev.map(group =>
            group.RequestID === requestId
                ? { ...group, isExpanded: !group.isExpanded }
                : group
        ));
    };

    const handleDownloadDocument = async (issuance: AssetIssuance) => {
        try {
            const blob = await issuanceAPI.generateDocument(issuance.IssuanceID, issuance.DocumentType);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${issuance.DocumentNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success(`Downloaded ${issuance.DocumentNumber}`);
        } catch (error) {
            console.error('Failed to download document:', error);
            toast.error('Failed to download document');
        }
    };

    const filteredGroupedIssuances = groupedIssuances.filter(group => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            group.RequestNumber.toLowerCase().includes(searchLower) ||
            group.requester.FullName.toLowerCase().includes(searchLower) ||
            group.department.DepartmentName.toLowerCase().includes(searchLower) ||
            group.issuances.some(issuance =>
                issuance.DocumentNumber.toLowerCase().includes(searchLower)
            )
        );
    });

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Asset Issuances</h1>
                        <p className="text-slate-500 text-sm">
                            Manage property issuance records grouped by requests (PAR/ICS)
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
                        {canIssue && (
                            <Link
                                href={`${baseRoute}/new`}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Issue Assets
                            </Link>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search request number, requester, department, or document number..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={filters.status || ''}
                                onChange={(e) => setFilters(prev => ({ ...prev, status: (e.target.value || undefined) as AssetIssuanceFilters['status'] }))}
                                className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            >
                                <option value="">All Status</option>
                                <option value="pending_acknowledgment">Pending Acknowledgment</option>
                                <option value="acknowledged">Acknowledged</option>
                                <option value="returned">Returned</option>
                                <option value="disposed">Disposed</option>
                            </select>
                            <select
                                value={filters.document_type || ''}
                                onChange={(e) => setFilters(prev => ({ ...prev, document_type: (e.target.value || undefined) as AssetIssuanceFilters['document_type'] }))}
                                className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            >
                                <option value="">All Types</option>
                                <option value="PAR">PAR Only</option>
                                <option value="ICS">ICS Only</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Grouped Issuances List */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--primary)]"></div>
                                Loading asset issuances...
                            </div>
                        </div>
                    ) : filteredGroupedIssuances.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <h3 className="text-lg font-medium text-slate-400 mb-1">No Issuances Found</h3>
                            <p className="text-sm text-slate-400">
                                {searchTerm ? 'Try adjusting your search terms' : 'No asset issuances have been created yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {filteredGroupedIssuances.map((group) => (
                                <div key={group.RequestID} className="transition-all duration-200">
                                    {/* Request Header */}
                                    <div
                                        className="p-4 hover:bg-slate-50 cursor-pointer"
                                        onClick={() => toggleExpand(group.RequestID)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {group.isExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                                )}
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
                                                        <FileText className="w-5 h-5 text-[var(--primary)]" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-slate-900">
                                                            {group.RequestNumber}
                                                        </h3>
                                                        <div className="flex items-center gap-4 text-sm text-slate-500">
                                                            <span className="flex items-center gap-1">
                                                                <User className="w-3 h-3" />
                                                                {group.requester.FullName}
                                                            </span>
                                                            <span>{group.department.DepartmentName}</span>
                                                            <span>{format(toZonedTime(new Date(group.RequestDate), 'Asia/Manila'), 'MMM dd, yyyy')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right text-sm">
                                                    <div className="font-medium text-slate-900">
                                                        {group.issuances.length} Issuance{group.issuances.length !== 1 ? 's' : ''}
                                                    </div>
                                                    <div className="text-slate-500">
                                                        {group.totalItems} Item{group.totalItems !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Issuances */}
                                    {group.isExpanded && (
                                        <div className="bg-slate-50 border-t border-slate-100">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-100">
                                                <div className="grid grid-cols-5 gap-4 text-xs font-medium text-slate-600 uppercase tracking-wider">
                                                    <div>Document</div>
                                                    <div>Type</div>
                                                    <div>Issued To</div>
                                                    <div>Status</div>
                                                    <div className="text-right">Actions</div>
                                                </div>
                                            </div>
                                            <div className="divide-y divide-slate-200">
                                                {group.issuances.map((issuance) => {
                                                    const StatusIcon = statusConfig[issuance.Status]?.icon || AlertCircle;
                                                    return (
                                                        <div key={issuance.IssuanceID} className="px-4 py-3 hover:bg-white transition-colors">
                                                            <div className="grid grid-cols-5 gap-4 items-center">
                                                                <div>
                                                                    <div className="font-medium text-slate-900">
                                                                        {issuance.DocumentNumber}
                                                                    </div>
                                                                    <div className="text-sm text-slate-500">
                                                                        {format(toZonedTime(new Date(issuance.IssuanceDate), 'Asia/Manila'), 'MMM dd, yyyy')}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${documentTypeConfig[issuance.DocumentType]?.color || 'bg-gray-100 text-gray-800'}`}>
                                                                        {documentTypeConfig[issuance.DocumentType]?.label || issuance.DocumentType}
                                                                    </span>
                                                                </div>
                                                                <div className="text-sm">
                                                                    <div className="font-medium text-slate-900">
                                                                        {issuance.issuedToUser?.FullName || issuance.IssuedToName || 'N/A'}
                                                                    </div>
                                                                    {issuance.issuedToUser?.Department && (
                                                                        <div className="text-slate-500">
                                                                            {issuance.issuedToUser.Department}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[issuance.Status]?.color || 'bg-gray-100 text-gray-800'}`}>
                                                                        <StatusIcon className="w-3 h-3" />
                                                                        {statusConfig[issuance.Status]?.label || issuance.Status}
                                                                    </span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <Link
                                                                            href={`${baseRoute}/${issuance.IssuanceID}`}
                                                                            className="p-1.5 text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                                                                            title="View Details"
                                                                        >
                                                                            <Eye className="w-4 h-4" />
                                                                        </Link>
                                                                        <button
                                                                            onClick={() => handleDownloadDocument(issuance)}
                                                                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                            title={`Download ${issuance.DocumentType}`}
                                                                        >
                                                                            <Download className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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