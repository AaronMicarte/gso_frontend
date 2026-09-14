'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    Archive,
    CheckCircle,
    Clock,
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
    partially_acknowledged: {
        label: 'Partially Acknowledged',
        color: 'bg-amber-100 text-amber-800',
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
        color: 'bg-amber-50 text-amber-800 border border-amber-200',
        fullName: 'Property Acknowledgment Receipt'
    },
    ICS: {
        label: 'ICS',
        color: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
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
    fixedDocumentType?: 'PAR' | 'ICS';
    defaultDocumentType?: 'PAR' | 'ICS';
}

const ROWS_PER_PAGE = 10;

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
        value.CreatedDate,
        value.createdAt,
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

function flattenGroups(
    groups: GroupedIssuance[],
    filters: AssetIssuanceFilters
): IssuanceRow[] {
    const rows: IssuanceRow[] = [];
    for (const group of groups) {
        const issuances = group.issuances
            .filter((issuance) => {
                if (filters.document_type && issuance.DocumentType !== filters.document_type) return false;
                if (filters.status && issuance.Status !== filters.status) return false;
                return true;
            })
            .slice()
            .sort((a, b) => {
                const diff = createdTime(b) - createdTime(a);
                if (diff !== 0) return diff;
                return (b.IssuanceID ?? 0) - (a.IssuanceID ?? 0);
            });

        for (const issuance of issuances) {
            rows.push({
                RequestID: group.RequestID,
                RequestNumber: group.RequestNumber,
                RequestDate: group.RequestDate,
                requesterName: group.requester?.FullName ?? 'N/A',
                departmentName: group.department?.DepartmentName ?? 'N/A',
                issuance,
                itemsCount: issuance.details?.length ?? 0,
            });
        }
    }
    return rows;
}

