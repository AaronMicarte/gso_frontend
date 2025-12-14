import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getDisposalMethods,
    getAllDisposalMethods,
    getDisposalMethod,
    createDisposalMethod,
    updateDisposalMethod,
    deleteDisposalMethod,
    DisposalMethodFilters,
} from '@/lib/api/masterData/disposalMethods';
import { DisposalMethod, DisposalMethodInput } from '@/types/masterData';
import { toast } from 'sonner';

export const disposalMethodKeys = {
    all: ['disposal-methods'] as const,
    lists: () => [...disposalMethodKeys.all, 'list'] as const,
    list: (filters?: DisposalMethodFilters) => [...disposalMethodKeys.lists(), filters] as const,
    allDisposalMethods: () => [...disposalMethodKeys.all, 'all-disposal-methods'] as const,
    details: () => [...disposalMethodKeys.all, 'detail'] as const,
    detail: (id: number) => [...disposalMethodKeys.details(), id] as const,
};

export function useDisposalMethods(filters?: DisposalMethodFilters) {
    return useQuery({
        queryKey: disposalMethodKeys.list(filters),
        queryFn: () => getDisposalMethods(filters),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllDisposalMethods() {
    return useQuery({
        queryKey: disposalMethodKeys.allDisposalMethods(),
        queryFn: getAllDisposalMethods,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useDisposalMethod(id: number | null) {
    return useQuery({
        queryKey: id ? disposalMethodKeys.detail(id) : ['disposal-method-null'],
        queryFn: () => getDisposalMethod(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateDisposalMethod() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createDisposalMethod,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: disposalMethodKeys.lists() });
            queryClient.invalidateQueries({ queryKey: disposalMethodKeys.allDisposalMethods() });
            toast.success('Disposal method created successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to create disposal method';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdateDisposalMethod() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: DisposalMethodInput }) => updateDisposalMethod(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: disposalMethodKeys.lists() });
            queryClient.invalidateQueries({ queryKey: disposalMethodKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: disposalMethodKeys.allDisposalMethods() });
            toast.success('Disposal method updated successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to update disposal method';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeleteDisposalMethod() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteDisposalMethod,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: disposalMethodKeys.lists() });
            queryClient.invalidateQueries({ queryKey: disposalMethodKeys.allDisposalMethods() });
            toast.success('Disposal method deleted successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to delete disposal method';
            toast.error('Deletion Failed', { description: message });
        },
    });
}