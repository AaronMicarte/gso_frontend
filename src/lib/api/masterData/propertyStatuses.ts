import apiClient from '../client';
import { PropertyStatus, PropertyStatusInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface PropertyStatusFilters {
    search?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getPropertyStatuses(filters?: PropertyStatusFilters): Promise<PaginatedResponse<PropertyStatus>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<PropertyStatus>>(
        `/admin/master-data/property-statuses?${params.toString()}`
    );
    return response.data;
}

export async function getAllPropertyStatuses(): Promise<PropertyStatus[]> {
    const response = await apiClient.get<ApiResponse<PropertyStatus[]>>('/admin/master-data/property-statuses?per_page=all');
    return response.data.data || [];
}

export async function getPropertyStatus(id: number): Promise<PropertyStatus> {
    const response = await apiClient.get<ApiResponse<PropertyStatus>>(`/admin/master-data/property-statuses/${id}`);
    if (!response.data.data) {
        throw new Error('Property status not found');
    }
    return response.data.data;
}

export async function createPropertyStatus(data: PropertyStatusInput): Promise<PropertyStatus> {
    const payload = {
        StatusName: data.name,
        Description: data.description,
    };
    const response = await apiClient.post<ApiResponse<PropertyStatus>>('/admin/master-data/property-statuses', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create property status');
    }
    return response.data.data;
}

export async function updatePropertyStatus(id: number, data: PropertyStatusInput): Promise<PropertyStatus> {
    const payload = {
        StatusName: data.name,
        Description: data.description,
    };
    const response = await apiClient.put<ApiResponse<PropertyStatus>>(`/admin/master-data/property-statuses/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update property status');
    }
    return response.data.data;
}

export async function deletePropertyStatus(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/property-statuses/${id}`);
}