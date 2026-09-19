import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getDeliveryReceipts,
    getDeliveryReceipt,
    createDeliveryReceipt,
    updateDeliveryReceipt,
    deleteDeliveryReceipt,
    addDeliveryReceiptItems,
    finalizeDeliveryReceipt,
    DeliveryReceiptFilters,
} from '@/lib/api/deliveryReceipts';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

export const deliveryReceiptKeys = {
    all: ['delivery-receipts'] as const,
    lists: () => [...deliveryReceiptKeys.all, 'list'] as const,
    list: (filters?: DeliveryReceiptFilters) => [...deliveryReceiptKeys.lists(), filters] as const,
    details: () => [...deliveryReceiptKeys.all, 'detail'] as const,
    detail: (id: number) => [...deliveryReceiptKeys.details(), id] as const,
};

export function useDeliveryReceipts(filters?: DeliveryReceiptFilters) {
    return useQuery({
        queryKey: deliveryReceiptKeys.list(filters),
        queryFn: () => getDeliveryReceipts(filters),
        placeholderData: keepPreviousData,
        staleTime: 0,
        gcTime: 10 * 60 * 1000,
        refetchOnMount: 'always',

    });
}

export function useDeliveryReceipt(id: number | null) {
    return useQuery({
        queryKey: id ? deliveryReceiptKeys.detail(id) : ['delivery-receipt-null'],
        queryFn: () => getDeliveryReceipt(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateDeliveryReceipt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: FormData) => createDeliveryReceipt(data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });
        },
        onError: (error: Error) => {
            toast.error((error as ApiError).response?.data?.message || 'Failed to create Delivery Receipt');
        },
    });
}

export function useUpdateDeliveryReceipt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: FormData }) =>
            updateDeliveryReceipt(id, data),
        onSuccess: async (_, { id }) => {
            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });
            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.detail(id) });
        },
        onError: (error: Error) => {
            toast.error((error as ApiError).response?.data?.message || 'Failed to update Delivery Receipt');
        },
    });
}

export function useDeleteDeliveryReceipt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteDeliveryReceipt(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });
        },
        onError: (error: Error) => {
            toast.error((error as ApiError).response?.data?.message || 'Failed to delete Delivery Receipt');
        },
    });
}

export function useAddDeliveryReceiptItems() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, details, finalize_dr }: { id: number; details: Record<string, unknown>[]; finalize_dr?: boolean }) =>
            addDeliveryReceiptItems(id, details, finalize_dr),
        onSuccess: async (_, { id }) => {
            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });
            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.detail(id) });
        },
        onError: (error: Error) => {
            toast.error((error as ApiError).response?.data?.message || 'Failed to add items to Delivery Receipt');
        },
    });
}

export function useFinalizeDeliveryReceipt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => finalizeDeliveryReceipt(id),
        onSuccess: async (_, id) => {
            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });
            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.detail(id) });
        },
        onError: (error: Error) => {
            toast.error((error as ApiError).response?.data?.message || 'Failed to finalize Delivery Receipt');
        },
    });
}