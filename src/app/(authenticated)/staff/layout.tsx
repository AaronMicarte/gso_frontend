'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { NotificationBootstrap } from '@/components/layout/NotificationBootstrap';
import { LogoutConfirmModal } from '@/components/ui/LogoutConfirmModal';
import { AuthProvider } from '@/lib/providers/AuthProvider';
import { User } from '@/types/auth';

function DashboardSkeleton() {
    return (
        <>
            <div className="h-10 w-48 bg-slate-300/70 rounded animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-slate-300/70 rounded-lg animate-pulse" />
                ))}
            </div>
            <div className="h-64 bg-slate-300/70 rounded-lg animate-pulse" />
        </>
    );
}

const STAFF_LOADING_USER: User = {
    UserID: 0,
    Username: 'loading',
    Email: 'loading@local',
    FullName: 'Loading User',
    Role: 'GSO Staff',
    UserRoleID: 2,
    Department: 'GSO',
    DepartmentID: 0,
    MFAEnabled: true,
};

export default function StaffLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <StaffLayoutInner>{children}</StaffLayoutInner>
        </AuthProvider>
    );
}

function StaffLayoutInner({ children }: { children: React.ReactNode }) {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
            return;
        }

        if (!loading && user && !['gso staff', 'inspection officer'].includes(user.Role.toLowerCase())) {
            const roleRoutes: Record<string, string> = {
                'admin': '/admin/dashboard',
                'department head': '/department_head/dashboard',
                'end user': '/user/dashboard',
                'inspection officer': '/staff/delivery-receipts',
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

    if (!loading && !user) {
        return (
            <div className="min-h-screen bg-slate-100">
                <main className="pt-16 lg:pt-0 p-6 space-y-6">
                    <DashboardSkeleton />
                </main>
            </div>
        );
    }

    const effectiveUser = user ?? STAFF_LOADING_USER;
    const isAuthorizedRole = ['gso staff', 'inspection officer'].includes(effectiveUser.Role.toLowerCase());

    if (!loading && !isAuthorizedRole) {
        return (
            <div className="min-h-screen bg-slate-100">
                <main className="pt-16 lg:pt-0 p-6 space-y-6">
                    <DashboardSkeleton />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex">
            {user ? <NotificationBootstrap user={user} /> : null}
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

            {mobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40 mt-16"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            <Sidebar
                user={effectiveUser}
                isOpen={mobileMenuOpen}
                onLogout={handleLogout}
                baseRoute="/staff"
            />

            <main className="flex-1 lg:ml-64 overflow-auto pt-16 lg:pt-0">
                {loading ? (
                    <div className="p-6 space-y-6">
                        <DashboardSkeleton />
                    </div>
                ) : (
                    children
                )}
            </main>

            <LogoutConfirmModal
                isOpen={logoutModalOpen}
                onClose={() => setLogoutModalOpen(false)}
                onConfirm={confirmLogout}
            />
        </div>
    );
}
