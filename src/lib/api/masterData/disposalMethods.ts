import apiClient from '../client';
import { DisposalMethod, DisposalMethodInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface DisposalMethodFilters {
    search?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getDisposalMethods(filters?: DisposalMethodFilters): Promise<PaginatedResponse<DisposalMethod>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<DisposalMethod>>(
        `/admin/master-data/disposal-methods?${params.toString()}`
    );
    return response.data;
}

export async function getAllDisposalMethods(): Promise<DisposalMethod[]> {
    const response = await apiClient.get<ApiResponse<DisposalMethod[]>>('/admin/master-data/disposal-methods?per_page=all');
    return response.data.data || [];
}

export async function getDisposalMethod(id: number): Promise<DisposalMethod> {
    const response = await apiClient.get<ApiResponse<DisposalMethod>>(`/admin/master-data/disposal-methods/${id}`);
    if (!response.data.data) {
        throw new Error('Disposal method not found');
    }
    return response.data.data;
}

export async function createDisposalMethod(data: DisposalMethodInput): Promise<DisposalMethod> {
    const payload = {
        MethodName: data.name,
        Description: data.description,
    };
    const response = await apiClient.post<ApiResponse<DisposalMethod>>('/admin/master-data/disposal-methods', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create disposal method');
    }
    return response.data.data;
}

export async function updateDisposalMethod(id: number, data: DisposalMethodInput): Promise<DisposalMethod> {
    const payload = {
        MethodName: data.name,
        Description: data.description,
    };
    const response = await apiClient.put<ApiResponse<DisposalMethod>>(`/admin/master-data/disposal-methods/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update disposal method');
    }
    return response.data.data;
}

export async function deleteDisposalMethod(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/disposal-methods/${id}`);
}