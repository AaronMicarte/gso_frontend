import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getSuppliers,
    getAllSuppliers,
    getSupplier,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    SupplierFilters,
} from '@/lib/api/masterData/suppliers';
import { Supplier, SupplierInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

export const supplierKeys = {
    all: ['suppliers'] as const,
    lists: () => [...supplierKeys.all, 'list'] as const,
    list: (filters?: SupplierFilters) => [...supplierKeys.lists(), filters] as const,
    allSuppliers: () => [...supplierKeys.all, 'all-suppliers'] as const,
    details: () => [...supplierKeys.all, 'detail'] as const,
    detail: (id: number) => [...supplierKeys.details(), id] as const,
};

export function useSuppliers(filters?: SupplierFilters) {
    return useQuery({
        queryKey: supplierKeys.list(filters),
        queryFn: () => getSuppliers(filters),
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllSuppliers() {
    return useQuery({
        queryKey: supplierKeys.allSuppliers(),
        queryFn: getAllSuppliers,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useSupplier(id: number | null) {
    return useQuery({
        queryKey: id ? supplierKeys.detail(id) : ['supplier-null'],
        queryFn: () => getSupplier(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createSupplier,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
            queryClient.invalidateQueries({ queryKey: supplierKeys.allSuppliers() });
            toast.success('Supplier created successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to create supplier';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdateSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: SupplierInput }) => updateSupplier(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
            queryClient.invalidateQueries({ queryKey: supplierKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: supplierKeys.allSuppliers() });
            toast.success('Supplier updated successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to update supplier';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeleteSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteSupplier,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
            queryClient.invalidateQueries({ queryKey: supplierKeys.allSuppliers() });
            toast.success('Supplier deleted successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to delete supplier';
            toast.error('Deletion Failed', { description: message });
        },
    });
}
