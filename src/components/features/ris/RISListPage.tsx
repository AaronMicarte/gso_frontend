'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Search, Eye, Package, RefreshCw } from 'lucide-react';
import { listRis } from '@/lib/api/ris';
import type { RisRecord } from '@/types/ris';

const text = (v: unknown, fb: string) => {
    const t = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
    return t.length ? t : fb;
};

export function RISListPage({ baseRoute }: { baseRoute: string }) {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<RisRecord[]>([]);
    const [search, setSearch] = useState('');

    const load = async () => {
        try {
            setLoading(true);
            const data = await listRis({ per_page: 50, search: search || undefined });
            setItems(data.data || []);
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
        <div className="p-6 space-y-4 min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
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
                        placeholder="Search RIS no. or request no."
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">RIS No.</th>
                                <th className="px-6 py-4">Request No.</th>
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary)]"></div>
                                            Loading RIS...
                                        </div>
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                        No RIS records found
                                    </td>
                                </tr>
                            ) : (
                                items.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-slate-900">{text(r.ris_number, '0000-00-0000')}</td>
                                        <td className="px-6 py-4 text-slate-600">{text(r.request?.RequestNumber, 'N/A')}</td>
                                        <td className="px-6 py-4 text-slate-600">{text(r.request?.department?.DepartmentName, 'N/A')}</td>
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
