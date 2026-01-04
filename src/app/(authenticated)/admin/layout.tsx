'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { LogoutConfirmModal } from '@/components/ui/LogoutConfirmModal';



// Skeleton loader while checking auth
function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-slate-900 flex">
            {/* Sidebar skeleton */}
            <div className="w-64 bg-slate-800 p-4 space-y-4">
                <div className="h-10 bg-slate-700/50 rounded animate-pulse" />
                <div className="space-y-2">
                    {[...Array(8)].map((_, i) => (
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);

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
                'department head': '/department_head/dashboard',
                'end user': '/user/dashboard',
            };
            const correctRoute = roleRoutes[user.Role.toLowerCase()] || '/';
            router.push(correctRoute);
        }
    }, [loading, user, router]);

    const handleLogout = () => {
        setLogoutModalOpen(true);
    };

    const confirmLogout = () => {
        setLogoutModalOpen(false);
        logout();
    };

    // Show skeleton while loading or if wrong role
    if (loading || !user || user.Role.toLowerCase() !== 'admin') {
        return <DashboardSkeleton />;
    }

    return (
        <div className="min-h-screen bg-slate-100 flex">
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-800 border-b border-slate-700 z-50 flex items-center justify-between px-4">
                <div>
                    <h1 className="text-lg font-bold text-[var(--primary)]">IAMS-GSO</h1>
                    <p className="text-[10px] text-slate-400">El Salvador City</p>
                </div>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-white hover:bg-slate-700 rounded-lg transition-colors"
                    aria-label="Toggle menu"
                >
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </header>

            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40 mt-16"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar Component */}
            <Sidebar
                user={user}
                isOpen={mobileMenuOpen}
                onLogout={handleLogout}
                baseRoute="/admin"
            />

            {/* Main Content - Offset by sidebar width */}
            <main className="flex-1 lg:ml-64 overflow-auto pt-16 lg:pt-0">
                {children}
            </main>

            <LogoutConfirmModal
                isOpen={logoutModalOpen}
                onClose={() => setLogoutModalOpen(false)}
                onConfirm={confirmLogout}
            />
        </div>
    );
}