export function IssuanceDocumentsListPage({
    baseRoute,
    pageTitle,
    pageDescription,
    fixedDocumentType,
    defaultDocumentType,
}: IssuanceDocumentsListPageProps) {
    const [allGroups, setAllGroups] = useState<GroupedIssuance[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [filters, setFilters] = useState<AssetIssuanceFilters>(() => ({
        status: undefined,
        document_type: fixedDocumentType ?? defaultDocumentType,
    }));
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalEntries, setTotalEntries] = useState(0);
    const [serverPaginated, setServerPaginated] = useState(false);

    const [overallCounts, setOverallCounts] = useState<{ all: number; par: number; ics: number } | null>(null);

    const detailsBaseRoute = useMemo(
        () => baseRoute.replace(/\/(par|ics|documents)\/?$/i, ''),
        [baseRoute]
    );

    const totalCounts = useMemo(() => {
        if (overallCounts) return overallCounts;
        let all = 0;
        let par = 0;
        let ics = 0;
        for (const g of allGroups) {
            for (const iss of g.issuances) {
                if (filters.status && iss.Status !== filters.status) continue;
                all++;
                if (iss.DocumentType === 'PAR') par++;
                else if (iss.DocumentType === 'ICS') ics++;
            }
        }
        return { all, par, ics };
    }, [overallCounts, allGroups, filters.status]);

    // Keep the document type locked for this page only if fixedDocumentType is provided
    useEffect(() => {
        if (!fixedDocumentType) return;
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
                search: searchTerm.trim() || undefined,
                page,
                per_page: ROWS_PER_PAGE,
            });

            const responseAny = response as unknown as {
                data?: GroupedIssuance[];
                current_page?: number;
                last_page?: number;
                total?: number;
                counts?: {
                    all: number;
                    par: number;
                    ics: number;
                };
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

            if (responseAny.counts && typeof responseAny.counts.all === 'number') {
                setOverallCounts(responseAny.counts);
            }

            const grouped = Array.isArray(responseAny.data) ? responseAny.data : [];

            // Sort groups newest-first by RequestDate.
            const sortedGroups = grouped.slice().sort((a, b) => {
                const aDate = safeDate(a.RequestDate)?.getTime() ?? 0;
                const bDate = safeDate(b.RequestDate)?.getTime() ?? 0;
                return bDate - aDate;
            });

            // Detect server-side pagination.
            const rootLastPage = Number(responseAny.last_page);
            const rootCurrentPage = Number(responseAny.current_page);
            const rootTotal = Number(responseAny.total);
            const paginationLastPage = Number(responseAny.pagination?.last_page ?? responseAny.meta?.last_page);
            const paginationCurrentPage = Number(responseAny.pagination?.current_page ?? responseAny.meta?.current_page);
            const paginationTotal = Number(responseAny.pagination?.total ?? responseAny.meta?.total);

            const hasServerPagination =
                (Number.isFinite(rootLastPage) && rootLastPage > 0) ||
                (Number.isFinite(paginationLastPage) && paginationLastPage > 0);

            setServerPaginated(hasServerPagination);
            setAllGroups(sortedGroups);

            if (hasServerPagination) {
                const resolvedLastPage = Number.isFinite(rootLastPage) && rootLastPage > 0
                    ? rootLastPage
                    : Math.max(1, paginationLastPage);

                const resolvedCurrentPage = Number.isFinite(rootCurrentPage) && rootCurrentPage > 0
                    ? rootCurrentPage
                    : Number.isFinite(paginationCurrentPage) && paginationCurrentPage > 0
                        ? paginationCurrentPage
                        : page;

                const resolvedTotal = Number.isFinite(rootTotal) && rootTotal >= 0
                    ? rootTotal
                    : Number.isFinite(paginationTotal) && paginationTotal >= 0
                        ? paginationTotal
                        : sortedGroups.length;

                setCurrentPage(Math.min(Math.max(1, resolvedCurrentPage), Math.max(1, resolvedLastPage)));
                setTotalPages(Math.max(1, resolvedLastPage));
                setTotalEntries(resolvedTotal);
            }
            // Server pagination absent — totals are derived from flattened rows (see effect below).
        } catch {
            toast.error('Failed to load issuance documents');
        } finally {
            setIsFetching(false);
            setIsInitialLoading(false);
        }
    }, [filters, searchTerm]);

    useEffect(() => {
        loadDocuments(1);
    }, [loadDocuments]);

    const handleRefresh = () => {
        loadDocuments(currentPage);
    };

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        if (serverPaginated) {
            loadDocuments(page);
        } else {
            setCurrentPage(page);
        }
    };

    // Filter groups by search term.
    const filteredGroups = useMemo(() => {
        if (!searchTerm) return allGroups;
        const lower = searchTerm.toLowerCase();
        return allGroups.filter((group) => {
            if (group.RequestNumber.toLowerCase().includes(lower)) return true;
            if ((group.requester?.FullName ?? '').toLowerCase().includes(lower)) return true;
            if ((group.department?.DepartmentName ?? '').toLowerCase().includes(lower)) return true;
            return group.issuances.some((issuance) => {
                const drNumber = String(issuance.deliveryReceipt?.DRNumber ?? '').toLowerCase();
                return (
                    issuance.DocumentNumber.toLowerCase().includes(lower) ||
                    drNumber.includes(lower)
                );
            });
        });
    }, [allGroups, searchTerm]);

    // Flatten ALL filtered groups into rows first, then paginate by row count.
    const allRows = useMemo((): IssuanceRow[] => {
        return flattenGroups(filteredGroups, filters);
    }, [filteredGroups, filters]);

    // Reset to page 1 whenever filters or search term change so filtered results are immediately visible
    useEffect(() => {
        setCurrentPage(1);
    }, [filters, searchTerm]);

    // Recompute client-side pagination totals whenever allRows changes.
    useEffect(() => {
        if (serverPaginated) return;
        const computedTotalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));
        setTotalPages(computedTotalPages);
        setTotalEntries(allRows.length);
        setCurrentPage((prev) => Math.min(prev, computedTotalPages));
    }, [allRows.length, serverPaginated]);

    // Slice rows for the current page.
    const visibleRows = useMemo((): IssuanceRow[] => {
        if (serverPaginated) return allRows; // server already returned only this page's data
        return allRows.slice(
            (currentPage - 1) * ROWS_PER_PAGE,
            currentPage * ROWS_PER_PAGE
        );
    }, [allRows, currentPage, serverPaginated]);

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
                            {pageTitle || (fixedDocumentType ? `${fixedDocumentType} Documents` : 'PAR & ICS Documents')}
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {pageDescription || (fixedDocumentType
                                ? `Browse and manage ${documentTypeConfig[fixedDocumentType].fullName} documents (one-by-one)`
                                : 'Consolidated register for Property Acknowledgment Receipts (PAR) and Inventory Custodian Slips (ICS).')}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={isFetching}
                            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    {/* Document Type Tabs (when not hard-locked to one type) */}
                    {!fixedDocumentType && (
                        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Type:</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setFilters(prev => ({ ...prev, document_type: undefined }));
                                    setCurrentPage(1);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${!filters.document_type ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                <span>All Documents</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${!filters.document_type ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                    {totalCounts.all}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setFilters(prev => ({ ...prev, document_type: 'PAR' }));
                                    setCurrentPage(1);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${filters.document_type === 'PAR' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'}`}
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                <span>PAR</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${filters.document_type === 'PAR' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'}`}>
                                    {totalCounts.par}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setFilters(prev => ({ ...prev, document_type: 'ICS' }));
                                    setCurrentPage(1);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${filters.document_type === 'ICS' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'}`}
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                <span>ICS</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${filters.document_type === 'ICS' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-900'}`}>
                                    {totalCounts.ics}
                                </span>
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search document number, DR number, requester, or department..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={filters.status || ''}
                                onChange={(e) => {
                                    setFilters(prev => ({
                                        ...prev,
                                        status: (e.target.value || undefined) as AssetIssuanceFilters['status']
                                    }));
                                    setCurrentPage(1);
                                }}
                                aria-label="Filter documents by status"
                                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 bg-white"
                            >
                                <option value="">All Status</option>
                                <option value="acknowledged">Acknowledged</option>
                                <option value="pending_acknowledgment">Pending</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Flat Documents List */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {isInitialLoading && allGroups.length === 0 ? (
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
                    ) : visibleRows.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <h3 className="text-base font-semibold text-slate-700 mb-1">No Documents Found</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                {searchTerm ? 'Try adjusting your search terms or filters' : 'No issuance documents match the selected filter'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {visibleRows.map((row) => {
                                const issuance = row.issuance;
                                const StatusIcon = statusConfig[issuance.Status]?.icon ?? AlertCircle;
                                const isPar = issuance.DocumentType === 'PAR';

                                return (
                                    <div key={issuance.IssuanceID} className="p-4 hover:bg-slate-50/80 transition-colors">
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-slate-900 text-sm">
                                                        {issuance.DocumentNumber}
                                                    </span>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${isPar ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                                                        {issuance.DocumentType}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${statusConfig[issuance.Status]?.color || 'bg-gray-100 text-gray-800'}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {statusConfig[issuance.Status]?.label || issuance.Status}
                                                    </span>
                                                </div>

                                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1 font-medium text-slate-700">
                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                        {row.requesterName}
                                                    </span>
                                                    <span>{row.departmentName}</span>
                                                    <span>DR: <span className="font-medium text-slate-700">{issuance.deliveryReceipt?.DRNumber ?? 'N/A'}</span></span>
                                                    <span>Issued: {formatPHDate(issuance.IssuanceDate)}</span>
                                                    <span>Source Date: {formatPHDate(row.RequestDate)}</span>
                                                    {row.itemsCount > 0 && (
                                                        <span className="font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                            {row.itemsCount} Item{row.itemsCount !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="mt-1.5 text-xs text-slate-600 flex items-center gap-1.5">
                                                    <span className="text-slate-400">Accountable Officer:</span>
                                                    <span className="font-semibold text-slate-800">
                                                        {issuance.issuedToUser?.FullName || issuance.IssuedToName || 'N/A'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 lg:justify-end shrink-0">
                                                <Link
                                                    href={`${detailsBaseRoute}/${issuance.IssuanceID}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:text-[var(--primary)] border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all group"
                                                    title="View Document Details"
                                                >
                                                    <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--primary)] transition-colors" />
                                                    <span>View</span>
                                                </Link>
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
                                Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1} to {Math.min(currentPage * ROWS_PER_PAGE, totalEntries)} of {totalEntries} entries
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