import apiClient from './client';
import { Category, CategoryInput, ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface CategoryFilters {
    search?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

/**
 * Fetch all categories with optional filters
 */
export async function getCategories(filters?: CategoryFilters): Promise<PaginatedResponse<Category>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<Category>>(
        `/admin/categories?${params.toString()}`
    );
    return response.data;
}

/**
 * Fetch all categories without pagination
 */
export async function getAllCategories(): Promise<Category[]> {
    const response = await apiClient.get<ApiResponse<Category[]>>('/admin/categories?per_page=all');
    return response.data.data || [];
}

/**
 * Fetch a single category by ID
 */
export async function getCategory(id: number): Promise<Category> {
    const response = await apiClient.get<ApiResponse<Category>>(`/admin/categories/${id}`);
    if (!response.data.data) {
        throw new Error('Category not found');
    }
    return response.data.data;
}

/**
 * Create a new category
 */
export async function createCategory(data: CategoryInput): Promise<Category> {
    const response = await apiClient.post<ApiResponse<Category>>('/admin/categories', data);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create category');
    }
    return response.data.data;
}

/**
 * Update an existing category
 */
export async function updateCategory(id: number, data: CategoryInput): Promise<Category> {
    const response = await apiClient.put<ApiResponse<Category>>(`/admin/categories/${id}`, data);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update category');
    }
    return response.data.data;
}

/**
 * Delete a category
 */
export async function deleteCategory(id: number): Promise<void> {
    await apiClient.delete(`/admin/categories/${id}`);
}
