'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

// Role to route mapping
const roleRoutes: Record<string, string> = {
    'gso admin': '/admin/dashboard',
    'gso staff': '/staff/dashboard',
    'department head': '/department_head/dashboard',
};

export default function RoleGuard({
    children,
    allowedRoles,
}: {
    children: React.ReactNode;
    allowedRoles: string[];
}) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            const userRole = user.Role.toLowerCase();
            const isAllowed = allowedRoles.some(role => role.toLowerCase() === userRole);

            if (!isAllowed) {
                // Redirect to their own dashboard
                const correctRoute = roleRoutes[userRole] || '/';
                router.push(correctRoute);
            }
        }
    }, [loading, user, allowedRoles, router]);

    if (loading) {
        return null; // Parent layout shows skeleton
    }

    if (!user) {
        return null;
    }

    const userRole = user.Role.toLowerCase();
    const isAllowed = allowedRoles.some(role => role.toLowerCase() === userRole);

    if (!isAllowed) {
        return null; // Redirecting...
    }

    return <>{children}</>;
}
