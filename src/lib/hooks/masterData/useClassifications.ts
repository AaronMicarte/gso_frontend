import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getClassifications,
    getAllClassifications,
    getClassification,
    createClassification,
    updateClassification,
    deleteClassification,
    ClassificationFilters,
} from '@/lib/api/masterData/classifications';
import { Classification, ClassificationInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

export const classificationKeys = {
    all: ['classifications'] as const,
    lists: () => [...classificationKeys.all, 'list'] as const,
    list: (filters?: ClassificationFilters) => [...classificationKeys.lists(), filters] as const,
    allClassifications: () => [...classificationKeys.all, 'all-classifications'] as const,
    byCategory: (categoryId: number) => [...classificationKeys.all, 'by-category', categoryId] as const,
    details: () => [...classificationKeys.all, 'detail'] as const,
    detail: (id: number) => [...classificationKeys.details(), id] as const,
};

export function useClassifications(filters?: ClassificationFilters) {
    return useQuery({
        queryKey: classificationKeys.list(filters),
        queryFn: () => getClassifications(filters),
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllClassifications(categoryId?: number) {
    return useQuery({
        queryKey: categoryId ? classificationKeys.byCategory(categoryId) : classificationKeys.allClassifications(),
        queryFn: () => getAllClassifications(categoryId),
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useClassification(id: number | null) {
    return useQuery({
        queryKey: id ? classificationKeys.detail(id) : ['classification-null'],
        queryFn: () => getClassification(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateClassification() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createClassification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: classificationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: classificationKeys.allClassifications() });
            toast.success('Classification created successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to create classification';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdateClassification() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: ClassificationInput }) => updateClassification(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: classificationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: classificationKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: classificationKeys.allClassifications() });
            toast.success('Classification updated successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to update classification';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeleteClassification() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteClassification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: classificationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: classificationKeys.allClassifications() });
            toast.success('Classification deleted successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to delete classification';
            toast.error('Deletion Failed', { description: message });
        },
    });
}
