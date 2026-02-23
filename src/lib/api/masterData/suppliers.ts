import apiClient from '../client';
import { Supplier, SupplierInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface SupplierFilters {
    search?: string;
    is_active?: boolean;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getSuppliers(filters?: SupplierFilters): Promise<PaginatedResponse<Supplier>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<Supplier>>(
        `/admin/master-data/suppliers?${params.toString()}`
    );
    return response.data;
}

export async function getAllSuppliers(): Promise<Supplier[]> {
    const response = await apiClient.get<ApiResponse<Supplier[]>>('/admin/master-data/suppliers?per_page=all&is_active=true');
    return response.data.data || [];
}

export async function getSupplier(id: number): Promise<Supplier> {
    const response = await apiClient.get<ApiResponse<Supplier>>(`/admin/master-data/suppliers/${id}`);
    if (!response.data.data) {
        throw new Error('Supplier not found');
    }
    return response.data.data;
}

export async function createSupplier(data: SupplierInput): Promise<Supplier> {
    const payload = {
        SupplierName: data.name,
        Address: data.address,
        ContactPerson: data.contact_person,
        ContactNumber: data.contact_number,
        Email: data.email,
        IsActive: data.is_active ?? true,
    };
    const response = await apiClient.post<ApiResponse<Supplier>>('/admin/master-data/suppliers', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create supplier');
    }
    return response.data.data;
}

export async function updateSupplier(id: number, data: SupplierInput): Promise<Supplier> {
    const payload = {
        SupplierName: data.name,
        Address: data.address,
        ContactPerson: data.contact_person,
        ContactNumber: data.contact_number,
        Email: data.email,
        IsActive: data.is_active,
    };
    const response = await apiClient.put<ApiResponse<Supplier>>(`/admin/master-data/suppliers/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update supplier');
    }
    return response.data.data;
}

export async function deleteSupplier(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/suppliers/${id}`);
}
