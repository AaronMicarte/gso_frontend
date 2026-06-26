'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Search, Eye, Package, RefreshCw } from 'lucide-react';
import { listRis } from '@/lib/api/ris';
import type { RisRecord } from '@/types/ris';

const text = (v: unknown, fb: string) => {
    const t = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
    return t.length ? t : fb;
};

// Formats the record date safely
const formatDisplayDate = (dateString?: string | null): string => {
    if (!dateString) return '-';
    try {
        const parsed = new Date(dateString);
        if (Number.isNaN(parsed.getTime())) return '-';
        return parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch {
        return '-';
    }
};

// Pulls the active person name, falling back dynamically to the approved_by signer's actual name string
const requesterName = (r: RisRecord) => {
    const req = r.request ?? r.asset_request ?? null;
    return text(
        r.signatures?.received_by?.issued_to_name ||
        r.signatures?.received_by?.user?.FullName ||
        req?.requester?.FullName ||
        r.signatures?.approved_by?.user?.FullName,
        '-',
    );
};

// TEMP DIAGNOSTIC — confirms whether listRis() actually returns signatures/requester per row.
// Open the browser console after the list loads. If every row logs "MISSING" across the board,
// the list endpoint isn't eager-loading these relations and the fix belongs in the backend/API
// query (eager-load signatures.received_by, signatures.approved_by, request.requester) —
// not in this component. Delete this function and its call site once confirmed.
const logRequesterShape = (r: RisRecord) => {
    const req = r.request ?? r.asset_request ?? null;
    // eslint-disable-next-line no-console
    console.debug('[RISListPage] requester shape for', r.ris_number, {
        has_signatures_object: r.signatures != null,
        received_by_issued_to_name: r.signatures?.received_by?.issued_to_name ?? 'MISSING',
        received_by_user_FullName: r.signatures?.received_by?.user?.FullName ?? 'MISSING',
        req_requester_FullName: req?.requester?.FullName ?? 'MISSING',
        approved_by_user_FullName: r.signatures?.approved_by?.user?.FullName ?? 'MISSING',
    });
};

export function RISListPage({ baseRoute }: { baseRoute: string }) {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<RisRecord[]>([]);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<string>('');

    const load = async (opts?: { status?: string }) => {
        try {
            setLoading(true);
            const s = opts?.status !== undefined ? opts.status : status;
            const data = await listRis({ per_page: 50, search: search || undefined, status: s || undefined });
            const rows = data.data || [];
            // eslint-disable-next-line no-console
            console.debug('[RISListPage] raw row sample', rows[0]);
            rows.forEach(logRequesterShape);
            setItems(rows);
        } catch {
            toast.error('Failed to load RIS');
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        await load();
        toast.success('RIS refreshed');
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="p-6 space-y-4 min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-xl font-bold text-slate-900">Requisition and Issue Slips</div>
                    <div className="text-sm text-slate-600">Prepared RIS control numbers for issuance</div>
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
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
                        placeholder="Search RIS no. or requester."
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                </div>

                <div className="w-56">
                    <select
                        value={status}
                        onChange={(e) => { const v = e.target.value; setStatus(v); load({ status: v }); }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    >
                        <option value="">All statuses</option>
                        <option value="for_issuance">For issuance</option>
                        <option value="issued">Issued</option>
                        <option value="received">Received</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">RIS No.</th>
                                <th className="px-6 py-4">Requester</th>
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4">Date Created</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                        No RIS records found
                                    </td>
                                </tr>
                            ) : (
                                items.map((r) => {
                                    const reqData = r.request ?? r.asset_request ?? null;
                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">{text(r.ris_number, '0000-00-0000')}</td>
                                            <td className="px-6 py-4 text-slate-600">{requesterName(r)}</td>
                                            <td className="px-6 py-4 text-slate-600">{text(reqData?.department?.DepartmentName, '-')}</td>
                                            <td className="px-6 py-4 text-slate-600">{formatDisplayDate(reqData?.RequestDate)}</td>
                                            <td className="px-6 py-4 text-slate-600">{text(r.status, 'unknown')}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        href={`${baseRoute}/${r.id}`}
                                                        className="p-2 text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                                                        title="View details"
                                                    >
                                                        <Eye className="w-4 h-4" />
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
            </div>
        </div>
    );
}