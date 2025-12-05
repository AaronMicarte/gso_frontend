'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth } from '@/lib/auth';

// Skeleton loader component - RAWR! 🦖
function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={`animate-pulse bg-slate-700/50 rounded ${className || ''}`}
        />
    );
}

function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-slate-900 p-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between mb-8">
                <Skeleton className="h-10 w-48" />
                <div className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>

            {/* Sidebar + Content layout */}
            <div className="flex gap-6">
                {/* Sidebar skeleton */}
                <div className="w-64 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-3/4" />
                </div>

                {/* Main content skeleton */}
                <div className="flex-1 space-y-6">
                    {/* Stats cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                    </div>

                    {/* Table skeleton */}
                    <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                        <Skeleton className="h-8 w-48 mb-4" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}

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

    // Show skeleton while checking auth
    if (isChecking) {
        return <DashboardSkeleton />;
    }

    // Redirect happening, show skeleton
    if (!isAuthenticated) {
        return <DashboardSkeleton />;
    }

    return <>{children}</>;
}
