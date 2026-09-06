'use client';

import React, { ChangeEvent, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { AlertCircle, AlertTriangle, Building2, Eye, EyeOff, Lock, Loader2, ShieldAlert } from 'lucide-react';
import { closeRpcCycle } from '@/lib/api/rpcInventory';
import { ClosureSummary } from '@/hooks/useRpcCycleActions';

interface RpcCloseCycleModalProps {
    cycleId: number;
    cycleName: string;
    summary: ClosureSummary;
    reopenCount?: number;
    onClose: () => void;
    onSuccess: (cycle: unknown) => void;
}

export function RpcCloseCycleModal({
    cycleId,
    cycleName,
    summary,
    reopenCount,
    onClose,
    onSuccess,
}: RpcCloseCycleModalProps) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [closeReason, setCloseReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);

    const totalExpected = summary.total_expected ?? 0;
    const totalScanned = summary.total_scanned ?? 0;
    const missingCount = summary.missing_count ?? Math.max(0, totalExpected - totalScanned);
    const serviceableCount = summary.serviceable_count ?? 0;
    const unserviceableCount = summary.unserviceable_count ?? 0;

    const completedDepts = summary.completed_departments ?? summary.completed_locations ?? 0;
    const pendingDepts = summary.pending_departments ?? summary.pending_locations ?? 0;
    const totalDepts = summary.total_departments ?? (completedDepts + pendingDepts);

    const effectiveReopenCount = reopenCount ?? summary.reopen_count ?? 0;
    const isLastChance = effectiveReopenCount === 1;
    const isPermanentClosure = effectiveReopenCount >= 2;

    const progressPercentage = summary.progress_percentage !== undefined
        ? summary.progress_percentage
        : (totalExpected > 0 ? Math.min(100, Math.round((totalScanned / totalExpected) * 100)) : (totalScanned > 0 ? 100 : 0));

    const formattedLastScan = summary.last_scan_time && totalScanned > 0
        ? new Date(summary.last_scan_time).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })
        : 'No scans recorded';

    const handleClose = async () => {
        if (!password.trim()) {
            setError('Administrator password is required to close this inventory cycle.');
            return;
        }

        if (!closeReason.trim() || closeReason.trim().length < 10) {
            setError('Closure reason must be at least 10 characters.');
            return;
        }

        if (!confirmed) {
            setError('Please confirm that the inventory count is verified before closing.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await closeRpcCycle(cycleId, {
                reason: closeReason.trim(),
                password: password.trim(),
            });
            onSuccess(result);
        } catch (err: unknown) {
            const resp = err && typeof err === 'object' && 'response' in err ? (err as { response?: unknown }).response : null;
            if (resp && typeof resp === 'object' && resp !== null && 'data' in (resp as Record<string, unknown>)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = (resp as any).data;
                if (data.message) {
                    setError(String(data.message));
                } else {
                    setError('Failed to close inventory cycle.');
                }
            } else {
                const message = err instanceof Error ? err.message : 'Failed to close inventory cycle';
                setError(message);
            }
        } finally {
            setLoading(false);
        }
    };

    const isSubmitDisabled = loading || !password.trim() || closeReason.trim().length < 10 || !confirmed;

    return (
        <Dialog
            open
            onOpenChange={onClose}
            title="Close & Finalize Inventory Cycle"
            description="Once finalized, this cycle becomes read-only and all scan records are locked."
            hideFooter
            contentClassName="max-w-2xl"
        >
            <div className="space-y-4 text-slate-800">
                {/* Cycle Banner */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-slate-500" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target Cycle:</span>
                        <span className="font-semibold text-slate-900">{cycleName || `Cycle #${cycleId}`}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                        isPermanentClosure
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isLastChance
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                        {isPermanentClosure ? 'Final Closure (Lock)' : isLastChance ? '1 Reopen Away' : 'Closing'}
                    </span>
                </div>

                {/* Reopen History Tracker */}
                {effectiveReopenCount === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                                Reopen Status
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                                0 of 2 reopens used
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            This cycle has never been reopened. If closed, it can still be reopened <strong>up to 2 times</strong> with admin authorization if revisions are required.
                        </p>
                    </div>
                )}

                {isLastChance && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                Caution: 1 Reopen Away from Permanent Lock!
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-800 border border-amber-300">
                                1 of 2 reopens used (Only 1 left)
                            </span>
                        </div>
                        <p className="text-xs text-amber-800 leading-relaxed">
                            This cycle was previously reopened <strong>1 time</strong>. If you close it now, it can only be reopened <strong>ONE MORE TIME</strong> before being permanently locked forever!
                        </p>
                    </div>
                )}

                {isPermanentClosure && (
                    <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-rose-900 flex items-center gap-1.5">
                                <ShieldAlert className="w-4 h-4 text-rose-600" />
                                FINAL CLOSURE: Permanent Lock Ahead
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-200 text-rose-900 border border-rose-300">
                                2 of 2 reopens used (LIMIT REACHED)
                            </span>
                        </div>
                        <p className="text-xs text-rose-800 leading-relaxed">
                            <strong>ATTENTION:</strong> This cycle has already used all allowed reopen attempts (2/2). Closing it now will <strong>PERMANENTLY LOCK</strong> it. It <strong>CANNOT BE REOPENED AGAIN</strong> by anyone.
                        </p>
                    </div>
                )}

                {/* Progress & Summary Metrics */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">Physical Inventory Summary</div>
                        <div className="text-xs font-medium text-slate-500">
                            {progressPercentage}% Completed ({totalScanned} / {totalExpected} assets)
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                            className={`h-2.5 rounded-full transition-all duration-300 ${
                                progressPercentage >= 100 ? 'bg-emerald-600' : progressPercentage >= 70 ? 'bg-blue-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                        />
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3">
                            <div className="text-xs font-medium text-slate-500">Expected Assets</div>
                            <div className="text-lg font-bold text-slate-900 mt-0.5">{totalExpected}</div>
                        </div>

                        <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3">
                            <div className="text-xs font-medium text-slate-500">Scanned Assets</div>
                            <div className="text-lg font-bold text-emerald-600 mt-0.5">{totalScanned}</div>
                        </div>

                        <div className={`rounded-lg border p-3 ${
                            missingCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200/80 text-slate-900'
                        }`}>
                            <div className={`text-xs font-medium ${missingCount > 0 ? 'text-rose-600' : 'text-slate-500'}`}>Missing Assets</div>
                            <div className={`text-lg font-bold mt-0.5 ${missingCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                                {missingCount}
                            </div>
                        </div>

                        <div className="rounded-lg bg-emerald-50/60 border border-emerald-200/70 p-3">
                            <div className="text-xs font-medium text-emerald-700">Serviceable Count</div>
                            <div className="text-lg font-bold text-emerald-800 mt-0.5">{serviceableCount}</div>
                        </div>

                        <div className="rounded-lg bg-rose-50/60 border border-rose-200/70 p-3">
                            <div className="text-xs font-medium text-rose-700">Unserviceable Count</div>
                            <div className="text-lg font-bold text-rose-800 mt-0.5">{unserviceableCount}</div>
                        </div>

                        <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3">
                            <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                Completed Offices
                            </div>
                            <div className="text-lg font-bold text-slate-900 mt-0.5">
                                {completedDepts} <span className="text-xs font-normal text-slate-500">/ {totalDepts}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Last Scan Recorded:</span>
                        <span className="font-medium text-slate-700">{formattedLastScan}</span>
                    </div>
                </div>

                {/* Missing Assets Warning Banner */}
                {missingCount > 0 && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-semibold">Unscanned Assets Warning:</span> There are{' '}
                            <strong>{missingCount} expected assets</strong> that were not scanned. Closing this cycle now will record them as missing in the final inventory report.
                        </div>
                    </div>
                )}

                {/* Administrator Password */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="admin-password" className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                            Administrator Password <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-xs text-slate-500">Required to authorize closure</span>
                    </div>
                    <div className="relative">
                        <input
                            id="admin-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter administrator password..."
                            value={password}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                setPassword(e.target.value);
                                if (error) setError(null);
                            }}
                            disabled={loading}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                            tabIndex={-1}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {/* Closure Reason Input */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="close-reason" className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                            Closure Reason <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-xs text-slate-500">
                            {closeReason.length} / 1000 characters (min. 10)
                        </span>
                    </div>
                    <textarea
                        id="close-reason"
                        placeholder="State reason for cycle closure (e.g., Annual physical count completed and verified across all departments)..."
                        value={closeReason}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                            setCloseReason(e.target.value);
                            if (error) setError(null);
                        }}
                        minLength={10}
                        maxLength={1000}
                        rows={3}
                        disabled={loading}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50"
                    />
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Confirmation Checkbox */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                            disabled={loading}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                        />
                        <span className="text-xs text-slate-700 leading-relaxed">
                            I confirm that the physical inventory count for <strong>{cycleName}</strong> is complete and verified. I acknowledge that {isPermanentClosure ? 'this cycle will be PERMANENTLY LOCKED and cannot be reopened again' : 'all records will become read-only upon closure'}.
                        </span>
                    </label>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitDisabled}
                        className={`px-4 py-2 text-sm text-white disabled:opacity-50 flex items-center gap-1.5 shadow-sm ${
                            isPermanentClosure
                                ? 'bg-rose-600 hover:bg-rose-700'
                                : 'bg-orange-600 hover:bg-orange-700'
                        }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Closing Cycle...</span>
                            </>
                        ) : (
                            <>
                                <Lock className="w-4 h-4" />
                                <span>{isPermanentClosure ? 'Permanently Close Cycle' : 'Close & Finalize Cycle'}</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Dialog>
    );
}
