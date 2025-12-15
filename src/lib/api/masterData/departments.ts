import apiClient from '../client';
import { Department, DepartmentInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface DepartmentFilters {
    search?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getDepartments(filters?: DepartmentFilters): Promise<PaginatedResponse<Department>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<Department>>(
        `/admin/master-data/departments?${params.toString()}`
    );
    return response.data;
}

export async function getAllDepartments(): Promise<Department[]> {
    const response = await apiClient.get<ApiResponse<Department[]>>('/admin/master-data/departments?per_page=all');
    return response.data.data || [];
}

export async function getDepartment(id: number): Promise<Department> {
    const response = await apiClient.get<ApiResponse<Department>>(`/admin/master-data/departments/${id}`);
    if (!response.data.data) {
        throw new Error('Department not found');
    }
    return response.data.data;
}

export async function createDepartment(data: DepartmentInput): Promise<Department> {
    const payload = {
        DepartmentCode: data.DepartmentCode,
        DepartmentName: data.DepartmentName,
        Description: data.Description,
    };
    const response = await apiClient.post<ApiResponse<Department>>('/admin/master-data/departments', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create department');
    }
    return response.data.data;
}

export async function updateDepartment(id: number, data: DepartmentInput): Promise<Department> {
    const payload = {
        DepartmentCode: data.DepartmentCode,
        DepartmentName: data.DepartmentName,
        Description: data.Description,
    };
    const response = await apiClient.put<ApiResponse<Department>>(`/admin/master-data/departments/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update department');
    }
    return response.data.data;
}

export async function deleteDepartment(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/departments/${id}`);
}
