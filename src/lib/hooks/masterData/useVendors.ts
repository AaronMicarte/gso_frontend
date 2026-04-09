import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
    VendorFilters,
    createVendor,
    deleteVendor,
    getAllVendors,
    getVendor,
    getVendors,
    updateVendor,
} from '@/lib/api/masterData/vendors';
import { ApiError } from '@/types/api';
import { VendorInput } from '@/types/masterData';

export const vendorKeys = {
    all: ['vendors'] as const,
    lists: () => [...vendorKeys.all, 'list'] as const,
    list: (filters?: VendorFilters) => [...vendorKeys.lists(), filters] as const,
    allVendors: () => [...vendorKeys.all, 'all-vendors'] as const,
    details: () => [...vendorKeys.all, 'detail'] as const,
    detail: (id: number) => [...vendorKeys.details(), id] as const,
};

export function useVendors(filters?: VendorFilters) {
    return useQuery({
        queryKey: vendorKeys.list(filters),
        queryFn: () => getVendors(filters),
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllVendors() {
    return useQuery({
        queryKey: vendorKeys.allVendors(),
        queryFn: getAllVendors,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useVendor(id: number | null) {
    return useQuery({
        queryKey: id ? vendorKeys.detail(id) : ['vendor-null'],
        queryFn: () => getVendor(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateVendor() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createVendor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: vendorKeys.lists() });
            queryClient.invalidateQueries({ queryKey: vendorKeys.allVendors() });
            toast.success('Vendor created successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to create vendor';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdateVendor() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: VendorInput }) => updateVendor(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: vendorKeys.lists() });
            queryClient.invalidateQueries({ queryKey: vendorKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: vendorKeys.allVendors() });
            toast.success('Vendor updated successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to update vendor';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeleteVendor() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteVendor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: vendorKeys.lists() });
            queryClient.invalidateQueries({ queryKey: vendorKeys.allVendors() });
            toast.success('Vendor deleted successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to delete vendor';
            toast.error('Deletion Failed', { description: message });
        },
    });
}
