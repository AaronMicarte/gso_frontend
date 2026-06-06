# RPCPPE/RPCSEP Closure & Reopening - Frontend Implementation Guide

## Overview
Frontend for closing/reopening RPC inventory cycles. Only Administrators can access these features. Cycles become read-only when closed and editable when reopened (max 2 times).

## Components to Build

### 1. Close Cycle Modal (`src/components/features/qr/RpcCloseCycleModal.tsx`)

```typescript
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Lock } from 'lucide-react';
import { useRpcInventoryApi } from '@/hooks/useRpcInventoryApi';

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
  onSuccess: (cycle: any) => void;
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
  const { closeRpcCycle } = useRpcInventoryApi();

  const handleClose = async () => {
    if (!closeReason.trim() || closeReason.length < 10) {
      setError('Closure reason must be at least 10 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await closeRpcCycle(cycleId, closeReason);
      onSuccess(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to close inventory cycle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Lock className='h-5 w-5 text-orange-600' />
            Close & Finalize Inventory Cycle
          </DialogTitle>
          <DialogDescription>
            Once closed, this inventory cycle becomes read-only. All records are locked.
          </DialogDescription>
        </DialogHeader>

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
            <Textarea
              placeholder='Provide a reason for closing this inventory cycle (minimum 10 characters)...'
              value={closeReason}
              onChange={(e) => {
                setCloseReason(e.target.value);
                setError(null);
              }}
              minLength={10}
              maxLength={1000}
              className='h-24 text-sm'
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
              disabled={loading || !closeReason.trim()}
              className='bg-orange-600 hover:bg-orange-700'
            >
              {loading ? 'Closing...' : 'Close & Finalize Cycle'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 2. Reopen Cycle Modal (`src/components/features/qr/RpcReopenCycleModal.tsx`)

```typescript
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AlertCircle, Unlock } from 'lucide-react';
import { useRpcInventoryApi } from '@/hooks/useRpcInventoryApi';

interface RpcReopenCycleModalProps {
  cycleId: number;
  cycleName: string;
  closureInfo: {
    closed_by: string;
    closed_at: string;
    close_reason: string;
    reopen_count: number;
  };
  onClose: () => void;
  onSuccess: (cycle: any) => void;
}

