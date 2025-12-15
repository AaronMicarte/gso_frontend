import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import {
    getPurchaseOrders,
    getPurchaseOrder,
    createPurchaseOrder,
    updatePurchaseOrder,
    approvePurchaseOrder,
    rejectPurchaseOrder,
    PurchaseOrderFilters,
} from '@/lib/api/procurement/purchaseOrders';
import type { PaginatedResponse } from '@/types/masterData';
import type { CreatePurchaseOrderPayload, UpdatePurchaseOrderPayload, PurchaseOrder } from '@/types/procurement';
import { toast } from 'sonner';

type ApiError = AxiosError<{ message?: string }>;

export const purchaseOrderKeys = {
    all: ['purchase-orders'] as const,
    lists: () => [...purchaseOrderKeys.all, 'list'] as const,
    list: (filters?: PurchaseOrderFilters) => [...purchaseOrderKeys.lists(), filters] as const,
    details: () => [...purchaseOrderKeys.all, 'detail'] as const,
    detail: (id: number) => [...purchaseOrderKeys.details(), id] as const,
};

export function usePurchaseOrders(filters?: PurchaseOrderFilters) {
    return useQuery<PaginatedResponse<PurchaseOrder>, ApiError>({
        queryKey: purchaseOrderKeys.list(filters),
        queryFn: () => getPurchaseOrders(filters),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function usePurchaseOrder(id: number | null) {
    return useQuery<PurchaseOrder, ApiError>({
        queryKey: id ? purchaseOrderKeys.detail(id) : ['purchase-order-null'],
        queryFn: () => getPurchaseOrder(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreatePurchaseOrder() {
    const queryClient = useQueryClient();
    return useMutation<PurchaseOrder, ApiError, CreatePurchaseOrderPayload>({
        mutationFn: (data) => createPurchaseOrder(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
            toast.success('Purchase Order created successfully');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to create Purchase Order');
        },
    });
}

export function useUpdatePurchaseOrder() {
    const queryClient = useQueryClient();
    return useMutation<PurchaseOrder, ApiError, { id: number; data: UpdatePurchaseOrderPayload }>({
        mutationFn: ({ id, data }) =>
            updatePurchaseOrder(id, data),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
            queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
            toast.success('Purchase Order updated successfully');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to update Purchase Order');
        },
    });
}

export function useApprovePurchaseOrder() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, number>({
        mutationFn: (id) => approvePurchaseOrder(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
            queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
            toast.success('Purchase Order approved successfully');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to approve Purchase Order');
        },
    });
}

export function useRejectPurchaseOrder() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, number>({
        mutationFn: (id) => rejectPurchaseOrder(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
            queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
            toast.success('Purchase Order rejected successfully');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to reject Purchase Order');
        },
    });
}
