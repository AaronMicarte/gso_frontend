'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { getDashboardStats, getRecentActivity } from '@/lib/api/dashboard';
import { DashboardStatsResponse, RecentActivityResponse } from '@/types/dashboard';
import { formatInTimeZone } from 'date-fns-tz';

function formatManila(dateString?: string | null): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    return formatInTimeZone(date, 'Asia/Manila', 'PPPp');
}

export default function AdminReportsAnalyticsPage() {
    const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
    const [activity, setActivity] = useState<RecentActivityResponse | null>(null);

    useEffect(() => {
        const run = async () => {
            try {
                const [s, a] = await Promise.all([getDashboardStats(), getRecentActivity()]);
                setStats(s);
                setActivity(a);
            } catch {
                toast.error('Failed to load reporting analytics');
            }
        };

        run();
    }, []);

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Reporting Analytics</h1>
                        <p className="text-slate-600 text-sm">Quick stats and recent system activity (PH time)</p>
                    </div>
                    <Link href="/admin/reports/standard" className="text-sm text-[var(--primary)] underline">
                        Go to Standard Reports
                    </Link>
                </div>

                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <div className="text-xs text-slate-500">Delivery Receipts</div>
                            <div className="text-2xl font-bold text-slate-900">{stats?.stats.totalDeliveryReceipts ?? 0}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <div className="text-xs text-slate-500">Inventory Items</div>
                            <div className="text-2xl font-bold text-slate-900">{stats?.stats.totalInventory ?? 0}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <div className="text-xs text-slate-500">For Issuance</div>
                            <div className="text-2xl font-bold text-slate-900">{stats?.stats.forIssuanceInventory ?? 0}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-4 h-4 text-slate-700" />
                                <h2 className="text-lg font-semibold text-slate-900">Report Coverage</h2>
                            </div>
                            <ul className="text-sm text-slate-700 space-y-2">
                                <li>DR: Records delivery receipt entries and item lines.</li>
                                <li>IAR: Inspection + acceptance with signatures.</li>
                                <li>PAR/ICS: Issuance documents with acknowledgment signatures.</li>
                            </ul>
                            <div className="mt-4 text-xs text-slate-500">
                                This page is analytics; the official printable forms are under Standard Reports.
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Activity className="w-4 h-4 text-slate-700" />
                                <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
                            </div>
                            <div className="space-y-3">
                                {(activity?.activities ?? []).slice(0, 8).map((item) => (
                                    <div key={item.id} className="border border-slate-200 rounded-lg p-3">
                                        <div className="text-sm font-medium text-slate-900">{item.action}</div>
                                        <div className="text-xs text-slate-600 mt-1">{item.description}</div>
                                        <div className="text-xs text-slate-500 mt-2">{formatManila(item.timestamp)}</div>
                                    </div>
                                ))}
                                {(activity?.activities ?? []).length === 0 ? (
                                    <div className="text-sm text-slate-600">No activity found.</div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </>
            </div>
        </div>
    );
}
