'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import {
    Plus,
    Search,
    Eye,
    Edit,
    Trash2,
    FileBarChart,
    AlertCircle
} from 'lucide-react';

interface InspectionReportsPageProps {
    baseRoute: '/admin' | '/staff' | '/custodian';
}

export function InspectionReportsPage({ baseRoute }: InspectionReportsPageProps) {
    const { user } = useAuth();
    const [search, setSearch] = useState('');

    // Permissions based on role
    const canCreate = user?.UserRoleID === 1 || user?.UserRoleID === 2; // Admin or Staff
    const canEdit = user?.UserRoleID === 1 || user?.UserRoleID === 2; // Admin or Staff
    const canDelete = user?.UserRoleID === 1; // Admin only

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Inspection & Acceptance Reports (IAR)</h1>
                    <p className="text-slate-500 text-sm">Manage inspection and acceptance reports for delivered items</p>
                </div>
                {canCreate && (
                    <Link
                        href={`${baseRoute}/inspection-acceptance-reports/new`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Create IAR
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search IAR Number, Supplier, or PO Number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                </div>
            </div>

            {/* Coming Soon Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
                <FileBarChart className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">IAR Module Coming Soon</h3>
                <p className="text-slate-600 mb-4">
                    The Inspection & Acceptance Report module is under development.
                    This feature will allow you to inspect delivered items and generate acceptance reports.
                </p>
                <div className="bg-white rounded-lg p-4 text-left max-w-md mx-auto">
                    <h4 className="font-semibold text-slate-900 mb-2">Planned Features:</h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--primary)] mt-0.5">✓</span>
                            <span>Link IARs to Delivery Receipts</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--primary)] mt-0.5">✓</span>
                            <span>Item inspection and quality checks</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--primary)] mt-0.5">✓</span>
                            <span>Acceptance/rejection workflow</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[var(--primary)] mt-0.5">✓</span>
                            <span>Digital signatures and approvals</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
