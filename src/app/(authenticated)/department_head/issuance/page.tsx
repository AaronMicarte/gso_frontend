'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { FileText, Plus, FileCheck } from 'lucide-react';
import Link from 'next/link';

export default function DepartmentHeadIssuance() {
    const { user } = useAuth();

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Property Issuance</h1>
                    <p className="text-slate-500 text-sm">Manage property issuance requests for your department</p>
                </div>
                <div className="text-sm text-slate-600">
                    Welcome back, {user?.FullName || 'Department Head'}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                    href="/department_head/issuance/new"
                    className="flex items-center gap-3 p-6 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <div className="p-3 bg-blue-100 rounded-lg">
                        <Plus className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <div className="font-medium text-slate-900">Create New Request</div>
                        <div className="text-sm text-slate-500">Request property assignment</div>
                    </div>
                </Link>

                <Link
                    href="/department_head/issuance"
                    className="flex items-center gap-3 p-6 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <div className="p-3 bg-green-100 rounded-lg">
                        <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <div className="font-medium text-slate-900">View Requests</div>
                        <div className="text-sm text-slate-500">Check request status</div>
                    </div>
                </Link>

                <Link
                    href="/department_head/issuance/par"
                    className="flex items-center gap-3 p-6 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <div className="p-3 bg-purple-100 rounded-lg">
                        <FileCheck className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                        <div className="font-medium text-slate-900">PAR Documents</div>
                        <div className="text-sm text-slate-500">Property Acknowledgement Receipts</div>
                    </div>
                </Link>
            </div>

            {/* Placeholder Content */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Issuance Management</h3>
                    <p className="text-slate-500 mb-4">This feature is under development. Please check back later.</p>
                    <div className="text-sm text-slate-400">
                        Available actions: Create Request, View Requests, PAR Documents, ICS Documents
                    </div>
                </div>
            </div>
        </div>
    );
}