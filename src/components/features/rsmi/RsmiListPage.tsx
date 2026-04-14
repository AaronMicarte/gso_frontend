'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { CalendarDays, FileCheck2, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { listRsmiReports } from '@/lib/api/rsmi';
import type { RsmiReportListItem } from '@/types/rsmi';

interface RsmiListPageProps {
    baseRoute: '/admin' | '/staff';
}

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    return format(new Date(value), 'MMM dd, yyyy');
};

export function RsmiListPage({ baseRoute }: RsmiListPageProps) {
    const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));

    const [reports, setReports] = useState<RsmiReportListItem[]>([]);
    const [loading, setLoading] = useState(true);

    const monthYear = useMemo(() => {
        const parsed = new Date(`${monthFilter}-01T00:00:00`);
        return {
            month: parsed.getMonth() + 1,
            year: parsed.getFullYear(),
        };
    }, [monthFilter]);

    const load = async () => {
        try {
            setLoading(true);
            const data = await listRsmiReports(monthYear);
            setReports(data);
        } catch {
            toast.error('Failed to load RSMI reports');
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [monthYear.month, monthYear.year]);

    return (
        <div
            className="p-6 space-y-4 min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-xl font-bold text-slate-900">RSMI (GSO)</div>
                    <div className="text-sm text-slate-600">Auto-generated from issued transactions. Open print to view latest same-day updates.</div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <label className="text-sm text-slate-700 inline-block">
                    <span className="mb-1 block">Month Filter</span>
                    <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="month"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="w-full md:w-72 pl-9 pr-3 py-2 border border-slate-200 rounded-lg"
                        />
                    </div>
                </label>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Serial No.</th>
                                <th className="px-6 py-4">Entity</th>
                                <th className="px-6 py-4">Items</th>
                                <th className="px-6 py-4">Total Qty</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {reports.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                                        <FileCheck2 className="w-9 h-9 mx-auto mb-2 text-slate-300" />
                                        No RSMI reports for this month
                                    </td>
                                </tr>
                            ) : (
                                reports.map((report) => (
                                    <tr key={report.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">{formatDate(report.report_date)}</td>
                                        <td className="px-6 py-4 font-semibold">{report.serial_no}</td>
                                        <td className="px-6 py-4">{report.entity_name}</td>
                                        <td className="px-6 py-4">{report.items_count}</td>
                                        <td className="px-6 py-4">{report.items_sum_quantity_issued ?? 0}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`${baseRoute}/rsmi/${report.id}/print`}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800"
                                                >
                                                    <Printer className="w-3.5 h-3.5" /> Print
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
