'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { FileBarChart } from 'lucide-react';

export default function DepartmentHeadReports() {
    const { user } = useAuth();

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">My Reports</h1>
                    <p className="text-slate-500 text-sm">View reports related to your department&apos;s property management</p>
                </div>
                <div className="text-sm text-slate-600">
                    Welcome back, {user?.FullName || 'Department Head'}
                </div>
            </div>

            {/* Placeholder Content */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                <div className="text-center">
                    <FileBarChart className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Department Reports</h3>
                    <p className="text-slate-500 mb-4">This feature is under development. Please check back later.</p>
                    <div className="text-sm text-slate-400">
                        Property reports and analytics will be available here
                    </div>
                </div>
            </div>
        </div>
    );
}