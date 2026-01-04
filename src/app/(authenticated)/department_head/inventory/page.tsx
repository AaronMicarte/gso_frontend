'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { Box } from 'lucide-react';

export default function DepartmentHeadInventory() {
    const { user } = useAuth();

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Property Inventory</h1>
                    <p className="text-slate-500 text-sm">View and monitor property inventory for your department</p>
                </div>
                <div className="text-sm text-slate-600">
                    Welcome back, {user?.FullName || 'Department Head'}
                </div>
            </div>

            {/* Placeholder Content */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                <div className="text-center">
                    <Box className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Property Inventory</h3>
                    <p className="text-slate-500 mb-4">This feature is under development. Please check back later.</p>
                    <div className="text-sm text-slate-400">
                        Department property inventory will be displayed here
                    </div>
                </div>
            </div>
        </div>
    );
}