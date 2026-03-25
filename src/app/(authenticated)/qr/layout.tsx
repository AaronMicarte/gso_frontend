'use client';

import { AuthProvider } from '@/lib/providers/AuthProvider';
import { useAuth } from '@/lib/hooks/useAuth';
import { NotificationBootstrap } from '@/components/layout/NotificationBootstrap';
import Sidebar from '@/components/layout/Sidebar';
import { LogoutConfirmModal } from '@/components/ui/LogoutConfirmModal';
import { Menu, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { User } from '@/types/auth';

const QR_LOADING_USER: User = {
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

export default function QrLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <QrLayoutInner>{children}</QrLayoutInner>
        </AuthProvider>
    );
}

function QrLayoutInner({ children }: { children: React.ReactNode }) {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);

    const effectiveUser = user ?? QR_LOADING_USER;

    const baseRoute = useMemo(() => {
        const role = (effectiveUser.Role ?? '').toLowerCase();
        const mapping: Record<string, string> = {
            'admin': '/admin',
            'gso staff': '/staff',
            'department head': '/department_head',
            'inspection officer': '/staff',
        };
        return mapping[role] ?? '/admin';
    }, [effectiveUser.Role]);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
            return;
        }

        if (!loading && user) {
            const realRole = user.Role.toLowerCase();
            const validRoles = ['admin', 'gso staff', 'department head', 'inspection officer'];
            if (!validRoles.includes(realRole)) {
                router.push('/');
            }
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

            <Sidebar user={effectiveUser} isOpen={mobileMenuOpen} onLogout={handleLogout} baseRoute={baseRoute} />

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
