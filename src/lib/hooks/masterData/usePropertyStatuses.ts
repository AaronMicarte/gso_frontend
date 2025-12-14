import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getPropertyStatuses,
    getAllPropertyStatuses,
    getPropertyStatus,
    createPropertyStatus,
    updatePropertyStatus,
    deletePropertyStatus,
    PropertyStatusFilters,
} from '@/lib/api/masterData/propertyStatuses';
import { PropertyStatus, PropertyStatusInput } from '@/types/masterData';
import { toast } from 'sonner';

export const propertyStatusKeys = {
    all: ['property-statuses'] as const,
    lists: () => [...propertyStatusKeys.all, 'list'] as const,
    list: (filters?: PropertyStatusFilters) => [...propertyStatusKeys.lists(), filters] as const,
    allPropertyStatuses: () => [...propertyStatusKeys.all, 'all-property-statuses'] as const,
    details: () => [...propertyStatusKeys.all, 'detail'] as const,
    detail: (id: number) => [...propertyStatusKeys.details(), id] as const,
};

export function usePropertyStatuses(filters?: PropertyStatusFilters) {
    return useQuery({
        queryKey: propertyStatusKeys.list(filters),
        queryFn: () => getPropertyStatuses(filters),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllPropertyStatuses() {
    return useQuery({
        queryKey: propertyStatusKeys.allPropertyStatuses(),
        queryFn: getAllPropertyStatuses,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function usePropertyStatus(id: number | null) {
    return useQuery({
        queryKey: id ? propertyStatusKeys.detail(id) : ['property-status-null'],
        queryFn: () => getPropertyStatus(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreatePropertyStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createPropertyStatus,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: propertyStatusKeys.lists() });
            queryClient.invalidateQueries({ queryKey: propertyStatusKeys.allPropertyStatuses() });
            toast.success('Property status created successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to create property status';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdatePropertyStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: PropertyStatusInput }) => updatePropertyStatus(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: propertyStatusKeys.lists() });
            queryClient.invalidateQueries({ queryKey: propertyStatusKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: propertyStatusKeys.allPropertyStatuses() });
            toast.success('Property status updated successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to update property status';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeletePropertyStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deletePropertyStatus,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: propertyStatusKeys.lists() });
            queryClient.invalidateQueries({ queryKey: propertyStatusKeys.allPropertyStatuses() });
            toast.success('Property status deleted successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to delete property status';
            toast.error('Deletion Failed', { description: message });
        },
    });
}