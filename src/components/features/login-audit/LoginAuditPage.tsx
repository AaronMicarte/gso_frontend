"use client";

import { useEffect, useState } from 'react';
import { useLoginAudits, useLoginStatuses } from '@/lib/hooks/useLoginAudits';
import {
    Search,
    RefreshCw,
    Clock,
    ShieldCheck,
    LogIn,
    LogOut,
    AlertCircle,
} from 'lucide-react';
import { format, toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import { TableSkeletonRows } from '@/components/ui/ListSkeletons';

export function LoginAuditPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [status, setStatus] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const { data: statusesData } = useLoginStatuses();

    const { data, isLoading, isFetching, refetch } = useLoginAudits({
        page,
        per_page: 15,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(status ? { status } : {}),
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
        toast.success('Login audit logs refreshed');
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

    const getStatusIcon = (statusStr: string) => {
        const statusLower = statusStr.toLowerCase();
        if (statusLower === 'login') return LogIn;
        if (statusLower === 'logout') return LogOut;
        if (statusLower === 'failedlogin') return AlertCircle;
        return Clock;
    };

    const getStatusColor = (statusStr: string) => {
        const statusLower = statusStr.toLowerCase();
        if (statusLower === 'login') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        if (statusLower === 'logout') return 'bg-slate-100 text-slate-800 border border-slate-200';
        if (statusLower === 'failedlogin') return 'bg-rose-100 text-rose-800 border border-rose-200';
        return 'bg-slate-100 text-slate-800 border border-slate-200';
    };

    const getStatusLabel = (statusStr: string) => {
        const statusLower = statusStr.toLowerCase();
        if (statusLower === 'login') return 'Login';
        if (statusLower === 'logout') return 'Logout';
        if (statusLower === 'failedlogin') return 'Failed Login';
        return statusStr;
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
                            <ShieldCheck className="w-8 h-8 text-slate-700" />
                            Login Audit
                        </h1>
                        <p className="text-slate-500 text-sm">Monitor all user login attempts and authentication events</p>
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
                            placeholder="Search by username, name, or IP address..."
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

                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value);
                                setPage(1);
                            }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            title="Login Status"
                        >
                            <option value="">All statuses</option>
                            {statusesData?.statuses?.map((s) => (
                                <option key={s} value={s}>
                                    {getStatusLabel(s)}
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
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Timestamp</th>
                                    <th className="px-6 py-4">IP Address</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {isLoading ? (
                                    <TableSkeletonRows columns={4} rows={8} />
                                ) : tableRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No login audit entries found
                                        </td>
                                    </tr>
                                ) : (
                                    tableRows.map((log) => {
                                        const StatusIcon = getStatusIcon(log.status);
                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 whitespace-nowrap align-top">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-full flex items-center justify-center ${getStatusColor(log.status)}`}>
                                                            <StatusIcon className="w-4 h-4" />
                                                        </div>
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(log.status)}`}>
                                                            {getStatusLabel(log.status)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-900">
                                                    <div className="font-medium text-slate-800">{log.performed_by}</div>
                                                    <div className="text-xs text-slate-500">@{log.username}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                                    <div title={log.timestamp} className="leading-tight">
                                                        <div className="font-medium text-slate-700">{formatTimestamp(log.timestamp)}</div>
                                                        <div className="text-xs text-slate-500">{log.time_ago}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-600 truncate font-mono" title={log.ip_address || ''}>
                                                    {log.ip_address || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })
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

export default LoginAuditPage;

