'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth } from '@/lib/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const verifyAuth = async () => {
            // Check session via API (httpOnly cookie is sent automatically)
            const authenticated = await checkAuth();

            if (!authenticated) {
                router.push('/');
            } else {
                setIsAuthenticated(true);
            }
            setIsChecking(false);
        };

        verifyAuth();
    }, [router]);

    if (isChecking) {
        return null;
    }

    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}
