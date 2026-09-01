'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDashboardRoute } from '@/lib/auth';

export default function StaffIndexPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;
        const target = user
            ? getDashboardRoute(user.Role, user.UserRoleID, user.UserID)
            : '/staff/dashboard';
        router.replace(target.startsWith('/staff') ? target : '/staff/dashboard');
    }, [user, loading, router]);

    return null;
}