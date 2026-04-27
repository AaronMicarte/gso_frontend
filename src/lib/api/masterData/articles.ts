import apiClient from '../client';
import { Article, ArticleInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

function buildArticleFormData(data: ArticleInput, includeMethodOverride = false): FormData {
    const formData = new FormData();

    formData.append('ArticleName', data.ArticleName);
    formData.append('PropertyTypeID', String(data.PropertyTypeID));
    formData.append('DefaultUnitOfMeasureID', String(data.DefaultUnitOfMeasureID));
    formData.append('IsActive', data.IsActive ? '1' : '0');

    if (data.Description !== undefined) {
        formData.append('Description', data.Description);
    }

    if (data.RemoveImage !== undefined) {
        formData.append('RemoveImage', data.RemoveImage ? '1' : '0');
    }

    if (data.ArticleImage) {
        formData.append('ArticleImage', data.ArticleImage);
    }

    if (includeMethodOverride) {
        formData.append('_method', 'PUT');
    }

    return formData;
}

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

    const response = await apiClient.get<{ success: boolean; data?: Article[]; pagination?: PaginatedResponse<Article> }>(
        `/admin/master-data/articles?${params.toString()}`
    );

    const items = response.data.data ?? [];
    const pagination = response.data.pagination;
    const perPage = typeof pagination?.per_page === 'number' ? pagination.per_page : items.length || (filters?.per_page ?? 15);
    const total = typeof pagination?.total === 'number' ? pagination.total : items.length;
    const currentPage = typeof pagination?.current_page === 'number' ? pagination.current_page : (filters?.page ?? 1);
    const lastPage = typeof pagination?.last_page === 'number' ? pagination.last_page : 1;
    const from = typeof pagination?.from === 'number' ? pagination.from : (items.length ? ((currentPage - 1) * perPage) + 1 : 0);
    const to = typeof pagination?.to === 'number' ? pagination.to : (items.length ? Math.min(currentPage * perPage, total) : 0);

    return {
        data: items,
        current_page: currentPage,
        per_page: perPage,
        total,
        last_page: lastPage,
        from,
        to,
        prev_page_url: pagination?.prev_page_url,
        next_page_url: pagination?.next_page_url,
    };
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
    const formData = buildArticleFormData(data);
    const response = await apiClient.post<ApiResponse<Article>>('/admin/master-data/articles', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (!response.data.data) {
        throw new Error('Failed to create article');
    }
    return response.data.data;
}

export async function updateArticle(id: number, data: ArticleInput): Promise<Article> {
    const formData = buildArticleFormData(data, true);
    const response = await apiClient.post<ApiResponse<Article>>(`/admin/master-data/articles/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
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