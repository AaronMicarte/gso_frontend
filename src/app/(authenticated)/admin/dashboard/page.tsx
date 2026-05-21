'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDashboardStats, getRecentActivity } from '@/lib/api/dashboard';
import { DashboardStats, Activity } from '@/types/dashboard';
import {
    Package,
    Boxes,
    ClipboardList,
    Users,
    Building2,
    Wrench,
    Trash2,
    Clock,
    UserPlus,
    PackagePlus,
    FileText,
    BarChart3,
    LogIn,
    LogOut,
    XCircle,
    FileCheck,
    RefreshCw,
    LucideIcon,
} from 'lucide-react';

// Stat card component with Lucide icons
interface StatCardProps {
    title: string;
    value: number;
    icon: LucideIcon;
    iconColor: string;
    bgColor: string;
    loading?: boolean;
    href?: string;
}

function StatCard({ title, value, icon: Icon, iconColor, bgColor, loading, href }: StatCardProps) {
    const content = (
        <div className={`bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow ${href ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
            <div className="flex items-center justify-between">
                <div>
                    {loading ? (
                        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse mb-1" />
                    ) : (
                        <p className="text-3xl font-bold text-slate-800">{value.toLocaleString()}</p>
                    )}
                    <p className="text-sm text-slate-500 mt-1">{title}</p>
                </div>
                <div className={`p-3 rounded-xl ${bgColor}`}>
                    <Icon className={`w-6 h-6 ${iconColor}`} />
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

// Activity icon mapper
function getActivityIcon(type: string, action: string): LucideIcon {
    if (type === 'login') {
        if (action.includes('logged in')) return LogIn;
        if (action.includes('logged out')) return LogOut;
        if (action.includes('Failed')) return XCircle;
    }
    if (type === 'delivery_receipt') return FileCheck;
    if (type === 'issuance') return PackagePlus;
    if (type === 'audit' || type === 'asset_audit') return PackagePlus;
    if (type === 'rpc_audit') return ClipboardList;
    return Clock;
}

// Activity color mapper
function getActivityColor(type: string, action: string): string {
    if (type === 'login') {
        if (action.includes('logged in')) return 'text-green-500';
        if (action.includes('logged out')) return 'text-blue-500';
        if (action.includes('Failed')) return 'text-red-500';
    }
    if (type === 'delivery_receipt') return 'text-amber-500';
    if (type === 'issuance') return 'text-indigo-500';
    if (type === 'asset_audit' || type === 'audit') return 'text-indigo-500';
    if (type === 'rpc_audit') return 'text-purple-500';
    return 'text-slate-500';
}

// Recent activity component
interface RecentActivityProps {
    activities: Activity[];
    loading: boolean;
    onRefresh: () => void;
}

function RecentActivity({ activities, loading, onRefresh }: RecentActivityProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-500" />
                    Recent Activity
                </h3>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                    aria-label="Refresh activity"
                >
                    <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            <div className="divide-y divide-slate-100">
                {loading ? (
                    // Loading skeleton
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
                                <div className="flex-1">
                                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-2" />
                                    <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                                </div>
                                <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                            </div>
                        </div>
                    ))
                ) : activities.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>No recent activity</p>
                    </div>
                ) : (
                    activities.map((activity) => {
                        const ActivityIcon = getActivityIcon(activity.type, activity.action);
                        const iconColor = getActivityColor(activity.type, activity.action);

                        const performedBy = activity.performed_by ?? activity.user ?? '';
                        const meta = activity.meta ?? {};

                        const getMetaAny = (keys: string[]) => {
                            for (const k of keys) {
                                if (meta[k]) return String(meta[k]);
                            }
                            return null;
                        };

                        const refNumber = getMetaAny(['drNumber', 'dr_number', 'transfer_number', 'borrow_number', 'propertyNumber', 'property_number', 'iarNumber', 'iar_number', 'reference']);

                        const actionLabel = (() => {
                            const a = (activity.action || '').toString();
                            if (/logged in/i.test(a)) return 'User logged in';
                            if (/logged out/i.test(a)) return 'User logged out';
                            if (/failed/i.test(a)) return 'Failed login attempt';
                            if (/created/i.test(a) && refNumber) return `Created — ${refNumber}`;
                            if (refNumber) return `${a} — ${refNumber}`;
                            return a;
                        })();

                        return (
                            <div key={activity.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full bg-slate-100`}>
                                        <ActivityIcon className={`w-4 h-4 ${iconColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">
                                            {actionLabel}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            {activity.description}
                                            {performedBy && (
                                                <>
                                                    {' '}
                                                    • {performedBy}
                                                </>
                                            )}
                                            {activity.type === 'login' && activity.ip_address && (
                                                <span className="ml-1 text-slate-400">({activity.ip_address})</span>
                                            )}
                                        </p>
                                    </div>
                                    <span className="text-xs text-slate-400 whitespace-nowrap">
                                        {activity.timeAgo}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// Quick actions component
function QuickActions() {
    const actions = [
        { label: 'Add User', href: '/admin/users/new', icon: UserPlus, color: 'text-blue-500' },
        { label: 'New Delivery Receipt', href: '/admin/procurement/delivery-receipts/new', icon: FileText, color: 'text-green-500' },
        { label: 'View Issuance', href: '/admin/issuance', icon: FileCheck, color: 'text-amber-500' },
        { label: 'View Reports', href: '/admin/reports', icon: BarChart3, color: 'text-purple-500' },
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-500" />
                Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {actions.map((action) => (
                    <a
                        key={action.href}
                        href={action.href}
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                    >
                        <action.icon className={`w-5 h-5 ${action.color} group-hover:scale-110 transition-transform`} />
                        <span className="text-sm font-medium text-slate-700">{action.label}</span>
                    </a>
                ))}
            </div>
        </div>
    );
}

// Inventory overview component
function InventoryOverview({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
    const total = stats?.totalInventory ?? 0;
    const issued = stats?.issuedInventory ?? 0;
    const forIssuance = stats?.forIssuanceInventory ?? 0;
    const utilization = total > 0 ? Math.round((issued / total) * 100) : 0;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-500" />
                Inventory Overview
            </h3>
            <div className="space-y-4">
                {/* Utilization Progress Bar */}
                <div>
                    <div className="flex justify-between text-sm text-slate-600 mb-2">
                        <span>Utilization Rate</span>
                        <span>{utilization}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${utilization}%` }}
                        />
                    </div>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-3 gap-4 text-center">
                    <Link href="/admin/inventory/all-items?status=all" className="block">
                        <div className="p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
                            <div className="text-2xl font-bold text-blue-600">
                                {loading ? '...' : total.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">Total Items</div>
                        </div>
                    </Link>
                    <Link href="/admin/inventory/all-items?status=for-issuance" className="block">
                        <div className="p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer">
                            <div className="text-2xl font-bold text-green-600">
                                {loading ? '...' : forIssuance.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">For Issuance</div>
                        </div>
                    </Link>
                    <Link href="/admin/inventory/all-items?status=issued" className="block">
                        <div className="p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer">
                            <div className="text-2xl font-bold text-amber-600">
                                {loading ? '...' : issued.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">Issued</div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}

// System status component
interface SystemStatusProps {
    stats: DashboardStats | null;
    loading: boolean;
}

function SystemStatus({ stats, loading }: SystemStatusProps) {
    const statusItems = [
        {
            label: 'Active Departments',
            value: stats?.totalDepartments ?? 0,
            icon: Building2,
            color: 'text-blue-500',
            bgColor: 'bg-blue-50',
        },
        {
            label: 'For Repair',
            value: stats?.forRepair ?? 0,
            icon: Wrench,
            color: 'text-amber-500',
            bgColor: 'bg-amber-50',
        },
        {
            label: 'For Disposal',
            value: stats?.forDisposal ?? 0,
            icon: Trash2,
            color: 'text-red-500',
            bgColor: 'bg-red-50',
        },
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-500" />
                System Status
            </h3>
            <div className="space-y-3">
                {statusItems.map((item) => (
                    <div
                        key={item.label}
                        className={`flex items-center justify-between p-3 rounded-lg ${item.bgColor}`}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon className={`w-5 h-5 ${item.color}`} />
                            <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        </div>
                        {loading ? (
                            <div className="h-6 w-8 bg-slate-200 rounded animate-pulse" />
                        ) : (
                            <span className={`text-lg font-bold ${item.color}`}>
                                {item.value.toLocaleString()}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function AdminDashboardPage() {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [statsLoading, setStatsLoading] = useState(true);
    const [activityLoading, setActivityLoading] = useState(true);

    // Fetch dashboard data
    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const response = await getDashboardStats();
            setStats(response.stats);
        } catch {
            // Stats will remain at 0
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchActivity = async () => {
        setActivityLoading(true);
        try {
            const response = await getRecentActivity();
            setActivities(response.activities);
        } catch {
            // Activities will remain empty
        } finally {
            setActivityLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchActivity();
    }, []);

    // Get current Manila time for greeting
    const getGreeting = (): string => {
        const hour = new Date().toLocaleString('en-US', {
            hour: 'numeric',
            hour12: false,
            timeZone: 'Asia/Manila',
        });
        const hourNum = parseInt(hour);
        if (hourNum < 12) return 'Good morning';
        if (hourNum < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 min-h-screen" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed' }}>
            {/* Header */}
            <div className="mb-6 sm:mb-8">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                    {getGreeting()}, {user?.FullName || user?.Username}!
                </h1>
                <p className="text-sm sm:text-base text-slate-500 mt-1">
                    Overview of GSO inventory management system.
                </p>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
                <StatCard
                    title="Total Inventory Items"
                    value={stats?.totalInventory ?? 0}
                    icon={Boxes}
                    iconColor="text-blue-600"
                    bgColor="bg-blue-100"
                    loading={statsLoading}
                    href="/admin/inventory/all-items?status=all"
                />
                <StatCard
                    title="For Issuance"
                    value={stats?.forIssuanceInventory ?? 0}
                    icon={Package}
                    iconColor="text-green-600"
                    bgColor="bg-green-100"
                    loading={statsLoading}
                    href="/admin/inventory/all-items?status=for-issuance"
                />
                <StatCard
                    title="Issued"
                    value={stats?.issuedInventory ?? 0}
                    icon={ClipboardList}
                    iconColor="text-amber-600"
                    bgColor="bg-amber-100"
                    loading={statsLoading}
                    href="/admin/inventory/all-items?status=issued"
                />
                <StatCard
                    title="Delivery Receipts"
                    value={stats?.totalDeliveryReceipts ?? 0}
                    icon={FileText}
                    iconColor="text-indigo-600"
                    bgColor="bg-indigo-100"
                    loading={statsLoading}
                />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
                <StatCard
                    title="Active Users"
                    value={stats?.totalUsers ?? 0}
                    icon={Users}
                    iconColor="text-orange-600"
                    bgColor="bg-orange-100"
                    loading={statsLoading}
                />
                <StatCard
                    title="Active Departments"
                    value={stats?.totalDepartments ?? 0}
                    icon={Building2}
                    iconColor="text-blue-600"
                    bgColor="bg-blue-100"
                    loading={statsLoading}
                />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Left column - Recent Activity & Inventory Overview */}
                <div className="lg:col-span-2 space-y-6">
                    <InventoryOverview stats={stats} loading={statsLoading} />
                    <RecentActivity
                        activities={activities}
                        loading={activityLoading}
                        onRefresh={fetchActivity}
                    />
                </div>

                {/* Right sidebar - Quick Actions & System Status */}
                <div className="space-y-6">
                    <QuickActions />
                    <SystemStatus stats={stats} loading={statsLoading} />
                </div>
            </div>
        </div>
    );
}
