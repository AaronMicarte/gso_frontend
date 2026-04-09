import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getConditions,
    getAllConditions,
    getCondition,
    createCondition,
    updateCondition,
    deleteCondition,
    ConditionFilters,
} from '@/lib/api/masterData/conditions';
import { Condition, ConditionInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

export const conditionKeys = {
    all: ['conditions'] as const,
    lists: () => [...conditionKeys.all, 'list'] as const,
    list: (filters?: ConditionFilters) => [...conditionKeys.lists(), filters] as const,
    allConditions: () => [...conditionKeys.all, 'all-conditions'] as const,
    details: () => [...conditionKeys.all, 'detail'] as const,
    detail: (id: number) => [...conditionKeys.details(), id] as const,
};

export function useConditions(filters?: ConditionFilters) {
    return useQuery({
        queryKey: conditionKeys.list(filters),
        queryFn: () => getConditions(filters),
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllConditions() {
    return useQuery({
        queryKey: conditionKeys.allConditions(),
        queryFn: getAllConditions,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useCondition(id: number | null) {
    return useQuery({
        queryKey: id ? conditionKeys.detail(id) : ['condition-null'],
        queryFn: () => getCondition(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateCondition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createCondition,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: conditionKeys.lists() });
            queryClient.invalidateQueries({ queryKey: conditionKeys.allConditions() });
            toast.success('Condition created successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to create condition';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdateCondition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: ConditionInput }) => updateCondition(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: conditionKeys.lists() });
            queryClient.invalidateQueries({ queryKey: conditionKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: conditionKeys.allConditions() });
            toast.success('Condition updated successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to update condition';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeleteCondition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteCondition,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: conditionKeys.lists() });
            queryClient.invalidateQueries({ queryKey: conditionKeys.allConditions() });
            toast.success('Condition deleted successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to delete condition';
            toast.error('Deletion Failed', { description: message });
        },
    });
}