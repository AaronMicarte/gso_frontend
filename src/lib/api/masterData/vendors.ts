import apiClient from '../client';
import { Vendor, VendorInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface VendorFilters {
    search?: string;
    is_active?: boolean;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getVendors(filters?: VendorFilters): Promise<PaginatedResponse<Vendor>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<Vendor>>(
        `/admin/master-data/vendors?${params.toString()}`
    );
    return response.data;
}

export async function getAllVendors(): Promise<Vendor[]> {
    const response = await apiClient.get<ApiResponse<Vendor[]>>('/admin/master-data/vendors?per_page=all&is_active=true');
    return response.data.data || [];
}

export async function getVendor(id: number): Promise<Vendor> {
    const response = await apiClient.get<ApiResponse<Vendor>>(`/admin/master-data/vendors/${id}`);
    if (!response.data.data) {
        throw new Error('Vendor not found');
    }
    return response.data.data;
}

export async function createVendor(data: VendorInput): Promise<Vendor> {
    const payload = {
        VendorName: data.name,
        Address: data.address,
        ContactPerson: data.contact_person,
        ContactNumber: data.contact_number,
        Email: data.email,
        IsActive: data.is_active ?? true,
    };
    const response = await apiClient.post<ApiResponse<Vendor>>('/admin/master-data/vendors', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create vendor');
    }
    return response.data.data;
}

export async function updateVendor(id: number, data: VendorInput): Promise<Vendor> {
    const payload = {
        VendorName: data.name,
        Address: data.address,
        ContactPerson: data.contact_person,
        ContactNumber: data.contact_number,
        Email: data.email,
        IsActive: data.is_active,
    };
    const response = await apiClient.put<ApiResponse<Vendor>>(`/admin/master-data/vendors/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update vendor');
    }
    return response.data.data;
}

export async function deleteVendor(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/vendors/${id}`);
}
