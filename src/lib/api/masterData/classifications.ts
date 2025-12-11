import apiClient from '../client';
import { Classification, ClassificationInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface ClassificationFilters {
    search?: string;
    category_id?: number;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getClassifications(filters?: ClassificationFilters): Promise<PaginatedResponse<Classification>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.category_id) params.append('category_id', filters.category_id.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<Classification>>(
        `/admin/master-data/classifications?${params.toString()}`
    );
    return response.data;
}

export async function getAllClassifications(categoryId?: number): Promise<Classification[]> {
    const params = categoryId ? `?category_id=${categoryId}&per_page=all` : '?per_page=all';
    const response = await apiClient.get<ApiResponse<Classification[]>>(`/admin/master-data/classifications${params}`);
    return response.data.data || [];
}

export async function getClassification(id: number): Promise<Classification> {
    const response = await apiClient.get<ApiResponse<Classification>>(`/admin/master-data/classifications/${id}`);
    if (!response.data.data) {
        throw new Error('Classification not found');
    }
    return response.data.data;
}

export async function createClassification(data: ClassificationInput): Promise<Classification> {
    const payload = {
        ClassificationName: data.name,
        CategoryID: data.category_id,
        Description: data.description
    };
    const response = await apiClient.post<ApiResponse<Classification>>('/admin/master-data/classifications', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create classification');
    }
    return response.data.data;
}

export async function updateClassification(id: number, data: ClassificationInput): Promise<Classification> {
    const payload = {
        ClassificationName: data.name,
        CategoryID: data.category_id,
        Description: data.description
    };
    const response = await apiClient.put<ApiResponse<Classification>>(`/admin/master-data/classifications/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update classification');
    }
    return response.data.data;
}

export async function deleteClassification(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/classifications/${id}`);
}
