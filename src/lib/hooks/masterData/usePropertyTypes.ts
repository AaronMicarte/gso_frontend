import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getPropertyTypes,
    getAllPropertyTypes,
    getPropertyType,
    createPropertyType,
    updatePropertyType,
    deletePropertyType,
    PropertyTypeFilters,
} from '@/lib/api/masterData/propertyTypes';
import { PropertyType, PropertyTypeInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

export const propertyTypeKeys = {
    all: ['property-types'] as const,
    lists: () => [...propertyTypeKeys.all, 'list'] as const,
    list: (filters?: PropertyTypeFilters) => [...propertyTypeKeys.lists(), filters] as const,
    allPropertyTypes: () => [...propertyTypeKeys.all, 'all-property-types'] as const,
    details: () => [...propertyTypeKeys.all, 'detail'] as const,
    detail: (id: number) => [...propertyTypeKeys.details(), id] as const,
};

export function usePropertyTypes(filters?: PropertyTypeFilters) {
    return useQuery({
        queryKey: propertyTypeKeys.list(filters),
        queryFn: () => getPropertyTypes(filters),
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllPropertyTypes() {
    return useQuery({
        queryKey: propertyTypeKeys.allPropertyTypes(),
        queryFn: getAllPropertyTypes,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function usePropertyType(id: number | null) {
    return useQuery({
        queryKey: id ? propertyTypeKeys.detail(id) : ['property-type-null'],
        queryFn: () => getPropertyType(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreatePropertyType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createPropertyType,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: propertyTypeKeys.lists() });
            queryClient.invalidateQueries({ queryKey: propertyTypeKeys.allPropertyTypes() });
            toast.success('Property type created successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to create property type';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdatePropertyType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: PropertyTypeInput }) => updatePropertyType(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: propertyTypeKeys.lists() });
            queryClient.invalidateQueries({ queryKey: propertyTypeKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: propertyTypeKeys.allPropertyTypes() });
            toast.success('Property type updated successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to update property type';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeletePropertyType() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deletePropertyType,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: propertyTypeKeys.lists() });
            queryClient.invalidateQueries({ queryKey: propertyTypeKeys.allPropertyTypes() });
            toast.success('Property type deleted successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to delete property type';
            toast.error('Deletion Failed', { description: message });
        },
    });
}
