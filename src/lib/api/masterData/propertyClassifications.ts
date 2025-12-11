import apiClient from '../client';
import { PropertyClassification, PropertyClassificationInput } from '@/types/masterData';
import { ApiResponse, PaginatedResponse } from '@/types/masterData';

export interface PropertyClassificationFilters {
    search?: string;
    document_type?: 'ICS' | 'PAR';
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getPropertyClassifications(filters?: PropertyClassificationFilters): Promise<PaginatedResponse<PropertyClassification>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.document_type) params.append('document_type', filters.document_type);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<PropertyClassification>>(
        `/admin/master-data/property-classifications?${params.toString()}`
    );
    return response.data;
}

export async function getAllPropertyClassifications(): Promise<PropertyClassification[]> {
    const response = await apiClient.get<ApiResponse<PropertyClassification[]>>('/admin/master-data/property-classifications?per_page=all');
    return response.data.data || [];
}

export async function getPropertyClassification(id: number): Promise<PropertyClassification> {
    const response = await apiClient.get<ApiResponse<PropertyClassification>>(`/admin/master-data/property-classifications/${id}`);
    if (!response.data.data) {
        throw new Error('Property classification not found');
    }
    return response.data.data;
}

export async function createPropertyClassification(data: PropertyClassificationInput): Promise<PropertyClassification> {
    const payload = {
        ClassificationName: data.name,
        Description: data.description,
        DocumentType: data.document_type
    };
    const response = await apiClient.post<ApiResponse<PropertyClassification>>('/admin/master-data/property-classifications', payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to create property classification');
    }
    return response.data.data;
}

export async function updatePropertyClassification(id: number, data: PropertyClassificationInput): Promise<PropertyClassification> {
    const payload = {
        ClassificationName: data.name,
        Description: data.description,
        DocumentType: data.document_type
    };
    const response = await apiClient.put<ApiResponse<PropertyClassification>>(`/admin/master-data/property-classifications/${id}`, payload);
    if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to update property classification');
    }
    return response.data.data;
}

export async function deletePropertyClassification(id: number): Promise<void> {
    await apiClient.delete(`/admin/master-data/property-classifications/${id}`);
}
