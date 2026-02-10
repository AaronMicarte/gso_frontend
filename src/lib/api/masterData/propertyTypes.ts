import apiClient from '../client';
import { PropertyType, PropertyTypeInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface PropertyTypeFilters {
    search?: string;
    category_id?: number;
    property_classification_id?: number;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getPropertyTypes(filters?: PropertyTypeFilters): Promise<PaginatedResponse<PropertyType>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.category_id) params.append('category_id', filters.category_id.toString());
    if (filters?.property_classification_id) params.append('property_classification_id', filters.property_classification_id.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<PropertyType>>(
        `/admin/master-data/property-types?${params.toString()}`
    );
    return response.data;
}

export async function getAllPropertyTypes(): Promise<PropertyType[]> {
    const response = await apiClient.get<ApiResponse<PropertyType[]>>('/admin/master-data/property-types?per_page=all');
    return response.data.data || [];
}

export async function getPropertyType(id: number): Promise<PropertyType> {
    const response = await apiClient.get<ApiResponse<PropertyType>>(`/admin/master-data/property-types/${id}`);
    if (!response.data.data) {
        throw new Error('Property type not found');
    }
    return response.data.data;
}

export async function createPropertyType(data: PropertyTypeInput): Promise<PropertyType> {
    const payload = {
        PropertyName: data.name,
        PropertyClassificationID: data.property_classification_id,
        Description: data.description
    };
    const response = await apiClient.post<ApiResponse<PropertyType>>('/admin/master-data/property-types', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create property type');
    }
    return response.data.data;
}

export async function updatePropertyType(id: number, data: PropertyTypeInput): Promise<PropertyType> {
    const payload = {
        PropertyName: data.name,
        PropertyClassificationID: data.property_classification_id,
        Description: data.description
    };
    const response = await apiClient.put<ApiResponse<PropertyType>>(`/admin/master-data/property-types/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update property type');
    }
    return response.data.data;
}

export async function deletePropertyType(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/property-types/${id}`);
}
