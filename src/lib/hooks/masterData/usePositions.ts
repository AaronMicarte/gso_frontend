import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getPositions,
    getAllPositions,
    getPosition,
    createPosition,
    updatePosition,
    deletePosition,
    PositionFilters,
} from '@/lib/api/masterData/positions';
import { Position, PositionInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

export const positionKeys = {
    all: ['positions'] as const,
    lists: () => [...positionKeys.all, 'list'] as const,
    list: (filters?: PositionFilters) => [...positionKeys.lists(), filters] as const,
    allPositions: () => [...positionKeys.all, 'all-positions'] as const,
    details: () => [...positionKeys.all, 'detail'] as const,
    detail: (id: number) => [...positionKeys.details(), id] as const,
};

export function usePositions(filters?: PositionFilters) {
    return useQuery({
        queryKey: positionKeys.list(filters),
        queryFn: () => getPositions(filters),
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllPositions() {
    return useQuery({
        queryKey: positionKeys.allPositions(),
        queryFn: getAllPositions,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function usePosition(id: number | null) {
    return useQuery({
        queryKey: id ? positionKeys.detail(id) : ['position-null'],
        queryFn: () => getPosition(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreatePosition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createPosition,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: positionKeys.lists() });
            queryClient.invalidateQueries({ queryKey: positionKeys.allPositions() });
            toast.success('Position created successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to create position';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdatePosition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: PositionInput }) => updatePosition(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: positionKeys.lists() });
            queryClient.invalidateQueries({ queryKey: positionKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: positionKeys.allPositions() });
            toast.success('Position updated successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to update position';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeletePosition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deletePosition,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: positionKeys.lists() });
            queryClient.invalidateQueries({ queryKey: positionKeys.allPositions() });
            toast.success('Position deleted successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to delete position';
            toast.error('Deletion Failed', { description: message });
        },
    });
}
