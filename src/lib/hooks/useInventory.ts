import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInventories, getInventory, postIssuance, postGenerateQr, updateInventoryDetail, getPendingIngestion, ingestFromIar, InventoryListResponse, InventoryResponse, PendingIar, getAllInventoryItems, InventoryItemsListResponse, getInventoryDetailHistory, InventoryHistoryResponse } from '@/lib/api/inventory';

export const useInventories = (options?: { page?: number; per_page?: number; search?: string; sort_by?: 'date' | 'inventory_number'; sort_dir?: 'asc' | 'desc' }) => {
    return useQuery<InventoryListResponse>({
        queryKey: ['inventories', options],
        queryFn: () => getInventories(options),
        placeholderData: keepPreviousData,
    });
};

export const useAllInventoryItems = (options?: { page?: number; per_page?: number; search?: string; property_status_id?: number; property_type_id?: number }) => {
    return useQuery<InventoryItemsListResponse>({
        queryKey: ['all-inventory-items', options],
        queryFn: () => getAllInventoryItems(options),
        placeholderData: keepPreviousData,
    });
};

export const usePendingIngestion = () => {
    return useQuery<PendingIar[]>({
        queryKey: ['pending-ingestion'],
        queryFn: getPendingIngestion,
    });
};

export const useIngestFromIar = () => {
    const qc = useQueryClient();
    return useMutation<unknown, Error, number>({
        mutationFn: (iarId: number) => ingestFromIar(iarId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inventories'] });
            qc.invalidateQueries({ queryKey: ['pending-ingestion'] });
        },
    });
};

export const useInventory = (id: number) => {
    return useQuery<InventoryResponse>({
        queryKey: ['inventory', id],
        queryFn: () => getInventory(id),
        enabled: !!id,
    });
};

export const useIssuance = () => {
    const qc = useQueryClient();
    return useMutation<unknown, Error, Record<string, unknown>>({
        mutationFn: (payload: Record<string, unknown>) => postIssuance(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inventories'] });
            qc.invalidateQueries({ queryKey: ['inventory'] });
        },
    });
};

export const useGenerateQr = () => {
    const qc = useQueryClient();
    return useMutation<unknown, Error, { id: number; force?: boolean }>({
        mutationFn: ({ id, force }: { id: number; force?: boolean }) => postGenerateQr(id, !!force),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inventory'] });
        },
    });
};

export const useUpdateInventoryDetail = () => {
    const qc = useQueryClient();
    return useMutation<unknown, Error, { id: number; data: { Description?: string } }>({
        mutationFn: ({ id, data }) => updateInventoryDetail(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['inventories'] });
            qc.invalidateQueries({ queryKey: ['inventory'] });
        },
    });
};

export const useInventoryDetailHistory = (id: number, enabled = true) => {
    return useQuery<InventoryHistoryResponse>({
        queryKey: ['inventory-detail-history', id],
        queryFn: () => getInventoryDetailHistory(id),
        enabled: !!id && enabled,
    });
};
