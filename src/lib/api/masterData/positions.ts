import apiClient from '../client';
import { Position, PositionInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface PositionFilters {
    search?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getPositions(filters?: PositionFilters): Promise<PaginatedResponse<Position>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<Position>>(
        `/admin/master-data/positions?${params.toString()}`
    );
    return response.data;
}

export async function getAllPositions(): Promise<Position[]> {
    const response = await apiClient.get<ApiResponse<Position[]>>('/admin/master-data/positions?per_page=all');
    return response.data.data || [];
}

export async function getPosition(id: number): Promise<Position> {
    const response = await apiClient.get<ApiResponse<Position>>(`/admin/master-data/positions/${id}`);
    if (!response.data.data) {
        throw new Error('Position not found');
    }
    return response.data.data;
}

export async function createPosition(data: PositionInput): Promise<Position> {
    const payload = {
        PositionName: data.name,
        PositionDescription: data.description
    };
    const response = await apiClient.post<ApiResponse<Position>>('/admin/master-data/positions', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create position');
    }
    return response.data.data;
}

export async function updatePosition(id: number, data: PositionInput): Promise<Position> {
    const payload = {
        PositionName: data.name,
        PositionDescription: data.description
    };
    const response = await apiClient.put<ApiResponse<Position>>(`/admin/master-data/positions/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update position');
    }
    return response.data.data;
}

export async function deletePosition(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/positions/${id}`);
}
