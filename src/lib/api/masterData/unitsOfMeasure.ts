import apiClient from '../client';
import { UnitOfMeasure, UnitOfMeasureInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface UnitOfMeasureFilters {
    search?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getUnitsOfMeasure(filters?: UnitOfMeasureFilters): Promise<PaginatedResponse<UnitOfMeasure>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<UnitOfMeasure>>(
        `/admin/master-data/units-of-measure?${params.toString()}`
    );
    return response.data;
}

export async function getAllUnitsOfMeasure(): Promise<UnitOfMeasure[]> {
    const response = await apiClient.get<ApiResponse<UnitOfMeasure[]>>('/admin/master-data/units-of-measure?per_page=all');
    return response.data.data || [];
}

export async function getUnitOfMeasure(id: number): Promise<UnitOfMeasure> {
    const response = await apiClient.get<ApiResponse<UnitOfMeasure>>(`/admin/master-data/units-of-measure/${id}`);
    if (!response.data.data) {
        throw new Error('Unit of measure not found');
    }
    return response.data.data;
}

export async function createUnitOfMeasure(data: UnitOfMeasureInput): Promise<UnitOfMeasure> {
    const payload = {
        UnitName: data.name,
        Description: data.description
    };
    const response = await apiClient.post<ApiResponse<UnitOfMeasure>>('/admin/master-data/units-of-measure', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create unit of measure');
    }
    return response.data.data;
}

export async function updateUnitOfMeasure(id: number, data: UnitOfMeasureInput): Promise<UnitOfMeasure> {
    const payload = {
        UnitName: data.name,
        Description: data.description
    };
    const response = await apiClient.put<ApiResponse<UnitOfMeasure>>(`/admin/master-data/units-of-measure/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update unit of measure');
    }
    return response.data.data;
}

export async function deleteUnitOfMeasure(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/units-of-measure/${id}`);
}
