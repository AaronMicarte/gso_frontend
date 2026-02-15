import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getArticles,
    getAllArticles,
    getActiveArticles,
    getArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    restoreArticle,
    ArticleFilters,
} from '@/lib/api/masterData/articles';
import { Article, ArticleInput } from '@/types/masterData';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

export const articleKeys = {
    all: ['articles'] as const,
    lists: () => [...articleKeys.all, 'list'] as const,
    list: (filters?: ArticleFilters) => [...articleKeys.lists(), filters] as const,
    allArticles: () => [...articleKeys.all, 'all-articles'] as const,
    activeArticles: () => [...articleKeys.all, 'active-articles'] as const,
    details: () => [...articleKeys.all, 'detail'] as const,
    detail: (id: number) => [...articleKeys.details(), id] as const,
};

export function useArticles(filters?: ArticleFilters) {
    return useQuery({
        queryKey: articleKeys.list(filters),
        queryFn: () => getArticles(filters),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}

export function useAllArticles() {
    return useQuery({
        queryKey: articleKeys.allArticles(),
        queryFn: getAllArticles,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useActiveArticles() {
    return useQuery({
        queryKey: articleKeys.activeArticles(),
        queryFn: getActiveArticles,
        staleTime: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
    });
}

export function useArticle(id: number, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: id ? articleKeys.detail(id) : ['article-null'],
        queryFn: () => getArticle(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateArticle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createArticle,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: articleKeys.all });
        },
        onError: (error: ApiError) => {
            console.error('Failed to create article:', error);
            const message = error?.response?.data?.message || 'Failed to create article';
            toast.error(message);
        },
    });
}

export function useUpdateArticle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: ArticleInput }) =>
            updateArticle(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: articleKeys.all });
            queryClient.invalidateQueries({
                queryKey: articleKeys.detail(variables.id)
            });
        },
        onError: (error: ApiError) => {
            console.error('Failed to update article:', error);
            const message = error?.response?.data?.message || 'Failed to update article';
            toast.error(message);
        },
    });
}

export function useDeleteArticle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteArticle,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: articleKeys.all });
        },
        onError: (error: ApiError) => {
            console.error('Failed to delete article:', error);
            const message = error?.response?.data?.message || 'Failed to delete article';
            toast.error(message);
        },
    });
}

export function useRestoreArticle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: restoreArticle,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: articleKeys.all });
        },
        onError: (error: ApiError) => {
            console.error('Failed to restore article:', error);
            const message = error?.response?.data?.message || 'Failed to restore article';
            toast.error(message);
        },
    });
}