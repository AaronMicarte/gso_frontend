import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getUserRoles,
    getAllUserRoles,
    getUserRole,
    createUserRole,
    updateUserRole,
    deleteUserRole,
    UserRoleFilters,
} from '@/lib/api/masterData/userRoles';
import { UserRole, UserRoleInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

export const userRoleKeys = {
    all: ['user-roles'] as const,
    lists: () => [...userRoleKeys.all, 'list'] as const,
    list: (filters?: UserRoleFilters) => [...userRoleKeys.lists(), filters] as const,
    allUserRoles: () => [...userRoleKeys.all, 'all-user-roles'] as const,
    details: () => [...userRoleKeys.all, 'detail'] as const,
    detail: (id: number) => [...userRoleKeys.details(), id] as const,
};

export function useUserRoles(filters?: UserRoleFilters) {
    return useQuery({
        queryKey: userRoleKeys.list(filters),
        queryFn: () => getUserRoles(filters),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllUserRoles() {
    return useQuery({
        queryKey: userRoleKeys.allUserRoles(),
        queryFn: getAllUserRoles,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useUserRole(id: number | null) {
    return useQuery({
        queryKey: id ? userRoleKeys.detail(id) : ['user-role-null'],
        queryFn: () => getUserRole(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateUserRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createUserRole,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userRoleKeys.lists() });
            queryClient.invalidateQueries({ queryKey: userRoleKeys.allUserRoles() });
            toast.success('User role created successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to create user role';
            toast.error('Creation Failed', { description: message });
        },
    });
}

export function useUpdateUserRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UserRoleInput }) => updateUserRole(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: userRoleKeys.lists() });
            queryClient.invalidateQueries({ queryKey: userRoleKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: userRoleKeys.allUserRoles() });
            toast.success('User role updated successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to update user role';
            toast.error('Update Failed', { description: message });
        },
    });
}

export function useDeleteUserRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteUserRole,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userRoleKeys.lists() });
            queryClient.invalidateQueries({ queryKey: userRoleKeys.allUserRoles() });
            toast.success('User role deleted successfully!');
        },
        onError: (error: Error) => {
            const message = (error as ApiError)?.response?.data?.message || 'Failed to delete user role';
            toast.error('Deletion Failed', { description: message });
        },
    });
}