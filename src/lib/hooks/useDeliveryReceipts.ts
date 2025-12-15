import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getDeliveryReceipts,
    getDeliveryReceipt,
    createDeliveryReceipt,
    updateDeliveryReceipt,
    approveDeliveryReceipt,
    rejectDeliveryReceipt,
    DeliveryReceiptFilters,
} from '@/lib/api/procurement/deliveryReceipts';
import { CreateDeliveryReceiptPayload, UpdateDeliveryReceiptPayload } from '@/types/procurement';
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
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
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
        mutationFn: (data: CreateDeliveryReceiptPayload) => createDeliveryReceipt(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });
            toast.success('Delivery Receipt created successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to create Delivery Receipt');
        },
    });
}

export function useUpdateDeliveryReceipt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateDeliveryReceiptPayload }) =>
            updateDeliveryReceipt(id, data),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });
            queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.detail(id) });
            toast.success('Delivery Receipt updated successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update Delivery Receipt');
        },
    });
}

export function useApproveDeliveryReceipt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => approveDeliveryReceipt(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });
            queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.detail(id) });
            toast.success('Delivery Receipt approved successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to approve Delivery Receipt');
        },
    });
}

export function useRejectDeliveryReceipt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => rejectDeliveryReceipt(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });
            queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.detail(id) });
            toast.success('Delivery Receipt rejected successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to reject Delivery Receipt');
        },
    });
}