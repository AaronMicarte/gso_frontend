'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { getRis } from '@/lib/api/ris';
import type { RisRecord } from '@/types/ris';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const fmt = (d?: string | null) => {
    if (!d) return 'Not recorded';
    return format(toZonedTime(new Date(d), 'Asia/Manila'), 'PPpp');
};

const text = (v: unknown, fb: string) => {
    const t = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
    return t.length ? t : fb;
};

export function ViewRISPage({ baseRoute }: { baseRoute: string }) {
    const params = useParams();
    const router = useRouter();
    const id = Number(params?.id);

    const [ris, setRis] = useState<RisRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const run = async () => {
            try {
                setLoading(true);
                const data = await getRis(id);
                setRis(data);
            } catch (e) {
                toast.error('Failed to load RIS');
            } finally {
                setLoading(false);
            }
        };
        if (Number.isFinite(id)) run();
    }, [id]);

    const statusLabel = useMemo(() => {
        const s = ris?.status;
        if (!s) return 'Unknown';
        if (s === 'for_issuance') return 'For issuance';
        if (s === 'issued') return 'Issued';
        if (s === 'received') return 'Received';
        if (s === 'cancelled') return 'Cancelled';
        return s;
    }, [ris?.status]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mx-auto" />
                    <p className="text-slate-600">Loading RIS...</p>
                </div>
            </div>
        );
    }

    if (!ris) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
                <div className="text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                    <p className="text-slate-600">RIS not found</p>
                    <button onClick={() => router.back()} className="text-[var(--primary)] hover:underline">Back to list</button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4 min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <div className="mt-2">
                        <div className="text-xl font-bold text-slate-900">RIS {text(ris.ris_number, '0000-00-0000')}</div>
                        <div className="text-sm text-slate-600">Status: {statusLabel}</div>
                    </div>
                </div>

                <Link
                    href={`${baseRoute}/${ris.id}/print`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"
                >
                    <Printer className="h-4 w-4" /> Print
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="text-sm font-semibold text-slate-900">Header</div>
                    <div className="text-sm"><span className="text-slate-600">Entity:</span> {text(ris.entity_name, 'N/A')}</div>
                    <div className="text-sm"><span className="text-slate-600">Fund Cluster:</span> {text(ris.fund_cluster, 'N/A')}</div>
                    <div className="text-sm"><span className="text-slate-600">Division:</span> {text(ris.division, 'N/A')}</div>
                    <div className="text-sm"><span className="text-slate-600">RCC:</span> {text(ris.responsibility_center_code, 'N/A')}</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="text-sm font-semibold text-slate-900">Request</div>
                    <div className="text-sm"><span className="text-slate-600">Request No:</span> {text(ris.request?.RequestNumber, 'N/A')}</div>
                    <div className="text-sm"><span className="text-slate-600">Department:</span> {text(ris.request?.department?.DepartmentName, 'N/A')}</div>
                    <div className="text-sm"><span className="text-slate-600">Requested at:</span> {fmt(ris.request?.RequestDate)}</div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-sm font-semibold text-slate-900 mb-3">Items</div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-600">
                                <th className="text-left py-2 pr-3">Description</th>
                                <th className="text-center py-2 px-3">Qty Req</th>
                                <th className="text-center py-2 px-3">Qty Issued</th>
                                <th className="text-left py-2 pl-3">Remarks</th>
                                <th className="text-right py-2 pl-3">Availability</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {(ris.items ?? []).map((it) => (
                                <tr key={it.id}>
                                    <td className="py-2 pr-3">{text(it.description, 'N/A')}</td>
                                    <td className="py-2 px-3 text-center">{it.quantity_requested}</td>
                                    <td className="py-2 px-3 text-center">{it.quantity_issued}</td>
                                    <td className="py-2 pl-3">{text(it.issue_remarks, '-')}</td>
                                    <td className="py-2 pr-3 text-right">
                                        <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full ${it.stock_available ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {it.stock_available ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                            {it.stock_available ? 'Available' : 'Unavailable'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-sm font-semibold text-slate-900 mb-2">Purpose</div>
                <div className="text-sm text-slate-800">{text(ris.purpose, 'N/A')}</div>
            </div>
        </div>
    );
}
