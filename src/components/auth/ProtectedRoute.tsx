'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    useEffect(() => {
        const token = getToken();
        if (!token) {
            router.push('/');
        }
    }, [router]);

    const token = getToken();
    if (!token) {
        return null; // or a loading spinner
    }

    return <>{children}</>;
}
