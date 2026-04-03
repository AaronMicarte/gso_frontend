'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, FileText, RefreshCw, Search, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

import departmentHeadAPI, { DepartmentReceivedDr, DepartmentReceivedItem } from '@/lib/api/departmentHead';
import { CardListSkeleton } from '@/components/ui/ListSkeletons';

interface ReceivedItemsPageProps {
    baseRoute: string;
}

type ItemStatusKey = DepartmentReceivedItem['status'] | 'all';

const statusConfig: Record<ItemStatusKey, { label: string; color: string }> = {
    all: { label: 'All Status', color: 'bg-slate-100 text-slate-700' },
    pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700' },
    inspected: { label: 'Inspected', color: 'bg-yellow-100 text-yellow-800' },
    accepted: { label: 'Accepted', color: 'bg-emerald-100 text-emerald-700' },
    to_be_issued: { label: 'To be issued', color: 'bg-blue-100 text-blue-700' },
    issued: { label: 'Issued', color: 'bg-indigo-100 text-indigo-700' },
    acknowledged: { label: 'Acknowledged', color: 'bg-green-100 text-green-700' },
};

function safeDate(dateValue: string | null | undefined): Date | null {
    if (!dateValue) return null;
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPHDate(dateValue: string | null | undefined): string {
    const parsed = safeDate(dateValue);
    if (!parsed) return 'Date N/A';
    return format(toZonedTime(parsed, 'Asia/Manila'), 'MMM dd, yyyy');
}

function buildItemLabel(item: DepartmentReceivedItem): string {
    const main = (item.ItemDescription ?? '').trim();
    if (main) return main;
    return 'Item';
}

function buildMeta(item: DepartmentReceivedItem): string {
    const parts = [item.Brand, item.ModelNumber, item.SerialNumber]
        .filter((value): value is string => !!value && value.trim().length > 0)
        .map((value) => value.trim());
    return parts.length > 0 ? parts.join(' · ') : 'No brand/model/serial';
}

function resolveSummaryStatus(items: DepartmentReceivedItem[]): ItemStatusKey {
    const priority: ItemStatusKey[] = ['acknowledged', 'issued', 'to_be_issued', 'accepted', 'inspected', 'pending'];
    for (const key of priority) {
        if (items.some((item) => item.status === key)) return key;
    }
    return 'pending';
}

export function ReceivedItemsPage({ baseRoute }: ReceivedItemsPageProps) {
    const [rows, setRows] = useState<DepartmentReceivedDr[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ItemStatusKey>('all');
    const [expandedByDr, setExpandedByDr] = useState<Record<number, boolean>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadRows = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const response = await departmentHeadAPI.getReceivedItems({
                page,
                per_page: 10,
                search: searchTerm.trim() || undefined,
            });

            setRows(response.data || []);
            setCurrentPage(response.current_page);
            setTotalPages(response.last_page);
        } catch {
            toast.error('Failed to load received items');
        } finally {
            setLoading(false);
        }
    }, [searchTerm]);

    useEffect(() => {
        loadRows(1);
    }, [loadRows]);

    const handleRefresh = () => {
        loadRows(currentPage);
    };

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        loadRows(page);
    };

    const filteredRows = useMemo(() => {
        if (statusFilter === 'all') return rows;
        return rows
            .map((row) => ({
                ...row,
                items: row.items.filter((item) => item.status === statusFilter),
            }))
            .filter((row) => row.items.length > 0);
    }, [rows, statusFilter]);

    const countByStatus = (items: DepartmentReceivedItem[]) => {
        return items.reduce<Record<ItemStatusKey, number>>((acc, item) => {
            acc[item.status] = (acc[item.status] ?? 0) + 1;
            return acc;
        }, {
            all: items.length,
            pending: 0,
            inspected: 0,
            accepted: 0,
            to_be_issued: 0,
            issued: 0,
            acknowledged: 0,
        });
    };

    return (
        <div
            className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}
        >
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Department Received Items</h1>
                        <p className="text-slate-500 text-sm">Track delivery receipts and current status per item for your department</p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        type="button"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 bg-white/95 p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search DR number, requester, department, or IAR number..."
                            value={searchTerm}
                            onChange={(event) => {
                                setSearchTerm(event.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as ItemStatusKey)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        >
                            {Object.entries(statusConfig).map(([key, config]) => (
                                <option key={key} value={key}>{config.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <CardListSkeleton cards={4} />
                    ) : filteredRows.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <h3 className="text-lg font-medium text-slate-400 mb-1">No items found</h3>
                            <p className="text-sm text-slate-400">
                                {searchTerm ? 'Try adjusting your search terms' : 'No delivery receipts found for your department'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 p-4 sm:p-6">
                            {filteredRows.map((row) => {
                                const isExpanded = expandedByDr[row.DRID] ?? false;
                                const statusCounts = countByStatus(row.items);
                                const summaryStatus = resolveSummaryStatus(row.items);
                                const summaryLabel = row.IARNumber ? statusConfig[summaryStatus].label : 'Pending inspection';
                                const summaryColor = row.IARNumber ? statusConfig[summaryStatus].color : statusConfig.pending.color;
                                return (
                                    <div key={row.DRID} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                                        <div className="p-4 sm:p-5">
                                            <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
                                                        <FileText className="w-5 h-5 text-[var(--primary)]" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h3 className="text-lg font-semibold text-slate-900">{row.DRNumber}</h3>
                                                            {row.IARNumber ? (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">IAR {row.IARNumber}</span>
                                                            ) : (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending inspection</span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                                            <span className="font-medium text-slate-700">{row.RequestedBy || 'Requester N/A'}</span>
                                                            <span>{row.DepartmentName || 'Department N/A'}</span>
                                                            <span>{formatPHDate(row.DateReceived)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    {(['pending', 'inspected', 'accepted', 'to_be_issued', 'issued', 'acknowledged'] as ItemStatusKey[])
                                                        .filter((key) => statusCounts[key] > 0)
                                                        .slice(0, 4)
                                                        .map((key) => (
                                                            <span
                                                                key={key}
                                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[key].color}`}
                                                            >
                                                                {statusConfig[key].label}: {statusCounts[key]}
                                                            </span>
                                                        ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedByDr((prev) => ({
                                                            ...prev,
                                                            [row.DRID]: !isExpanded,
                                                        }))}
                                                        className="ml-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        {isExpanded ? 'Hide items' : 'View items'}
                                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 text-xs">
                                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                                    <div className="text-slate-500">Overall Status</div>
                                                    <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${summaryColor}`}>
                                                        {summaryLabel}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                                    <div className="text-slate-500">Items</div>
                                                    <div className="mt-1 text-sm font-semibold text-slate-800">{row.items.length} total</div>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                                    <div className="text-slate-500">Latest Acceptance</div>
                                                    <div className="mt-1 text-sm font-semibold text-slate-800">
                                                        {row.IARDateAccepted ? formatPHDate(row.IARDateAccepted) : 'Pending'}
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                                                    <div className="px-4 py-3 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                                                        Item Breakdown
                                                    </div>
                                                    <div className="divide-y divide-slate-100">
                                                        {row.items.map((item) => (
                                                            <div
                                                                key={item.DRDetailID}
                                                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 text-sm text-slate-700"
                                                            >
                                                                <div>
                                                                    <div className="font-medium text-slate-900">{buildItemLabel(item)}</div>
                                                                    <div className="text-xs text-slate-500">{buildMeta(item)}</div>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-xs">
                                                                    <span className="text-slate-500">Qty: {item.QuantityAccepted || item.QuantityDelivered}</span>
                                                                    <span className="text-slate-500">{item.DocumentType || 'ICS'}</span>
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${statusConfig[item.status].color}`}>
                                                                        {item.status_label}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                type="button"
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
                                type="button"
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
