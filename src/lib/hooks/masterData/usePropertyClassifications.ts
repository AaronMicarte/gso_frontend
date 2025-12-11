import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getPropertyClassifications,
    getAllPropertyClassifications,
    getPropertyClassification,
    createPropertyClassification,
    updatePropertyClassification,
    deletePropertyClassification,
    PropertyClassificationFilters,
} from '@/lib/api/masterData/propertyClassifications';
import { PropertyClassification, PropertyClassificationInput } from '@/types/masterData';
import { toast } from 'sonner';

export const propertyClassificationKeys = {
    all: ['property-classifications'] as const,
    lists: () => [...propertyClassificationKeys.all, 'list'] as const,
    list: (filters?: PropertyClassificationFilters) => [...propertyClassificationKeys.lists(), filters] as const,
    allPropertyClassifications: () => [...propertyClassificationKeys.all, 'all-property-classifications'] as const,
    details: () => [...propertyClassificationKeys.all, 'detail'] as const,
    detail: (id: number) => [...propertyClassificationKeys.details(), id] as const,
};

export function usePropertyClassifications(filters?: PropertyClassificationFilters) {
    return useQuery({
        queryKey: propertyClassificationKeys.list(filters),
        queryFn: () => getPropertyClassifications(filters),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllPropertyClassifications() {
    return useQuery({
        queryKey: propertyClassificationKeys.allPropertyClassifications(),
        queryFn: getAllPropertyClassifications,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function usePropertyClassification(id: number | null) {
    return useQuery({
        queryKey: id ? propertyClassificationKeys.detail(id) : ['property-classification-null'],
        queryFn: () => getPropertyClassification(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreatePropertyClassification() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createPropertyClassification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: propertyClassificationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: propertyClassificationKeys.allPropertyClassifications() });
            toast.success('Property classification created successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to create property classification';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdatePropertyClassification() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: PropertyClassificationInput }) => updatePropertyClassification(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: propertyClassificationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: propertyClassificationKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: propertyClassificationKeys.allPropertyClassifications() });
            toast.success('Property classification updated successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to update property classification';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeletePropertyClassification() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deletePropertyClassification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: propertyClassificationKeys.lists() });
            queryClient.invalidateQueries({ queryKey: propertyClassificationKeys.allPropertyClassifications() });
            toast.success('Property classification deleted successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to delete property classification';
            toast.error('Deletion Failed', { description: message });
        },
    });
}
