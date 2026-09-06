import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
    getClosureSummary as apiGetClosureSummary,
    closeRpcCycle as apiCloseRpcCycle,
    getReopenRequest as apiGetReopenRequest,
    reopenRpcCycle as apiReopenRpcCycle,
} from '@/lib/api/rpcInventory';

export interface ClosureSummary {
    total_expected: number;
    total_scanned: number;
    total_scans_recorded?: number;
    missing_count: number;
    excess_count?: number;
    serviceable_count?: number;
    unserviceable_count?: number;
    completed_locations: number;
    pending_locations: number;
    completed_departments?: number;
    pending_departments?: number;
    total_departments?: number;
    progress_percentage?: number;
    last_scan_time: string | null;
    reopen_count?: number;
    max_reopens?: number;
    can_reopen?: boolean;
}

export interface ReopenRequestResponse {
    status: string;
    closed_at: string;
    close_reason: string;
    close_by_user: {
        UserID: number;
        UserName: string;
    };
    reopen_count: number;
}

export function useRpcCycleActions() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getClosureSummary = useCallback(
        async (cycleId: number): Promise<ClosureSummary> => {
            setLoading(true);
            try {
                return await apiGetClosureSummary(cycleId);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to fetch closure summary';
                setError(message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    const closeCycle = useCallback(
        async (cycleId: number, reason: string): Promise<unknown> => {
            setLoading(true);
            setError(null);

            try {
                const result = await apiCloseRpcCycle(cycleId, reason);
                toast.success('Inventory cycle closed successfully');
                return result;
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to close cycle';
                setError(message);
                toast.error(message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    const getReopenRequest = useCallback(
        async (cycleId: number): Promise<ReopenRequestResponse> => {
            setLoading(true);
            try {
                return await apiGetReopenRequest(cycleId);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to get reopen request';
                setError(message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    const reopenCycle = useCallback(
        async (
            cycleId: number,
            payload: { password: string; reason: string }
        ): Promise<unknown> => {
            setLoading(true);
            setError(null);

            try {
                const result = await apiReopenRpcCycle(cycleId, payload);
                toast.success('Inventory cycle reopened successfully');
                return result;
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to reopen cycle';
                setError(message);
                toast.error(message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    return {
        loading,
        error,
        getClosureSummary,
        closeCycle,
        getReopenRequest,
        reopenCycle,
    };
}
