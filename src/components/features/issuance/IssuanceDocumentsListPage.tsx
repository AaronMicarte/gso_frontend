'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    Archive,
    CheckCircle,
    Clock,
    Download,
    Eye,
    Package,
    RefreshCw,
    Search,
    User
} from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

import issuanceAPI from '@/lib/api/issuance';
import { AssetIssuance, AssetIssuanceFilters } from '@/types/assetIssuance';

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
} satisfies Record<AssetIssuance['Status'], { label: string; color: string; icon: typeof AlertCircle }>;

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
} satisfies Record<AssetIssuance['DocumentType'], { label: string; color: string; fullName: string }>;

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
}

interface IssuanceRow {
    RequestID: number;
    RequestNumber: string;
    RequestDate: string;
    requesterName: string;
    departmentName: string;
    issuance: AssetIssuance;
    itemsCount: number;
}

interface IssuanceDocumentsListPageProps {
    baseRoute: string;
    pageTitle?: string;
    pageDescription?: string;
    fixedDocumentType: 'PAR' | 'ICS';
}

const DOCUMENTS_PER_PAGE = 10;

function safeDate(dateValue: string | null | undefined): Date | null {
    if (!dateValue) return null;
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type CreatedTimeSource = Partial<{
    created_at: string | null;
    CreatedDate: string | null;
    createdAt: string | null;
    IssuanceDate: string | null;
    RequestDate: string | null;
}> | null | undefined;

function createdTime(value: CreatedTimeSource): number {
    if (!value) return 0;
    const candidates = [
        value.created_at,
        // some APIs use CreatedDate
        value.CreatedDate,
        // sometimes camelCase
        value.createdAt,
        // fallbacks
        value.IssuanceDate,
        value.RequestDate,
    ];

    for (const v of candidates) {
        if (!v) continue;
        const t = new Date(String(v)).getTime();
        if (!Number.isNaN(t)) return t;
    }

    return 0;
}

function formatPHDate(dateValue: string | null | undefined): string {
    const parsed = safeDate(dateValue);
    if (!parsed) return 'N/A';
    return format(toZonedTime(parsed, 'Asia/Manila'), 'MMM dd, yyyy');
}

export function IssuanceDocumentsListPage({
    baseRoute,
    pageTitle,
    pageDescription,
    fixedDocumentType,
}: IssuanceDocumentsListPageProps) {
    const [rows, setRows] = useState<IssuanceRow[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [filters, setFilters] = useState<AssetIssuanceFilters>(() => ({
        status: undefined,
        document_type: fixedDocumentType,
    }));
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalEntries, setTotalEntries] = useState(0);
    const [clientPaginated, setClientPaginated] = useState(false);

    const detailsBaseRoute = useMemo(
        () => baseRoute.replace(/\/(par|ics)\/?$/i, ''),
        [baseRoute]
    );

    // Keep the document type locked for this page.
    useEffect(() => {
        setFilters(prev => (
            prev.document_type === fixedDocumentType
                ? prev
                : { ...prev, document_type: fixedDocumentType }
        ));
    }, [fixedDocumentType]);

    const loadDocuments = useCallback(async (page = 1) => {
        try {
            setIsFetching(true);

            const response = await issuanceAPI.getAll({
                ...filters,
                page,
                per_page: DOCUMENTS_PER_PAGE,
            });

            const responseAny = response as unknown as {
                data?: GroupedIssuance[];
                current_page?: number;
                last_page?: number;
                total?: number;
                pagination?: {
                    current_page?: number;
                    last_page?: number;
                    total?: number;
                };
                meta?: {
                    current_page?: number;
                    last_page?: number;
                    total?: number;
                };
            };

            const grouped = Array.isArray(responseAny.data) ? responseAny.data : [];

            const sortedGroups = grouped.slice().sort((a, b) => {
                const aDate = safeDate(a.RequestDate)?.getTime() ?? 0;
                const bDate = safeDate(b.RequestDate)?.getTime() ?? 0;
                return bDate - aDate;
            });

            const flattened: IssuanceRow[] = [];
            for (const group of sortedGroups) {
                const issuances = group.issuances
                    .filter((issuance) => {
                        if (filters.document_type && issuance.DocumentType !== filters.document_type) return false;
                        if (filters.status && issuance.Status !== filters.status) return false;
                        return true;
                    });

                for (const issuance of issuances) {
                    const itemsCount = issuance.details?.length ?? 0;
                    flattened.push({
                        RequestID: group.RequestID,
                        RequestNumber: group.RequestNumber,
                        RequestDate: group.RequestDate,
                        requesterName: group.requester?.FullName ?? 'N/A',
                        departmentName: group.department?.DepartmentName ?? 'N/A',
                        issuance,
                        itemsCount,
                    });
                }
            }

            // Sort newest issuance first using creation timestamp if present.
            flattened.sort((a, b) => {
                const aDate = createdTime(a.issuance);
                const bDate = createdTime(b.issuance);
                if (aDate !== bDate) return bDate - aDate;
                return (b.issuance.IssuanceID ?? 0) - (a.issuance.IssuanceID ?? 0);
            });

            const rootLastPage = Number(responseAny.last_page);
            const rootCurrentPage = Number(responseAny.current_page);
            const rootTotal = Number(responseAny.total);
            const paginationLastPage = Number(responseAny.pagination?.last_page ?? responseAny.meta?.last_page);
            const paginationCurrentPage = Number(responseAny.pagination?.current_page ?? responseAny.meta?.current_page);
            const paginationTotal = Number(responseAny.pagination?.total ?? responseAny.meta?.total);

            const hasServerPagination =
                Number.isFinite(rootLastPage) || Number.isFinite(paginationLastPage);

            const resolvedLastPage = hasServerPagination
                ? Math.max(1, Number.isFinite(rootLastPage) && rootLastPage > 0 ? rootLastPage : (Number.isFinite(paginationLastPage) && paginationLastPage > 0 ? paginationLastPage : 1))
                : Math.max(1, Math.ceil(flattened.length / DOCUMENTS_PER_PAGE));

            const resolvedCurrentPage = hasServerPagination
                ? (Number.isFinite(rootCurrentPage) && rootCurrentPage > 0
                    ? rootCurrentPage
                    : (Number.isFinite(paginationCurrentPage) && paginationCurrentPage > 0 ? paginationCurrentPage : page))
                : page;

            const boundedCurrentPage = Math.min(Math.max(1, resolvedCurrentPage), resolvedLastPage);

            setClientPaginated(!hasServerPagination);

            // Ensure rows are sorted newest-first before setting state so top is latest
            flattened.sort((x, y) => {
                const xd = createdTime(x.issuance);
                const yd = createdTime(y.issuance);
                if (xd !== yd) return yd - xd;
                return (y.issuance.IssuanceID ?? 0) - (x.issuance.IssuanceID ?? 0);
            });

            setRows(flattened);
            setCurrentPage(boundedCurrentPage);
            setTotalPages(resolvedLastPage);
            setTotalEntries(
                hasServerPagination
                    ? (Number.isFinite(rootTotal) && rootTotal >= 0
                        ? rootTotal
                        : (Number.isFinite(paginationTotal) && paginationTotal >= 0 ? paginationTotal : flattened.length))
                    : flattened.length
            );
        } catch {
            toast.error('Failed to load issuance documents');
        } finally {
            setIsFetching(false);
            setIsInitialLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadDocuments(1);
    }, [loadDocuments]);

    const handleRefresh = () => {
        loadDocuments(currentPage);
    };

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        if (clientPaginated) {
            setCurrentPage(page);
            return;
        }

        loadDocuments(page);
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
        } catch {
            toast.error('Failed to download document');
        }
    };

    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const searchLower = searchTerm.toLowerCase();
        return rows.filter((row) => {
            const issuance = row.issuance;
            return (
                row.RequestNumber.toLowerCase().includes(searchLower) ||
                row.requesterName.toLowerCase().includes(searchLower) ||
                row.departmentName.toLowerCase().includes(searchLower) ||
                issuance.DocumentNumber.toLowerCase().includes(searchLower)
            );
        });
    }, [rows, searchTerm]);

    useEffect(() => {
        if (!clientPaginated) return;

        const computedTotalPages = Math.max(1, Math.ceil(filteredRows.length / DOCUMENTS_PER_PAGE));
        setTotalPages(computedTotalPages);
        setTotalEntries(filteredRows.length);
        setCurrentPage((prev) => Math.min(prev, computedTotalPages));
    }, [filteredRows.length, clientPaginated]);

    const visibleRows = useMemo(() => {
        if (!clientPaginated) return filteredRows;

        const startIndex = (currentPage - 1) * DOCUMENTS_PER_PAGE;
        return filteredRows.slice(startIndex, startIndex + DOCUMENTS_PER_PAGE);
    }, [filteredRows, currentPage, clientPaginated]);

    return (
        <div
            className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}
        >
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {pageTitle || `${fixedDocumentType} Documents`}
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {pageDescription || `Browse and manage ${documentTypeConfig[fixedDocumentType].fullName} documents (one-by-one)`}
                        </p>
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
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search document number, reference number, requester, or department..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={filters.status || ''}
                                onChange={(e) => setFilters(prev => ({
                                    ...prev,
                                    status: (e.target.value || undefined) as AssetIssuanceFilters['status']
                                }))}
                                className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            >
                                <option value="">All Status</option>
                                <option value="pending_acknowledgment">Pending Acknowledgment</option>
                                <option value="acknowledged">Acknowledged</option>
                                <option value="returned">Returned</option>
                                <option value="disposed">Disposed</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Flat Documents List */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {isInitialLoading && rows.length === 0 ? (
                        <div className="divide-y divide-slate-200">
                            {Array.from({ length: 8 }).map((_, index) => (
                                <div key={`issuance-skeleton-${index}`} className="p-4 animate-pulse">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 space-y-3">
                                            <div className="h-4 w-48 rounded bg-slate-200" />
                                            <div className="h-3 w-72 rounded bg-slate-200" />
                                            <div className="h-3 w-56 rounded bg-slate-200" />
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="h-8 w-8 rounded-lg bg-slate-200" />
                                            <div className="h-8 w-8 rounded-lg bg-slate-200" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredRows.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <h3 className="text-lg font-medium text-slate-400 mb-1">No Documents Found</h3>
                            <p className="text-sm text-slate-400">
                                {searchTerm ? 'Try adjusting your search terms' : 'No issuance documents have been created yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {visibleRows.map((row) => {
                                const issuance = row.issuance;
                                const StatusIcon = statusConfig[issuance.Status]?.icon ?? AlertCircle;

                                return (
                                    <div key={issuance.IssuanceID} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="font-semibold text-slate-900 truncate">
                                                        {issuance.DocumentNumber}
                                                    </div>
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${documentTypeConfig[issuance.DocumentType]?.color || 'bg-gray-100 text-gray-800'}`}>
                                                        {documentTypeConfig[issuance.DocumentType]?.label || issuance.DocumentType}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[issuance.Status]?.color || 'bg-gray-100 text-gray-800'}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {statusConfig[issuance.Status]?.label || issuance.Status}
                                                    </span>
                                                </div>

                                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {row.requesterName}
                                                    </span>
                                                    <span>{row.departmentName}</span>
                                                    <span>Reference: {row.RequestNumber}</span>
                                                    <span>Issued: {formatPHDate(issuance.IssuanceDate)}</span>
                                                    <span>Source Date: {formatPHDate(row.RequestDate)}</span>
                                                    {row.itemsCount > 0 && (
                                                        <span>{row.itemsCount} Item{row.itemsCount !== 1 ? 's' : ''}</span>
                                                    )}
                                                </div>

                                                <div className="mt-1 text-sm text-slate-600">
                                                    <span className="font-medium">Issued To:</span>{' '}
                                                    {issuance.issuedToUser?.FullName || issuance.IssuedToName || 'N/A'}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 lg:justify-end">
                                                <Link
                                                    href={`${detailsBaseRoute}/${issuance.IssuanceID}`}
                                                    className="p-2 text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDownloadDocument(issuance)}
                                                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                    title={`Download ${issuance.DocumentType}`}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {!isInitialLoading && totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                            <div className="text-sm text-slate-500">
                                Showing {((currentPage - 1) * DOCUMENTS_PER_PAGE) + 1} to {Math.min(currentPage * DOCUMENTS_PER_PAGE, totalEntries)} of {totalEntries} entries
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1 || isFetching}
                                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-slate-600">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages || isFetching}
                                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
