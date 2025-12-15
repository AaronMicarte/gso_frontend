import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getPurchaseRequests,
    getPurchaseRequest,
    createPurchaseRequest,
    updatePurchaseRequest,
    deletePurchaseRequest,
    approvePurchaseRequest,
    rejectPurchaseRequest
} from '@/lib/api/procurement/purchaseRequests';
import { toast } from 'sonner';

export const usePurchaseRequests = (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}) => {
    return useQuery({
        queryKey: ['purchase-requests', params],
        queryFn: () => getPurchaseRequests(params),
        placeholderData: (previousData) => previousData,
        refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    });
};

export const usePurchaseRequest = (id: number) => {
    return useQuery({
        queryKey: ['purchase-request', id],
        queryFn: () => getPurchaseRequest(id),
        enabled: !!id,
    });
};

export const useCreatePurchaseRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createPurchaseRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
            toast.success('Purchase Request created successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to create Purchase Request');
        },
    });
};

export const useUpdatePurchaseRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updatePurchaseRequest(id, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
            queryClient.invalidateQueries({ queryKey: ['purchase-request', variables.id] });
            toast.success('Purchase Request updated successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update Purchase Request');
        },
    });
};

export const useDeletePurchaseRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deletePurchaseRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
            toast.success('Purchase Request deleted successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to delete Purchase Request');
        },
    });
};

export const useApprovePurchaseRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: approvePurchaseRequest,
        onSuccess: (data, id) => {
            queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
            queryClient.invalidateQueries({ queryKey: ['purchase-request', id] });
            toast.success('Purchase Request approved successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to approve Purchase Request');
        },
    });
};

export const useRejectPurchaseRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: rejectPurchaseRequest,
        onSuccess: (data, id) => {
            queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
            queryClient.invalidateQueries({ queryKey: ['purchase-request', id] });
            toast.success('Purchase Request rejected successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to reject Purchase Request');
        },
    });
};
