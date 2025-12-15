import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getCategories,
    getAllCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    CategoryFilters,
} from '@/lib/api/masterData/categories';
import { Category, CategoryInput } from '@/types/property';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

// Query keys for better cache management
export const categoryKeys = {
    all: ['categories'] as const,
    lists: () => [...categoryKeys.all, 'list'] as const,
    list: (filters?: CategoryFilters) => [...categoryKeys.lists(), filters] as const,
    allCategories: () => [...categoryKeys.all, 'all-categories'] as const,
    details: () => [...categoryKeys.all, 'detail'] as const,
    detail: (id: number) => [...categoryKeys.details(), id] as const,
};

// Hook for fetching paginated categories
export function useCategories(filters?: CategoryFilters) {
    return useQuery({
        queryKey: categoryKeys.list(filters),
        queryFn: () => getCategories(filters),
        staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
        gcTime: 10 * 60 * 1000, // Cache for 10 minutes
    });
}

// Hook for fetching all categories (no pagination)
export function useAllCategories() {
    return useQuery({
        queryKey: categoryKeys.allCategories(),
        queryFn: getAllCategories,
        staleTime: 10 * 60 * 1000, // Master data stays fresh longer
        gcTime: 15 * 60 * 1000,
    });
}

// Hook for fetching single category
export function useCategory(id: number | null) {
    return useQuery({
        queryKey: id ? categoryKeys.detail(id) : ['category-null'],
        queryFn: () => getCategory(id!),
        enabled: !!id, // Only run if ID exists
        staleTime: 5 * 60 * 1000,
    });
}

// Hook for creating category
export function useCreateCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createCategory,
        onMutate: async (newCategory) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });

            // Snapshot previous value
            const previousCategories = queryClient.getQueryData(categoryKeys.allCategories());

            // Optimistically update cache
            queryClient.setQueryData(categoryKeys.allCategories(), (old: Category[] | undefined) => {
                if (!old) return old;
                const tempCategory: Category = {
                    id: Date.now(),
                    name: newCategory.name,
                    description: newCategory.description || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    deleted_at: null,
                    is_deleted: false,
                };
                return [...old, tempCategory];
            });

            return { previousCategories };
        },
        onSuccess: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: categoryKeys.allCategories() });
            toast.success('Category created successfully!', {
                description: 'The new category has been added to the system.',
            });
        },
        onError: (error: Error, _newCategory, context) => {
            // Rollback on error
            if (context?.previousCategories) {
                queryClient.setQueryData(categoryKeys.allCategories(), context.previousCategories);
            }
            const message = (error as ApiError)?.response?.data?.message || 'Failed to create category';
            toast.error('Creation Failed', { description: message });
        },
    });
}

// Hook for updating category
export function useUpdateCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: CategoryInput }) => updateCategory(id, data),
        onMutate: async ({ id, data }) => {
            // Cancel queries
            await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });
            await queryClient.cancelQueries({ queryKey: categoryKeys.detail(id) });

            // Snapshot
            const previousCategory = queryClient.getQueryData(categoryKeys.detail(id));
            const previousAllCategories = queryClient.getQueryData(categoryKeys.allCategories());

            // Optimistic update
            queryClient.setQueryData(categoryKeys.detail(id), (old: Category | undefined) => {
                if (!old) return old;
                return { ...old, ...data, UpdatedDate: new Date().toISOString() };
            });

            queryClient.setQueryData(categoryKeys.allCategories(), (old: Category[] | undefined) => {
                if (!old) return old;
                return old.map((cat) =>
                    cat.id === id
                        ? { ...cat, ...data, updated_at: new Date().toISOString() }
                        : cat
                );
            });

            return { previousCategory, previousAllCategories };
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: categoryKeys.allCategories() });
            toast.success('Category updated successfully!');
        },
        onError: (error: Error, variables, context) => {
            // Rollback
            if (context?.previousCategory) {
                queryClient.setQueryData(categoryKeys.detail(variables.id), context.previousCategory);
            }
            if (context?.previousAllCategories) {
                queryClient.setQueryData(categoryKeys.allCategories(), context.previousAllCategories);
            }
            const message = (error as ApiError)?.response?.data?.message || 'Failed to update category';
            toast.error('Update Failed', { description: message });
        },
    });
}

// Hook for deleting category
export function useDeleteCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteCategory,
        onMutate: async (id) => {
            // Cancel queries
            await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });

            // Snapshot
            const previousAllCategories = queryClient.getQueryData(categoryKeys.allCategories());

            // Optimistic removal
            queryClient.setQueryData(categoryKeys.allCategories(), (old: Category[] | undefined) => {
                if (!old) return old;
                return old.filter((cat) => cat.id !== id);
            });

            return { previousAllCategories };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: categoryKeys.allCategories() });
            toast.success('Category deleted successfully!', {
                description: 'The category has been removed from the system.',
            });
        },
        onError: (error: Error, _id, context) => {
            // Rollback
            if (context?.previousAllCategories) {
                queryClient.setQueryData(categoryKeys.allCategories(), context.previousAllCategories);
            }
            const message = (error as ApiError)?.response?.data?.message || 'Failed to delete category';
            toast.error('Deletion Failed', { description: message });
        },
    });
}
