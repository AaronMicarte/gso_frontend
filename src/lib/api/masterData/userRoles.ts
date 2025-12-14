import apiClient from '../client';
import { UserRole, UserRoleInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface UserRoleFilters {
    search?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getUserRoles(filters?: UserRoleFilters): Promise<PaginatedResponse<UserRole>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<UserRole>>(
        `/admin/master-data/user-roles?${params.toString()}`
    );
    return response.data;
}

export async function getAllUserRoles(): Promise<UserRole[]> {
    const response = await apiClient.get<ApiResponse<UserRole[]>>('/admin/master-data/user-roles?per_page=all');
    return response.data.data || [];
}

export async function getUserRole(id: number): Promise<UserRole> {
    const response = await apiClient.get<ApiResponse<UserRole>>(`/admin/master-data/user-roles/${id}`);
    if (!response.data.data) {
        throw new Error('User role not found');
    }
    return response.data.data;
}

export async function createUserRole(data: UserRoleInput): Promise<UserRole> {
    const payload = {
        RoleName: data.name,
        Description: data.description,
    };
    const response = await apiClient.post<ApiResponse<UserRole>>('/admin/master-data/user-roles', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create user role');
    }
    return response.data.data;
}

export async function updateUserRole(id: number, data: UserRoleInput): Promise<UserRole> {
    const payload = {
        RoleName: data.name,
        Description: data.description,
    };
    const response = await apiClient.put<ApiResponse<UserRole>>(`/admin/master-data/user-roles/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update user role');
    }
    return response.data.data;
}

export async function deleteUserRole(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/user-roles/${id}`);
}