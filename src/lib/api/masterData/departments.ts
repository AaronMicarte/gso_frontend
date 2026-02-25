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

    const response = await apiClient.get<{ success: boolean; data?: Department[]; pagination?: PaginatedResponse<Department> }>(
        `/admin/master-data/departments?${params.toString()}`
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
