import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getEndUsers,
    getAllEndUsers,
    getEndUser,
    createEndUser,
    updateEndUser,
    deleteEndUser,
    EndUserFilters,
} from '@/lib/api/masterData/endUsers';
import { EndUser, EndUserInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

export const endUserKeys = {
    all: ['end-users'] as const,
    lists: () => [...endUserKeys.all, 'list'] as const,
    list: (filters?: EndUserFilters) => [...endUserKeys.lists(), filters] as const,
    allEndUsers: () => [...endUserKeys.all, 'all-end-users'] as const,
    details: () => [...endUserKeys.all, 'detail'] as const,
    detail: (id: number) => [...endUserKeys.details(), id] as const,
};

export function useEndUsers(filters?: EndUserFilters) {
    return useQuery({
        queryKey: endUserKeys.list(filters),
        queryFn: () => getEndUsers(filters),
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllEndUsers() {
    return useQuery({
        queryKey: endUserKeys.allEndUsers(),
        queryFn: getAllEndUsers,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useEndUser(id: number | null) {
    return useQuery({
        queryKey: id ? endUserKeys.detail(id) : ['end-user-null'],
        queryFn: () => getEndUser(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateEndUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createEndUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: endUserKeys.lists() });
            queryClient.invalidateQueries({ queryKey: endUserKeys.allEndUsers() });
            toast.success('End user created successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to create end user';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdateEndUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: EndUserInput }) => updateEndUser(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: endUserKeys.lists() });
            queryClient.invalidateQueries({ queryKey: endUserKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: endUserKeys.allEndUsers() });
            toast.success('End user updated successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to update end user';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeleteEndUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteEndUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: endUserKeys.lists() });
            queryClient.invalidateQueries({ queryKey: endUserKeys.allEndUsers() });
            toast.success('End user deleted successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to delete end user';
            toast.error('Deletion Failed', { description: message });
        },
    });
}
