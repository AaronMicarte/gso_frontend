'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';

export default function ICSDocuments() {
    const { user } = useAuth();

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/department_head/issuance"
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">ICS Documents</h1>
                    <p className="text-slate-500 text-sm">Inventory Custodian Slip documents</p>
                </div>
            </div>

            {/* Placeholder Content */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">ICS Documents</h3>
                    <p className="text-slate-500 mb-4">This feature is under development. Please check back later.</p>
                    <div className="text-sm text-slate-400">
                        Inventory Custodian Slip documents will be listed here
                    </div>
                </div>
            </div>
        </div>
    );
}