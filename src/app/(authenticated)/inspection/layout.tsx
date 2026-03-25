'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthProvider } from '@/lib/providers/AuthProvider';

export default function InspectionLayout({ children: _children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <InspectionLayoutInner />
        </AuthProvider>
    );
}

function InspectionLayoutInner() {
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

    return null;
}