export function RpcReopenCycleModal({
  cycleId,
  cycleName,
  closureInfo,
  onClose,
  onSuccess,
}: RpcReopenCycleModalProps) {
  const [step, setStep] = useState<'confirm' | 'verify'>('confirm');
  const [password, setPassword] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { reopenRpcCycle } = useRpcInventoryApi();

  const handleReopen = async () => {
    if (!password.trim() || !reopenReason.trim() || reopenReason.length < 10) {
      setError('Password and reopen reason (min 10 chars) are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await reopenRpcCycle(cycleId, {
        password,
        reopen_reason: reopenReason,
      });
      onSuccess(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to reopen inventory cycle');
    } finally {
      setLoading(false);
    }
  };

  const isLastReopen = closureInfo.reopen_count === 1;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Unlock className='h-5 w-5 text-blue-600' />
            Reopen Inventory Cycle
          </DialogTitle>
          <DialogDescription>
            Reopening allows modifications. Use with caution.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6'>
          {/* Closure Details */}
          <div className='bg-gray-50 rounded-lg p-4 text-sm'>
            <h3 className='font-semibold text-gray-900 mb-3'>Original Closure Details</h3>
            <div className='space-y-2'>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Closed By:</span>
                <span className='font-medium'>{closureInfo.closed_by}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Closed At:</span>
                <span className='font-medium'>{new Date(closureInfo.closed_at).toLocaleString()}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Times Reopened:</span>
                <span className={`font-medium ${closureInfo.reopen_count >= 2 ? 'text-red-600' : ''}`}>
                  {closureInfo.reopen_count}
                </span>
              </div>
              <div className='pt-2 border-t'>
                <p className='text-gray-600 text-xs'>Original Reason:</p>
                <p className='text-gray-900 italic'>{closureInfo.close_reason}</p>
              </div>
            </div>
          </div>

          {/* Last Reopen Warning */}
          {isLastReopen && (
            <div className='bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3'>
              <AlertCircle className='h-5 w-5 text-red-700 flex-shrink-0 mt-0.5' />
              <div className='text-sm text-red-800'>
                <p className='font-semibold'>Final Reopen Warning</p>
                <p>This is your last allowed reopen. After the next closure, this cycle cannot be reopened.</p>
              </div>
            </div>
          )}

          {/* Password Verification */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Your Password *
            </label>
            <Input
              type='password'
              placeholder='Enter your current password'
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              disabled={loading}
              autoComplete='current-password'
            />
            <p className='text-xs text-gray-500 mt-1'>Required for security verification</p>
          </div>

          {/* Reopen Reason */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Reopening Reason *
            </label>
            <Textarea
              placeholder='Explain why this cycle needs to be reopened (minimum 10 characters)...'
              value={reopenReason}
              onChange={(e) => {
                setReopenReason(e.target.value);
                setError(null);
              }}
              minLength={10}
              maxLength={1000}
              className='h-20 text-sm'
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

          {/* Action Buttons */}
          <div className='flex gap-3 justify-end'>
            <Button variant='outline' onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleReopen}
              disabled={loading || !password.trim() || !reopenReason.trim()}
              className='bg-blue-600 hover:bg-blue-700'
            >
              {loading ? 'Reopening...' : 'Verify & Reopen Cycle'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 3. Cycle Status Display (`src/components/features/qr/RpcCycleStatusBanner.tsx`)

```typescript
'use client';

import React from 'react';
import { Lock, Unlock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RpcCycleStatusBannerProps {
  status: 'active' | 'closed' | 'archived';
  can_reopen?: boolean;
  is_permanently_closed?: boolean;
  closed_by?: string;
  closed_at?: string;
  reopened_by?: string;
  reopened_at?: string;
  reopen_count?: number;
  onCloseClick?: () => void;
  onReopenClick?: () => void;
}

export function RpcCycleStatusBanner({
  status,
  can_reopen,
  is_permanently_closed,
  closed_by,
  closed_at,
  reopened_by,
  reopened_at,
  reopen_count = 0,
  onCloseClick,
  onReopenClick,
}: RpcCycleStatusBannerProps) {
  if (status === 'active') {
    return null;
  }

  if (status === 'closed') {
    return (
      <div className={`rounded-lg p-4 ${is_permanently_closed ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
        <div className='flex items-start justify-between'>
          <div className='flex items-start gap-3'>
            <Lock className={`h-5 w-5 mt-0.5 ${is_permanently_closed ? 'text-red-600' : 'text-orange-600'}`} />
            <div className='text-sm'>
              <p className={`font-semibold ${is_permanently_closed ? 'text-red-900' : 'text-orange-900'}`}>
                {is_permanently_closed
                  ? 'Permanently Closed - No Further Reopens Allowed'
                  : 'Inventory Cycle Closed & Read-Only'}
              </p>
              <p className={is_permanently_closed ? 'text-red-700' : 'text-orange-700'}>
                Closed by <strong>{closed_by}</strong> on{' '}
                {new Date(closed_at || '').toLocaleString()}
              </p>
              {reopened_at && (
                <p className='text-gray-600 text-xs mt-1'>
                  Last reopened by <strong>{reopened_by}</strong> on{' '}
                  {new Date(reopened_at).toLocaleString()} (reopens used: {reopen_count}/2)
                </p>
              )}
            </div>
          </div>
          {can_reopen && (
            <Button
              size='sm'
              variant='outline'
              onClick={onReopenClick}
              className='bg-blue-600 text-white border-0 hover:bg-blue-700'
            >
              <Unlock className='h-4 w-4 mr-1' />
              Reopen
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
```

### 4. API Hook (`src/hooks/useRpcInventoryApi.ts`)

```typescript
import { useCallback } from 'react';
import { apiCall } from '@/lib/api';

export function useRpcInventoryApi() {
  const closeRpcCycle = useCallback(
    async (cycleId: number, closeReason: string) => {
      return apiCall(`/rpc-inventory/cycles/${cycleId}/close`, {
        method: 'POST',
        body: JSON.stringify({ close_reason: closeReason }),
      });
    },
    []
  );

  const reopenRequestRpcCycle = useCallback(
    async (cycleId: number) => {
      return apiCall(`/rpc-inventory/cycles/${cycleId}/reopen-request`, {
        method: 'POST',
      });
    },
    []
  );

  const reopenRpcCycle = useCallback(
    async (cycleId: number, payload: { password: string; reopen_reason: string; otp_code?: string }) => {
      return apiCall(`/rpc-inventory/cycles/${cycleId}/reopen`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    []
  );

  return {
    closeRpcCycle,
    reopenRequestRpcCycle,
    reopenRpcCycle,
  };
}
```

## Integration Points

### In RPC Cycle Details Page
1. Display `RpcCycleStatusBanner` at the top if closed
2. Add "Close Cycle" button (visible only to Admins, only if status='active')
3. Replace scan submission UI with banner if closed (except if reopened)
4. Show "Reopen" button in banner (Admin only, if can_reopen=true)

### In Activity Logs
Add activity types:
- `RPCPPE_CLOSED`: "✓ {user} finalized RPCPPE 2026 for {location}"
- `RPCPPE_REOPENED`: "🔓 {user} reopened RPCPPE 2026 due to {reason}"
- `RPCSEP_CLOSED`: "✓ {user} finalized RPCSEP 2026"
- `RPCSEP_REOPENED`: "🔓 {user} reopened RPCSEP 2026"

### In Dashboard Recent Activities
Same activity types with icons and timestamps

## Error Handling
- 403: Not Administrator
- 409: Cycle already closed / Too many reopens
- 401: Wrong password
- 422: Validation errors (reason too short, etc.)

## Security Considerations
- Password verification required for reopen
- OTP verification optional (can be enabled in config)
- All actions logged to audit trail
- Frontend validation plus backend enforcement
- Read-only UI when cycle closed
