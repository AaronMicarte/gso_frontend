import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getUnitsOfMeasure,
    getAllUnitsOfMeasure,
    getUnitOfMeasure,
    createUnitOfMeasure,
    updateUnitOfMeasure,
    deleteUnitOfMeasure,
    UnitOfMeasureFilters,
} from '@/lib/api/masterData/unitsOfMeasure';
import { UnitOfMeasure, UnitOfMeasureInput } from '@/types/masterData';
import { toast } from 'sonner';

export const unitOfMeasureKeys = {
    all: ['units-of-measure'] as const,
    lists: () => [...unitOfMeasureKeys.all, 'list'] as const,
    list: (filters?: UnitOfMeasureFilters) => [...unitOfMeasureKeys.lists(), filters] as const,
    allUnitsOfMeasure: () => [...unitOfMeasureKeys.all, 'all-units-of-measure'] as const,
    details: () => [...unitOfMeasureKeys.all, 'detail'] as const,
    detail: (id: number) => [...unitOfMeasureKeys.details(), id] as const,
};

export function useUnitsOfMeasure(filters?: UnitOfMeasureFilters) {
    return useQuery({
        queryKey: unitOfMeasureKeys.list(filters),
        queryFn: () => getUnitsOfMeasure(filters),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllUnitsOfMeasure() {
    return useQuery({
        queryKey: unitOfMeasureKeys.allUnitsOfMeasure(),
        queryFn: getAllUnitsOfMeasure,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useUnitOfMeasure(id: number | null) {
    return useQuery({
        queryKey: id ? unitOfMeasureKeys.detail(id) : ['unit-of-measure-null'],
        queryFn: () => getUnitOfMeasure(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateUnitOfMeasure() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createUnitOfMeasure,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: unitOfMeasureKeys.all });
            toast.success('Unit of measure created successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to create unit of measure');
        },
    });
}

export function useUpdateUnitOfMeasure() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UnitOfMeasureInput }) => updateUnitOfMeasure(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: unitOfMeasureKeys.all });
            toast.success('Unit of measure updated successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update unit of measure');
        },
    });
}

export function useDeleteUnitOfMeasure() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteUnitOfMeasure,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: unitOfMeasureKeys.all });
            toast.success('Unit of measure deleted successfully');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to delete unit of measure');
        },
    });
}