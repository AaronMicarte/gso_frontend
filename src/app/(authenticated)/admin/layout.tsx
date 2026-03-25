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

const ADMIN_LOADING_USER: User = {
    UserID: 0,
    Username: 'loading',
    Email: 'loading@local',
    FullName: 'Loading User',
    Role: 'Admin',
    UserRoleID: 1,
    Department: 'GSO',
    DepartmentID: 0,
    MFAEnabled: true,
};

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <AdminLayoutInner>
                {children}
            </AdminLayoutInner>
        </AuthProvider>
    );
}

function AdminLayoutInner({
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
        return null;
    }

    const effectiveUser = user ?? ADMIN_LOADING_USER;
    const isAuthorizedRole = effectiveUser.Role.toLowerCase() === 'admin';

    if (!loading && !isAuthorizedRole) {
        return null;
    }

    // If we have a valid user, show the real sidebar even during loading

    return (
        <div className="min-h-screen bg-slate-100 flex">
            {user ? <NotificationBootstrap user={user} /> : null}
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
                user={effectiveUser}
                isOpen={mobileMenuOpen}
                onLogout={handleLogout}
                baseRoute="/admin"
            />

            {/* Main Content */}
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
