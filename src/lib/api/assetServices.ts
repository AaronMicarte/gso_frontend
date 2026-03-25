import apiClient from './client';
import {
    AssetServiceRecord,
    AssetServiceRecordCreatePayload,
    AssetServiceRecordUpdatePayload,
    ServiceHelperDepartment,
    ServiceHelperEndUser,
    ServiceHelperVendor,
    ServiceInventoryItem,
    ServiceRecordsResponse,
} from '@/types/assetService';

interface ServiceFilters {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    department_id?: number;
}

const serviceApi = {
    async getAll(filters?: ServiceFilters): Promise<ServiceRecordsResponse> {
        const params = new URLSearchParams();
        if (filters?.page) params.append('page', String(filters.page));
        if (filters?.per_page) params.append('per_page', String(filters.per_page));
        if (filters?.search) params.append('search', filters.search);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.department_id) params.append('department_id', String(filters.department_id));

        const response = await apiClient.get(`/asset-services?${params.toString()}`);
        return response.data;
    },

    async getById(id: number): Promise<AssetServiceRecord> {
        const response = await apiClient.get(`/asset-services/${id}`);
        return response.data;
    },

    async create(payload: AssetServiceRecordCreatePayload): Promise<{ message: string; record: AssetServiceRecord }> {
        const response = await apiClient.post('/asset-services', payload);
        return response.data;
    },

    async update(id: number, payload: AssetServiceRecordUpdatePayload): Promise<{ message: string; record: AssetServiceRecord }> {
        const response = await apiClient.post(`/asset-services/${id}`, payload);
        return response.data;
    },

    async getStatuses(): Promise<string[]> {
        const response = await apiClient.get('/asset-services/statuses');
        return response.data?.data || [];
    },

    async getVendors(): Promise<ServiceHelperVendor[]> {
        const response = await apiClient.get('/asset-services/helpers/vendors');
        return response.data?.data || [];
    },

    async getDepartments(): Promise<ServiceHelperDepartment[]> {
        const response = await apiClient.get('/asset-services/helpers/departments');
        return response.data?.data || [];
    },

    async getEndUsers(departmentId?: number): Promise<ServiceHelperEndUser[]> {
        const params = new URLSearchParams();
        if (departmentId) params.append('department_id', String(departmentId));
        const response = await apiClient.get(`/asset-services/helpers/end-users?${params.toString()}`);
        return response.data?.data || [];
    },

    async getInventory(search?: string): Promise<ServiceInventoryItem[]> {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        const response = await apiClient.get(`/asset-services/helpers/inventory?${params.toString()}`);
        return response.data?.data || [];
    },
};

export default serviceApi;
