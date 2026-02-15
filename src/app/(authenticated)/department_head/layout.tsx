'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { LogoutConfirmModal } from '@/components/ui/LogoutConfirmModal';
import { AuthProvider } from '@/lib/providers/AuthProvider';

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
                <div className="h-64 bg-slate-700/50 rounded-lg animate-pulse" />
            </div>
        </div>
    );
}

export default function DepartmentHeadLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <DepartmentHeadLayoutInner>
                {children}
            </DepartmentHeadLayoutInner>
        </AuthProvider>
    );
}

function DepartmentHeadLayoutInner({
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

        // MFA not enabled - redirect to setup
        if (!loading && user && user.MFAEnabled === false) {
            sessionStorage.setItem('mfa_setup_pending', JSON.stringify({
                userId: user.UserID,
                userRole: user.Role,
            }));
            router.push('/setup-mfa');
            return;
        }

        // Wrong role - redirect to their dashboard
        if (!loading && user && user.Role.toLowerCase() !== 'department head') {
            const roleRoutes: Record<string, string> = {
                'admin': '/admin/dashboard',
                'gso staff': '/staff/dashboard',
                'end user': '/user/dashboard',
                'inspection officer': '/inspection/inspections',
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

    // Show skeleton while loading or if wrong role or MFA not enabled
    if (loading || !user || user.MFAEnabled === false || user.Role.toLowerCase() !== 'department head') {
        return <DashboardSkeleton />;
    }

    return (
        <div className="min-h-screen bg-slate-100 flex">
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-800 border-b border-slate-700 z-50 flex items-center justify-between px-4">
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-slate-300 hover:text-white transition-colors"
                >
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
                <div className="text-white font-semibold">GSO IAMS</div>
                <div className="w-10" /> {/* Spacer for centering */}
            </header>

            {/* Sidebar */}
            <Sidebar
                user={user}
                isOpen={mobileMenuOpen}
                onLogout={handleLogout}
                baseRoute="/department_head"
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