'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePendingInspectionReceipts, useInspectionReports } from '@/lib/hooks/useInspection';
import { ClipboardList, ClipboardCheck, Clock, Package, ArrowUpRight, CalendarCheck } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';

interface StatCardProps {
    title: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    tone: 'blue' | 'amber' | 'green' | 'slate';
    href?: string;
    loading?: boolean;
}

function StatCard({ title, value, icon: Icon, tone, href, loading }: StatCardProps) {
    const toneStyles = {
        blue: 'bg-blue-100 text-blue-600',
        amber: 'bg-amber-100 text-amber-600',
        green: 'bg-emerald-100 text-emerald-600',
        slate: 'bg-slate-100 text-slate-600',
    };

    const content = (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    {loading ? (
                        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse mb-2" />
                    ) : (
                        <div className="text-3xl font-bold text-slate-900">{value.toLocaleString()}</div>
                    )}
                    <div className="text-sm text-slate-500 mt-1">{title}</div>
                </div>
                <div className={`p-3 rounded-xl ${toneStyles[tone]}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="block">
                {content}
            </Link>
        );
    }

    return content;
}

export default function InspectionDashboard() {
    const { user } = useAuth();

    const pendingReceipts = usePendingInspectionReceipts({ per_page: 5 });
    const pendingReports = useInspectionReports({ status: 'pending', per_page: 5 });
    const inspectedReports = useInspectionReports({ status: 'inspected', per_page: 5 });

    const pendingCount = pendingReceipts.data?.total ?? 0;
    const pendingReportsCount = pendingReports.data?.total ?? 0;
    const inspectedCount = inspectedReports.data?.total ?? 0;

    const nextReceipts = useMemo(() => pendingReceipts.data?.data || [], [pendingReceipts.data?.data]);
    const recentInspected = useMemo(() => inspectedReports.data?.data || [], [inspectedReports.data?.data]);

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Inspection Officer Dashboard</h1>
                        <p className="text-slate-500 text-sm">Track inspection workload and recent completions</p>
                    </div>
                    <div className="text-sm text-slate-600">
                        Welcome back, {user?.FullName || user?.Username || 'Inspector'}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Pending Receipts"
                        value={pendingCount}
                        icon={ClipboardList}
                        tone="amber"
                        href="/inspection/inspections"
                        loading={pendingReceipts.isLoading}
                    />
                    <StatCard
                        title="Draft Reports"
                        value={pendingReportsCount}
                        icon={Clock}
                        tone="blue"
                        href="/inspection/saved-inspections"
                        loading={pendingReports.isLoading}
                    />
                    <StatCard
                        title="Completed Reports"
                        value={inspectedCount}
                        icon={ClipboardCheck}
                        tone="green"
                        href="/inspection/completed-inspections"
                        loading={inspectedReports.isLoading}
                    />
                    <StatCard
                        title="Items Queue"
                        value={nextReceipts.reduce((sum, receipt) => sum + (receipt.details?.length || 0), 0)}
                        icon={Package}
                        tone="slate"
                        loading={pendingReceipts.isLoading}
                    />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-4">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Next Receipts to Inspect</h2>
                                    <p className="text-xs text-slate-500">Priority queue (oldest first)</p>
                                </div>
                                <Link
                                    href="/inspection/inspections"
                                    className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                                >
                                    Open Queue
                                    <ArrowUpRight className="w-4 h-4" />
                                </Link>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {pendingReceipts.isLoading ? (
                                    [...Array(4)].map((_, i) => (
                                        <div key={i} className="p-4">
                                            <div className="h-4 w-40 bg-slate-200 rounded animate-pulse mb-2" />
                                            <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
                                        </div>
                                    ))
                                ) : nextReceipts.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500">No pending receipts.</div>
                                ) : (
                                    nextReceipts.map((receipt) => (
                                        <div key={receipt.DRID} className="p-4 flex items-center justify-between">
                                            <div>
                                                <div className="font-semibold text-slate-900">{receipt.DRNumber}</div>
                                                <div className="text-sm text-slate-500">
                                                    {receipt.SupplierName} · {receipt.PONumber || 'No PO'}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1">
                                                    {formatInTimeZone(new Date(receipt.DateReceived), 'Asia/Manila', 'MMM dd, yyyy')} · {receipt.details?.length || 0} items
                                                </div>
                                            </div>
                                            <Link
                                                href="/inspection/inspections"
                                                className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                                            >
                                                Inspect
                                            </Link>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
                            <div className="space-y-2">
                                <Link
                                    href="/inspection/inspections"
                                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50"
                                >
                                    <span className="text-sm font-medium text-slate-700">Start Inspection</span>
                                    <ClipboardList className="w-4 h-4 text-slate-500" />
                                </Link>
                                <Link
                                    href="/inspection/saved-inspections"
                                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50"
                                >
                                    <span className="text-sm font-medium text-slate-700">Resume Draft</span>
                                    <Clock className="w-4 h-4 text-slate-500" />
                                </Link>
                                <Link
                                    href="/inspection/completed-inspections"
                                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50"
                                >
                                    <span className="text-sm font-medium text-slate-700">View Completed</span>
                                    <ClipboardCheck className="w-4 h-4 text-slate-500" />
                                </Link>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                                <CalendarCheck className="w-5 h-5 text-emerald-600" />
                                <div>
                                    <div className="font-semibold text-slate-900">Recent Inspections</div>
                                    <div className="text-xs text-slate-500">Last 5 completed</div>
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {inspectedReports.isLoading ? (
                                    [...Array(3)].map((_, i) => (
                                        <div key={i} className="p-4">
                                            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-2" />
                                            <div className="h-3 w-44 bg-slate-100 rounded animate-pulse" />
                                        </div>
                                    ))
                                ) : recentInspected.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500">No completed reports yet.</div>
                                ) : (
                                    recentInspected.map((report) => (
                                        <div key={report.IARID} className="p-4">
                                            <div className="font-medium text-slate-900">{report.IARNumber || `IAR-${report.IARID}`}</div>
                                            <div className="text-sm text-slate-500">
                                                {report.deliveryReceipt?.DRNumber || report.delivery_receipt?.DRNumber || 'N/A'} · {report.deliveryReceipt?.SupplierName || report.delivery_receipt?.SupplierName || 'Unknown supplier'}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
