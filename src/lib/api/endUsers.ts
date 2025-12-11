import apiClient from './client';
import { EndUser, EndUserInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface EndUserFilters {
    search?: string;
    department_id?: number;
    position_id?: number;
    is_active?: boolean;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getEndUsers(filters?: EndUserFilters): Promise<PaginatedResponse<EndUser>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.department_id) params.append('department_id', filters.department_id.toString());
    if (filters?.position_id) params.append('position_id', filters.position_id.toString());
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<EndUser>>(
        `/admin/master-data/end-users?${params.toString()}`
    );
    return response.data;
}

export async function getAllEndUsers(): Promise<EndUser[]> {
    const response = await apiClient.get<ApiResponse<EndUser[]>>('/admin/master-data/end-users?per_page=all&is_active=true');
    return response.data.data || [];
}

export async function getEndUser(id: number): Promise<EndUser> {
    const response = await apiClient.get<ApiResponse<EndUser>>(`/admin/master-data/end-users/${id}`);
    if (!response.data.data) {
        throw new Error('End user not found');
    }
    return response.data.data;
}

export async function createEndUser(data: EndUserInput): Promise<EndUser> {
    const response = await apiClient.post<ApiResponse<EndUser>>('/admin/master-data/end-users', data);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create end user');
    }
    return response.data.data;
}

export async function updateEndUser(id: number, data: EndUserInput): Promise<EndUser> {
    const response = await apiClient.put<ApiResponse<EndUser>>(`/admin/master-data/end-users/${id}`, data);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update end user');
    }
    return response.data.data;
}

export async function deleteEndUser(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/end-users/${id}`);
}
