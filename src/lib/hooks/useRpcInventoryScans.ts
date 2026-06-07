import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRpcInventoryCycleScans } from '@/lib/api/rpcInventory';
import type { RpcInventoryScansPaginated } from '@/types/rpcInventory';

export const rpcInventoryScanKeys = {
    all: ['rpc-inventory-scans'] as const,
    lists: () => [...rpcInventoryScanKeys.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...rpcInventoryScanKeys.lists(), filters] as const,
};

export function useRpcInventoryScans(filters?: { cycleId?: number | null; search?: string; type?: string; per_page?: number; page?: number }) {
    const queryKey = rpcInventoryScanKeys.list(filters);

    return useQuery({
        queryKey,
        queryFn: () => {
            const { cycleId, ...params } = filters ?? {};
            // If no cycleId provided, return empty result to avoid calling API with invalid id
            if (cycleId == null) {
                const empty: RpcInventoryScansPaginated = {
                    data: [],
                    current_page: 1,
                    last_page: 1,
                    per_page: 100,
                    total: 0,
                };
                return Promise.resolve(empty);
            }
            // Backend API expects cycleId as first arg and other params as second
            return getRpcInventoryCycleScans(cycleId, params as Record<string, unknown>);
        },
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}
