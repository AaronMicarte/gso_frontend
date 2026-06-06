'use client';

import React, { ChangeEvent, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { AlertCircle } from 'lucide-react';
import { closeRpcCycle } from '@/lib/api/rpcInventory';

interface RpcCloseCycleModalProps {
    cycleId: number;
    cycleName: string;
    summary: {
        total_expected: number;
        total_scanned: number;
        missing_count: number;
        excess_count?: number;
        completed_locations: number;
        pending_locations: number;
        last_scan_time: string;
    };
    onClose: () => void;
    onSuccess: (cycle: unknown) => void;
}

export function RpcCloseCycleModal({
    cycleId,
    cycleName,
    summary,
    onClose,
    onSuccess,
}: RpcCloseCycleModalProps) {
    const [closeReason, setCloseReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);

    const handleClose = async () => {
        if (!closeReason.trim() || closeReason.length < 10) {
            setError('Closure reason must be at least 10 characters');
            return;
        }

        if (!confirmed) {
            setError('Please confirm before closing the cycle');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await closeRpcCycle(cycleId, closeReason);
            onSuccess(result);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to close inventory cycle');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open
            onOpenChange={onClose}
            title="Close & Finalize Inventory Cycle"
            description="Once closed, this inventory cycle becomes read-only. All records are locked."
            onConfirm={handleClose}
            confirmText={loading ? 'Closing...' : 'Close & Finalize Cycle'}
            cancelText="Cancel"
            loading={loading}
            hideConfirm
            contentClassName="max-w-2xl"
        >
            <div className='space-y-6'>
                {/* Inventory Summary */}
                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
                    <h3 className='font-semibold text-blue-900 mb-3'>Inventory Summary</h3>
                    <div className='grid grid-cols-2 md:grid-cols-3 gap-4 text-sm'>
                        <div>
                            <p className='text-gray-600'>Expected Assets</p>
                            <p className='font-bold text-lg'>{summary.total_expected}</p>
                        </div>
                        <div>
                            <p className='text-gray-600'>Scanned Assets</p>
                            <p className='font-bold text-lg text-green-600'>{summary.total_scanned}</p>
                        </div>
                        <div>
                            <p className='text-gray-600'>Missing Assets</p>
                            <p className={`font-bold text-lg ${summary.missing_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {summary.missing_count}
                            </p>
                        </div>
                        {summary.excess_count !== undefined && (
                            <div>
                                <p className='text-gray-600'>Excess Assets</p>
                                <p className={`font-bold text-lg ${summary.excess_count > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {summary.excess_count}
                                </p>
                            </div>
                        )}
                        <div>
                            <p className='text-gray-600'>Completed Locations</p>
                            <p className='font-bold text-lg'>{summary.completed_locations}</p>
                        </div>
                        <div>
                            <p className='text-gray-600'>Pending Locations</p>
                            <p className={`font-bold text-lg ${summary.pending_locations > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                {summary.pending_locations}
                            </p>
                        </div>
                        <div className='col-span-2 md:col-span-3'>
                            <p className='text-gray-600'>Last Scan</p>
                            <p className='font-semibold text-gray-700'>{new Date(summary.last_scan_time).toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Warning Banner */}
                <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-3'>
                    <AlertCircle className='h-5 w-5 text-yellow-700 flex-shrink-0 mt-0.5' />
                    <div className='text-sm text-yellow-800'>
                        <p className='font-semibold'>Warning:</p>
                        <p>After closure, scans cannot be added, edited, or deleted. This action cannot be undone without explicit reopening.</p>
                    </div>
                </div>

                {/* Closure Reason */}
                <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                        Closure Reason *
                    </label>
                    <textarea
                        placeholder='Provide a reason for closing this inventory cycle (minimum 10 characters)...'
                        value={closeReason}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                            setCloseReason(e.target.value);
                            setError(null);
                        }}
                        minLength={10}
                        maxLength={1000}
                        className='w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 h-24'
                        disabled={loading}
                    />
                    <p className='text-xs text-gray-500 mt-1'>
                        {closeReason.length}/1000 characters
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
                        id='confirm-close'
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        disabled={loading}
                        className='mt-1'
                    />
                    <label htmlFor='confirm-close' className='text-sm text-gray-600'>
                        I confirm that the inventory count for <strong>{cycleName}</strong> is complete and verified.
                        I understand that this cycle will be locked and cannot be edited unless reopened.
                    </label>
                </div>

                {/* Action Buttons */}
                <div className='flex gap-3 justify-end'>
                    <Button variant='outline' onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleClose}
                        disabled={loading || !closeReason.trim() || !confirmed}
                        className='bg-orange-600 hover:bg-orange-700'
                    >
                        {loading ? 'Closing...' : 'Close & Finalize Cycle'}
                    </Button>
                </div>
            </div>
        </Dialog>
    );
}
