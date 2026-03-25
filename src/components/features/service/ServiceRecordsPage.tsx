'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Plus, RefreshCw, Search, Wrench } from 'lucide-react';
import { toast } from 'sonner';

import serviceApi from '@/lib/api/assetServices';
import { AssetServiceRecord, AssetServiceStatus } from '@/types/assetService';

const statusClasses: Record<AssetServiceStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    under_review: 'bg-sky-100 text-sky-800',
    work_approved: 'bg-indigo-100 text-indigo-800',
    repair_in_progress: 'bg-violet-100 text-violet-800',
    verification: 'bg-cyan-100 text-cyan-800',
    closed: 'bg-emerald-100 text-emerald-800',
    unrepairable: 'bg-rose-100 text-rose-800',
};

const statusLabel = (status: AssetServiceStatus) => status.replaceAll('_', ' ');

interface ServiceRecordsPageProps {
    baseRoute: string;
    title: string;
    description: string;
    showCreate?: boolean;
}

export function ServiceRecordsPage({ baseRoute, title, description, showCreate = false }: ServiceRecordsPageProps) {
    const [rows, setRows] = useState<AssetServiceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'all' | AssetServiceStatus>('all');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const load = useCallback(async (targetPage = 1) => {
        try {
            setLoading(true);
            const response = await serviceApi.getAll({
                page: targetPage,
                per_page: 15,
                search: search || undefined,
                status: status === 'all' ? undefined : status,
            });
            setRows(response.data || []);
            setPage(response.current_page || 1);
            setLastPage(response.last_page || 1);
        } catch {
            toast.error('Failed to load service records');
        } finally {
            setLoading(false);
        }
    }, [search, status]);

    useEffect(() => {
        load(1);
    }, [load]);

    const filteredRows = useMemo(() => rows, [rows]);

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                        <p className="text-slate-500 text-sm">{description}</p>
                    </div>
                    <div className="flex gap-2">
                        {showCreate && (
                            <Link
                                href={`${baseRoute}/new`}
                                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-white text-sm hover:bg-[var(--primary-hover)]"
                            >
                                <Plus className="h-4 w-4" />
                                New Service Record
                            </Link>
                        )}
                        <button
                            onClick={() => load(page)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by service no, property no, issue, vendor"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as 'all' | AssetServiceStatus)}
                            className="px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="under_review">Under Review</option>
                            <option value="work_approved">Work Approved</option>
                            <option value="repair_in_progress">Repair In Progress</option>
                            <option value="verification">Verification</option>
                            <option value="closed">Closed</option>
                            <option value="unrepairable">Unrepairable</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Service #</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date Reported</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Items</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading...</td>
                                    </tr>
                                ) : filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <Wrench className="w-8 h-8 text-slate-300" />
                                                No service records found
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row) => (
                                        <tr key={row.ServiceRecordID} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.ServiceNumber}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{row.DateReported}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{row.reportingDepartment?.DepartmentName || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{row.details?.length || 0}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClasses[row.Status]}`}>
                                                    {statusLabel(row.Status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Link href={`${baseRoute}/${row.ServiceRecordID}`} className="inline-flex text-slate-500 hover:text-slate-800">
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {lastPage > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                            <button
                                onClick={() => page > 1 && load(page - 1)}
                                disabled={page <= 1}
                                className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">Page {page} of {lastPage}</span>
                            <button
                                onClick={() => page < lastPage && load(page + 1)}
                                disabled={page >= lastPage}
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
