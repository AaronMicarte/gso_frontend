'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { showConfirmDialog } from '@/lib/utils/confirm';
import {
    LayoutDashboard,
    Users,
    Boxes,
    Package,
    BarChart3,
    Settings,
    LogOut,
    LucideIcon,
} from 'lucide-react';

// Admin navigation items with Lucide icons
const navItems: { label: string; href: string; icon: LucideIcon }[] = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Inventory', href: '/admin/inventory', icon: Boxes },
    { label: 'Assets', href: '/admin/assets', icon: Package },
    { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
];

// Skeleton loader while checking auth
function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-slate-900 flex">
            {/* Sidebar skeleton */}
            <div className="w-64 bg-slate-800 p-4 space-y-4">
                <div className="h-10 bg-slate-700/50 rounded animate-pulse" />
                <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-10 bg-slate-700/50 rounded animate-pulse" />
                    ))}
                </div>
            </div>
            {/* Main content skeleton */}
            <div className="flex-1 p-6 space-y-6">
                <div className="h-10 w-48 bg-slate-700/50 rounded animate-pulse" />
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 bg-slate-700/50 rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Not authenticated - redirect to login
        if (!loading && !user) {
            router.push('/');
            return;
        }

        // Wrong role - redirect to their dashboard
        if (!loading && user && user.Role.toLowerCase() !== 'admin') {
            const roleRoutes: Record<string, string> = {
                'gso staff': '/staff/dashboard',
                'property custodian': '/custodian/dashboard',
                'department head': '/department/dashboard',
                'end user': '/user/dashboard',
            };
            const correctRoute = roleRoutes[user.Role.toLowerCase()] || '/';
            router.push(correctRoute);
        }
    }, [loading, user, router]);

    const handleLogout = () => {
        showConfirmDialog({
            title: 'Logout Confirmation',
            description: 'Are you sure you want to logout?',
            confirmText: 'Logout',
            cancelText: 'Cancel',
            onConfirm: logout,
        });
    };

    // Show skeleton while loading or if wrong role
    if (loading || !user || user.Role.toLowerCase() !== 'admin') {
        return <DashboardSkeleton />;
    }

    return (
        <div className="min-h-screen bg-slate-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-800 text-white flex flex-col">
                {/* Logo/Brand */}
                <div className="p-4 border-b border-slate-700">
                    <h1 className="text-xl font-bold text-[var(--primary)]">IAMS-GSO</h1>
                    <p className="text-xs text-slate-400 mt-1">Inventory & Asset Management</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        const Icon = item.icon;
                        return (
                            <a
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                                    ? 'bg-[var(--primary)] text-white'
                                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-sm font-medium">{item.label}</span>
                            </a>
                        );
                    })}
                </nav>

                {/* User Info & Logout */}
                <div className="p-4 border-t border-slate-700">
                    <div className="mb-3">
                        <p className="text-sm font-medium text-white">{user.FullName || user.Username}</p>
                        <p className="text-xs text-slate-400">{user.Role}</p>
                        <p className="text-xs text-slate-500">{user.Department}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
