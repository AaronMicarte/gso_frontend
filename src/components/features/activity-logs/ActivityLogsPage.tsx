'use client';

import { useEffect, useState } from 'react';
import { useActivityLogs, useEntityTypes } from '@/lib/hooks/useActivityLogs';
import {
    Search,
    RefreshCw,
    Clock,
    Activity,
} from 'lucide-react';
import { format, toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';

const actionBadgeStyles: Record<string, string> = {
    created: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    transfer: 'bg-purple-100 text-purple-800',
    borrow: 'bg-orange-100 text-orange-800',
    return: 'bg-amber-100 text-amber-800',
    signed: 'bg-slate-100 text-slate-800',
};

export function ActivityLogsPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [entityType, setEntityType] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const { data: entityTypesData } = useEntityTypes();

    const { data, isLoading, isFetching, refetch } = useActivityLogs({
        page,
        per_page: 15,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(entityType ? { entity_type: entityType } : {}),
        ...(startDate ? { start_date: startDate } : {}),
        ...(endDate ? { end_date: endDate } : {}),
    });

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [search]);

    const handleRefresh = () => {
        refetch();
        toast.success('Activity logs refreshed');
    };

    const tableRows = data?.data || [];
    const pagination = data?.pagination;

    const formatTimestamp = (timestamp: string) => {
        try {
            const date = new Date(timestamp);
            const zonedDate = toZonedTime(date, 'Asia/Manila');
            return format(zonedDate, 'MMM dd, yyyy • h:mm:ss a');
        } catch {
            return timestamp;
        }
    };

    const getAuditMetaHighlights = (log: {
        detail_highlights?: string[];
        meta?: Record<string, unknown> | null;
    }): string[] => {
        if (log.detail_highlights && log.detail_highlights.length > 0) {
            return log.detail_highlights;
        }

        if (!log.meta) return [];

        const possibleKeys = [
            'drNumber',
            'iarNumber',
            'propertyNumber',
            'propertyTag',
            'supplier',
            'reference',
        ];

        return possibleKeys
            .map((key) => log.meta?.[key])
            .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
            .map((value) => String(value))
            .slice(0, 2);
    };

    const getActionBadgeColor = (action: string): string => {
        const actionKey = action.toLowerCase();

        if (actionKey.includes('created')) return actionBadgeStyles.created;
        if (actionKey.includes('approved')) return actionBadgeStyles.approved;
        if (actionKey.includes('transfer')) return actionBadgeStyles.transfer;
        if (actionKey.includes('borrow')) return actionBadgeStyles.borrow;
        if (actionKey.includes('return')) return actionBadgeStyles.return;
        if (actionKey.includes('signed')) return actionBadgeStyles.signed;

        return actionBadgeStyles.signed;
    };

    return (
        <div
            className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}
        >
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Activity className="w-8 h-8 text-slate-700" />
                            Activity Logs
                        </h1>
                        <p className="text-slate-500 text-sm">Monitor all system activities and audit trail</p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isFetching}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search action, performer, or description..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setPage(1);
                                }
                            }}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={entityType}
                            onChange={(e) => {
                                setEntityType(e.target.value);
                                setPage(1);
                            }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            title="Entity Type"
                        >
                            <option value="">All entity types</option>
                            {entityTypesData?.entity_types?.map((type) => (
                                <option key={type} value={type}>
                                    {type.replace(/_/g, ' ').toUpperCase()}
                                </option>
                            ))}
                        </select>

                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setPage(1);
                            }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            title="Start date"
                        />

                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setPage(1);
                            }}
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
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4">Performed By</th>
                                    <th className="px-6 py-4">Timestamp</th>
                                    <th className="px-6 py-4">Entity Type</th>
                                    {process.env.NODE_ENV === 'development' && <th className="px-6 py-4">IP Address</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {isLoading ? (
                                    <TableSkeletonRows columns={process.env.NODE_ENV === 'development' ? 6 : 5} rows={8} />
                                ) : tableRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={process.env.NODE_ENV === 'development' ? 6 : 5} className="px-6 py-8 text-center text-slate-500">
                                            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No activity logs found
                                        </td>
                                    </tr>
                                ) : (
                                    tableRows.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap align-top">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                                                        {log.action}
                                                    </span>
                                                    {log.entity_label && (
                                                        <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                                            {log.entity_label}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-900 max-w-xs truncate align-top" title={log.summary || log.description}>
                                                <div className="space-y-1">
                                                    <div className="truncate font-medium text-slate-800">
                                                        {log.summary || log.description}
                                                    </div>
                                                    {(log.summary && log.description && log.summary !== log.description) && (
                                                        <div className="text-xs text-slate-500 truncate">{log.description}</div>
                                                    )}
                                                    {getAuditMetaHighlights(log).length > 0 && (
                                                        <div className="flex items-center gap-1.5">
                                                            {getAuditMetaHighlights(log).map((value) => (
                                                                <span key={`${log.id}-${value}`} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                                                    {value}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700">
                                                {log.performed_by || 'System'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                                <div title={log.timestamp} className="leading-tight">
                                                    <div className="font-medium text-slate-700">{formatTimestamp(log.timestamp)}</div>
                                                    <div className="text-xs text-slate-500">{log.time_ago}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap align-top">
                                                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                                                    {(log.entity_label || log.entity_type.replace(/_/g, ' ')).toUpperCase()}
                                                </span>
                                            </td>
                                            {process.env.NODE_ENV === 'development' && (
                                                <td className="px-6 py-4 text-xs text-slate-500 truncate" title={log.ip_address || ''}>
                                                    {log.ip_address || '—'}
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {pagination && pagination.last_page > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-500">
                                    Showing {pagination.from} to {pagination.to} of {pagination.total} entries
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
                                        Page {pagination.current_page} of {pagination.last_page}
                                    </span>
                                    <button
                                        onClick={() => setPage(Math.min(pagination.last_page, page + 1))}
                                        disabled={page === pagination.last_page || isFetching}
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
        </div>
    );
}
