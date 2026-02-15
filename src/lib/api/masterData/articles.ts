import apiClient from '../client';
import { Article, ArticleInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface ArticleFilters {
    search?: string;
    is_active?: boolean;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getArticles(filters?: ArticleFilters): Promise<PaginatedResponse<Article>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<Article>>(
        `/admin/master-data/articles?${params.toString()}`
    );
    return response.data;
}

export async function getAllArticles(): Promise<Article[]> {
    const response = await apiClient.get<ApiResponse<Article[]>>('/admin/master-data/articles?per_page=all');
    return response.data.data || [];
}

export async function getActiveArticles(): Promise<Article[]> {
    const response = await apiClient.get<ApiResponse<Article[]>>('/admin/master-data/articles-active');
    return response.data.data || [];
}

export async function getArticle(id: number): Promise<Article> {
    const response = await apiClient.get<ApiResponse<Article>>(`/admin/master-data/articles/${id}`);
    if (!response.data.data) {
        throw new Error('Article not found');
    }
    return response.data.data;
}

export async function createArticle(data: ArticleInput): Promise<Article> {
    const response = await apiClient.post<ApiResponse<Article>>('/admin/master-data/articles', data);
    if (!response.data.data) {
        throw new Error('Failed to create article');
    }
    return response.data.data;
}

export async function updateArticle(id: number, data: ArticleInput): Promise<Article> {
    const response = await apiClient.put<ApiResponse<Article>>(`/admin/master-data/articles/${id}`, data);
    if (!response.data.data) {
        throw new Error('Failed to update article');
    }
    return response.data.data;
}

export async function deleteArticle(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/articles/${id}`);
}

export async function restoreArticle(id: number): Promise<Article> {
    const response = await apiClient.post<ApiResponse<Article>>(`/admin/master-data/articles/${id}/restore`);
    if (!response.data.data) {
        throw new Error('Failed to restore article');
    }
    return response.data.data;
}