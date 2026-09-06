'use client';

import React from 'react';
import { AlertCircle, Lock, AlertTriangle } from 'lucide-react';

interface RpcCycleStatusBannerProps {
    status: 'active' | 'closed' | 'permanently_locked';
    closedAt?: string | null;
    reopenCount?: number | null;
    closeReason?: string | null;
}

export function RpcCycleStatusBanner({
    status,
    closedAt,
    reopenCount,
    closeReason,
}: RpcCycleStatusBannerProps) {
    if (status === 'active') {
        return null;
    }

    const isPermanentlyLocked = status === 'permanently_locked' || (status === 'closed' && (reopenCount ?? 0) >= 2);

    if (isPermanentlyLocked) {
        return (
            <div className='bg-red-50 border border-red-300 rounded-lg p-4 flex gap-3 mb-4'>
                <Lock className='h-5 w-5 text-red-600 flex-shrink-0 mt-0.5' />
                <div className='flex-1'>
                    <p className='font-semibold text-red-900'>This cycle is permanently locked</p>
                    <p className='text-sm text-red-800 mt-1'>
                        Maximum reopens (2) have been reached. This cycle can&apos;t be open again and cannot be edited.
                    </p>
                    {closedAt && (
                        <p className='text-xs text-red-700 mt-2'>
                            Closed on {new Date(closedAt).toLocaleString()}
                            {reopenCount !== undefined && ` • Reopened ${reopenCount} time${reopenCount !== 1 ? 's' : ''}`}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (status === 'closed') {
        return (
            <div className='bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex gap-3 mb-4'>
                <AlertTriangle className='h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5' />
                <div className='flex-1'>
                    <p className='font-semibold text-yellow-900'>This cycle is closed and read-only</p>
                    <p className='text-sm text-yellow-800 mt-1'>
                        {closeReason ? `Reason: ${closeReason}` : 'All buttons and functions are locked. No scans can be added, edited, or deleted.'}
                    </p>
                    {closedAt && (
                        <p className='text-xs text-yellow-700 mt-2'>
                            Closed on {new Date(closedAt).toLocaleString()}
                            {reopenCount !== undefined && ` • Reopened ${reopenCount} time${reopenCount !== 1 ? 's' : ''}`}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
