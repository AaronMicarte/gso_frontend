import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getDepartments,
    getAllDepartments,
    getDepartment,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    DepartmentFilters,
} from '@/lib/api/masterData/departments';
import { Department, DepartmentInput } from '@/types/masterData';
import { toast } from 'sonner';

export const departmentKeys = {
    all: ['departments'] as const,
    lists: () => [...departmentKeys.all, 'list'] as const,
    list: (filters?: DepartmentFilters) => [...departmentKeys.lists(), filters] as const,
    allDepartments: () => [...departmentKeys.all, 'all-departments'] as const,
    details: () => [...departmentKeys.all, 'detail'] as const,
    detail: (id: number) => [...departmentKeys.details(), id] as const,
};

export function useDepartments(filters?: DepartmentFilters) {
    return useQuery({
        queryKey: departmentKeys.list(filters),
        queryFn: () => getDepartments(filters),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllDepartments() {
    return useQuery({
        queryKey: departmentKeys.allDepartments(),
        queryFn: getAllDepartments,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useDepartment(id: number | null) {
    return useQuery({
        queryKey: id ? departmentKeys.detail(id) : ['department-null'],
        queryFn: () => getDepartment(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateDepartment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createDepartment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: departmentKeys.allDepartments() });
            toast.success('Department created successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to create department';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdateDepartment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: DepartmentInput }) => updateDepartment(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: departmentKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: departmentKeys.allDepartments() });
            toast.success('Department updated successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to update department';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeleteDepartment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteDepartment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: departmentKeys.allDepartments() });
            toast.success('Department deleted successfully!');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message || 'Failed to delete department';
            toast.error('Deletion Failed', { description: message });
        },
    });
}
