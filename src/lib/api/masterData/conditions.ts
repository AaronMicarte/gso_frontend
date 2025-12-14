import apiClient from '../client';
import { Condition, ConditionInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface ConditionFilters {
    search?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getConditions(filters?: ConditionFilters): Promise<PaginatedResponse<Condition>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<Condition>>(
        `/admin/master-data/conditions?${params.toString()}`
    );
    return response.data;
}

export async function getAllConditions(): Promise<Condition[]> {
    const response = await apiClient.get<ApiResponse<Condition[]>>('/admin/master-data/conditions?per_page=all');
    return response.data.data || [];
}

export async function getCondition(id: number): Promise<Condition> {
    const response = await apiClient.get<ApiResponse<Condition>>(`/admin/master-data/conditions/${id}`);
    if (!response.data.data) {
        throw new Error('Condition not found');
    }
    return response.data.data;
}

export async function createCondition(data: ConditionInput): Promise<Condition> {
    const payload = {
        ConditionName: data.name,
        Description: data.description,
    };
    const response = await apiClient.post<ApiResponse<Condition>>('/admin/master-data/conditions', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create condition');
    }
    return response.data.data;
}

export async function updateCondition(id: number, data: ConditionInput): Promise<Condition> {
    const payload = {
        ConditionName: data.name,
        Description: data.description,
    };
    const response = await apiClient.put<ApiResponse<Condition>>(`/admin/master-data/conditions/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update condition');
    }
    return response.data.data;
}

export async function deleteCondition(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/conditions/${id}`);
}