'use client';

import React, { ChangeEvent, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle } from 'lucide-react';
import { reopenRpcCycle } from '@/lib/api/rpcInventory';

interface RpcReopenCycleModalProps {
    cycleId: number;
    cycleName: string;
    closedAt: string;
    closeReason: string;
    reopenCount: number;
    onClose: () => void;
    onSuccess: (cycle: unknown) => void;
}

export function RpcReopenCycleModal({
    cycleId,
    cycleName,
    closedAt,
    closeReason,
    reopenCount,
    onClose,
    onSuccess,
}: RpcReopenCycleModalProps) {
    const [password, setPassword] = useState('');
    const [reopenReason, setReopenReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);

    const canReopen = (reopenCount ?? 0) < 2;
    const reopensRemaining = 2 - (reopenCount ?? 0);

    const handleReopen = async () => {
        if (!password.trim()) {
            setError('Password is required to reopen the cycle');
            return;
        }

        if (!reopenReason.trim() || reopenReason.length < 10) {
            setError('Reopen reason must be at least 10 characters');
            return;
        }

        if (!confirmed) {
            setError('Please confirm before reopening the cycle');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await reopenRpcCycle(cycleId, { password, reason: reopenReason });
            onSuccess(result);
        } catch (err: unknown) {
            // Try to parse server validation errors (axios-style)
            const resp = err && typeof err === 'object' && 'response' in err ? (err as { response?: unknown }).response : null;
            if (resp && typeof resp === 'object' && resp !== null && 'data' in (resp as Record<string, unknown>)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = (resp as any).data;
                if (data.errors) {
                    const first = Object.values(data.errors)[0];
                    setError(Array.isArray(first) ? String(first[0]) : String(first));
                } else if (data.message) {
                    setError(String(data.message));
                } else {
                    setError('Failed to reopen inventory cycle');
                }
            } else {
                setError(err instanceof Error ? err.message : 'Failed to reopen inventory cycle');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open
            onOpenChange={onClose}
            title="Request to Reopen Inventory Cycle"
            description="Reopen this closed cycle to add, edit, or delete scans."
            onConfirm={handleReopen}
            confirmText={loading ? 'Reopening...' : 'Reopen Cycle'}
            cancelText="Cancel"
            loading={loading}
            hideConfirm
            contentClassName="max-w-2xl"
        >
            <div className='space-y-6'>
                {/* Closure Information */}
                <div className='bg-gray-50 border border-gray-200 rounded-lg p-4'>
                    <h3 className='font-semibold text-gray-900 mb-3'>Closure Information</h3>
                    <div className='space-y-2 text-sm'>
                        <div className='flex justify-between'>
                            <span className='text-gray-600'>Cycle Name:</span>
                            <span className='font-semibold'>{cycleName}</span>
                        </div>
                        <div className='flex justify-between'>
                            <span className='text-gray-600'>Closed At:</span>
                            <span className='font-semibold'>{closedAt ? new Date(closedAt).toLocaleString() : '—'}</span>
                        </div>
                        <div className='flex justify-between'>
                            <span className='text-gray-600'>Close Reason:</span>
                            <span className='font-semibold max-w-xs text-right'>{closeReason}</span>
                        </div>
                        <div className='flex justify-between pt-2 border-t border-gray-300'>
                            <span className='text-gray-600'>Current Reopen Count:</span>
                            <span className={`font-semibold ${(reopenCount ?? 0) >= 2 ? 'text-red-600' : 'text-gray-900'}`}>
                                {(reopenCount ?? 0)} / 2
                            </span>
                        </div>
                    </div>
                </div>

                {/* Reopen Limit Warning */}
                {!canReopen && (
                    <div className='bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3'>
                        <AlertCircle className='h-5 w-5 text-red-700 flex-shrink-0 mt-0.5' />
                        <div className='text-sm text-red-800'>
                            <p className='font-semibold'>Reopen Limit Reached</p>
                            <p>This cycle has reached the maximum reopen limit (2). It is now permanently locked and cannot be reopened.</p>
                        </div>
                    </div>
                )}

                {canReopen && (
                    <>
                        {/* Reopen Remaining Warning */}
                        <div className={`border rounded-lg p-3 flex gap-3 ${reopensRemaining === 1 ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}>
                            <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${reopensRemaining === 1 ? 'text-yellow-700' : 'text-blue-700'}`} />
                            <div className={`text-sm ${reopensRemaining === 1 ? 'text-yellow-800' : 'text-blue-800'}`}>
                                <p className='font-semibold'>
                                    {reopensRemaining} Reopen{reopensRemaining !== 1 ? 's' : ''} Remaining
                                </p>
                                <p>After this cycle reaches 2 reopens, it will be permanently locked.</p>
                            </div>
                        </div>

                        {/* Password Verification */}
                        <div>
                            <label className='block text-sm font-medium text-gray-700 mb-2'>
                                Your Password * (Required for verification)
                            </label>
                            <Input
                                type='password'
                                placeholder='Enter your password to verify'
                                value={password}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                    setPassword(e.target.value);
                                    setError(null);
                                }}
                                disabled={loading}
                                className='text-sm'
                            />
                        </div>

                        {/* Reopen Reason */}
                        <div>
                            <label className='block text-sm font-medium text-gray-700 mb-2'>
                                Reason for Reopening *
                            </label>
                            <textarea
                                placeholder='Explain why this cycle needs to be reopened (minimum 10 characters)...'
                                value={reopenReason}
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                                    setReopenReason(e.target.value);
                                    setError(null);
                                }}
                                minLength={10}
                                maxLength={1000}
                                className='w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 h-24'
                                disabled={loading}
                            />
                            <p className='text-xs text-gray-500 mt-1'>
                                {reopenReason.length}/1000 characters
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className='bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700'>
                                {error}
                            </div>
                        )}

                        {/* Confirmation Checkbox */}
                        <div className='flex items-start gap-3'>
                            <input
                                type='checkbox'
                                id='confirm-reopen'
                                checked={confirmed}
                                onChange={(e) => setConfirmed(e.target.checked)}
                                disabled={loading}
                                className='mt-1'
                            />
                            <label htmlFor='confirm-reopen' className='text-sm text-gray-600'>
                                I confirm that I need to reopen <strong>{cycleName}</strong> to make additional changes.
                                I understand that this will increment the reopen counter.
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className='flex gap-3 justify-end'>
                            <Button variant='outline' onClick={onClose} disabled={loading}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleReopen}
                                disabled={loading || !password.trim() || !reopenReason.trim() || !confirmed}
                                className='bg-green-600 hover:bg-green-700'
                            >
                                {loading ? 'Reopening...' : 'Reopen Cycle'}
                            </Button>
                        </div>
                    </>
                )}

                {!canReopen && (
                    <div className='flex gap-3 justify-end'>
                        <Button variant='outline' onClick={onClose}>
                            Close
                        </Button>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
