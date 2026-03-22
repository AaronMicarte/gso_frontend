'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthProvider } from '@/lib/providers/AuthProvider';

function DashboardSkeleton() {
    return <div className="min-h-screen bg-slate-100" />;
}

export default function InspectionLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <InspectionLayoutInner>{children}</InspectionLayoutInner>
        </AuthProvider>
    );
}

function InspectionLayoutInner({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/');
            return;
        }
        if (!loading && user) {
            router.replace('/staff/delivery-receipts');
        }
    }, [loading, user, router]);

    if (loading || !user) {
        return <DashboardSkeleton />;
    }
    return <DashboardSkeleton />;
}
