'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDashboardRoute } from '@/lib/auth';

export default function AdminIndexPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;
        const target = user
            ? getDashboardRoute(user.Role, user.UserRoleID, user.UserID)
            : '/admin/dashboard';
        router.replace(target.startsWith('/admin') ? target : '/admin/dashboard');
    }, [user, loading, router]);

    return null;
}
