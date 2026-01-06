'use client';

import Link from 'next/link';
import { Package, FileText, Users, AlertTriangle, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useDepartmentHeadDashboard } from '@/lib/hooks/department_head/useDashboard';

export default function DepartmentHeadDashboard() {
    const { user } = useAuth();
    const { stats, activities, loading, error } = useDepartmentHeadDashboard();

    // Show loading state
    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-slate-200 rounded w-64 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-96"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <div className="animate-pulse">
                                <div className="h-4 bg-slate-200 rounded w-20 mb-2"></div>
                                <div className="h-8 bg-slate-200 rounded w-12 mb-2"></div>
                                <div className="h-3 bg-slate-200 rounded w-24"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-red-800 font-medium">Error loading dashboard</div>
                    <div className="text-red-600 text-sm mt-1">{error}</div>
                </div>
            </div>
        );
    }

    // Default stats if API fails
    const defaultStats = {
        totalAssets: 0,
        assignedAssets: 0,
        pendingRequests: 0,
        overdueReturns: 0,
    };

    const currentStats = stats || defaultStats;

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Department Head Dashboard</h1>
                        <p className="text-slate-500 text-sm">Manage and track property assignments for your department</p>
                    </div>
                    <div className="text-sm text-slate-600">
                        Welcome back, {user?.FullName || 'Department Head'}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Package className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-700">Total Assets</div>
                                <div className="text-2xl font-bold text-slate-900">{currentStats.totalAssets}</div>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500">Under your custody</div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Users className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-700">Assigned</div>
                                <div className="text-2xl font-bold text-slate-900">{currentStats.assignedAssets}</div>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500">Currently assigned</div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-700">Pending</div>
                                <div className="text-2xl font-bold text-slate-900">{currentStats.pendingRequests}</div>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500">Requests awaiting approval</div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-700">Overdue</div>
                                <div className="text-2xl font-bold text-slate-900">{currentStats.overdueReturns}</div>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500">Items past due date</div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Link
                            href="/department_head/asset-requests/new"
                            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="font-medium text-slate-900">Create Request</div>
                                <div className="text-sm text-slate-500">Request new property assignment</div>
                            </div>
                        </Link>

                        <Link
                            href="/department_head/asset-requests"
                            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Package className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <div className="font-medium text-slate-900">View Requests</div>
                                <div className="text-sm text-slate-500">Check request status</div>
                            </div>
                        </Link>

                        <Link
                            href="/custodian/inventory"
                            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <div className="font-medium text-slate-900">View Inventory</div>
                                <div className="text-sm text-slate-500">Browse available assets</div>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
                    <div className="space-y-3">
                        {activities.length > 0 ? activities.map((activity) => (
                            <div key={activity.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg">
                                <div className={`p-2 rounded-full ${activity.status === 'completed' ? 'bg-green-100' :
                                    activity.status === 'pending' ? 'bg-amber-100' : 'bg-red-100'
                                    }`}>
                                    {activity.status === 'completed' ? (
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                    ) : activity.status === 'pending' ? (
                                        <Clock className="w-4 h-4 text-amber-600" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-red-600" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-900">{activity.message}</div>
                                    <div className="text-xs text-slate-500">{activity.time}</div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8 text-slate-500">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <div className="text-sm">No recent activity</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}