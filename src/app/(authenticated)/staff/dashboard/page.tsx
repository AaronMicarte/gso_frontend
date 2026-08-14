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
    FileText,
    BarChart3,
    FileCheck,
    RefreshCw,
    Database,
    LucideIcon,
} from 'lucide-react';
import { formatActivityAction, getActivityVisual } from '@/lib/activityPresentation';

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
                        const visual = getActivityVisual(activity);
                        const ActivityIcon = visual.icon;
                        const actionLabel = formatActivityAction(activity);

                        return (
                            <div key={activity.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full bg-slate-100`}>
                                        <ActivityIcon className={`w-4 h-4 ${visual.iconColorClass}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">
                                            {actionLabel}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            {activity.description} • {activity.user}
                                            {activity.type === 'login' && activity.ip_address && (
                                                <span className="ml-1 text-slate-400">
                                                    ({activity.ip_address})
                                                </span>
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
        { label: 'New Delivery Receipt', href: '/staff/delivery-receipts/new', icon: FileText, color: 'text-blue-500' },
        { label: 'View Issuance Requests', href: '/staff/issuance', icon: FileCheck, color: 'text-green-500' },
        { label: 'View Delivery Receipts', href: '/staff/delivery-receipts', icon: ClipboardList, color: 'text-purple-500' },
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

// System status component
interface SystemStatusProps {
    stats: DashboardStats | null;
    loading: boolean;
}

function SystemStatus({ stats, loading }: SystemStatusProps) {
    const statusItems = [
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
        {
            label: 'Active Departments',
            value: stats?.totalDepartments ?? 0,
            icon: Building2,
            color: 'text-blue-500',
            bgColor: 'bg-blue-50',
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

export default function StaffDashboardPage() {
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
                    {getGreeting()}, {user?.FullName || user?.Username}! 👋
                </h1>
                <p className="text-sm sm:text-base text-slate-500 mt-1">
                    Here&apos;s what&apos;s happening with your inventory today.
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
                    href="/staff/inventory/all-items?status=all"
                />
                <StatCard
                    title="For Issuance"
                    value={stats?.forIssuanceInventory ?? 0}
                    icon={Package}
                    iconColor="text-green-600"
                    bgColor="bg-green-100"
                    loading={statsLoading}
                    href="/staff/inventory/all-items?status=for-issuance"
                />
                <StatCard
                    title="Issued"
                    value={stats?.issuedInventory ?? 0}
                    icon={ClipboardList}
                    iconColor="text-amber-600"
                    bgColor="bg-amber-100"
                    loading={statsLoading}
                    href="/staff/inventory/all-items?status=issued"
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
                {/* Recent Activity - Takes 2 columns on large screens */}
                <div className="lg:col-span-2">
                    <RecentActivity
                        activities={activities.filter(a => a.type !== 'login')}
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