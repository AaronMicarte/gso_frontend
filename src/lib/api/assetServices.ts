import apiClient from './client';
import {
    AssetServiceRecord,
    AssetServiceRecordCreatePayload,
    AssetServiceRecordDetail,
    AssetServiceRecordUpdatePayload,
    ServiceHelperDepartment,
    ServiceHelperEndUser,
    ServiceHelperProvider,
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

interface RawServiceInventoryItem extends ServiceInventoryItem {
    propertyType?: ServiceInventoryItem['propertyType'] | null;
    property_type?: ServiceInventoryItem['propertyType'] | null;
    inventory?: ServiceInventoryItem['inventory'] | null;
    drDetail?: ServiceInventoryItem['drDetail'] | null;
    dr_detail?: ServiceInventoryItem['drDetail'] | null;
}

interface RawServiceRecordDetail extends Omit<AssetServiceRecordDetail, 'inventoryDetail'> {
    inventoryDetail?: RawServiceInventoryItem | null;
    inventory_detail?: RawServiceInventoryItem | null;
}

interface RawServiceRecord extends Omit<AssetServiceRecord, 'details' | 'reportingDepartment' | 'createdBy' | 'updatedBy' | 'reportingDepartmentHead' | 'reportingDepartmentLabel'> {
    details?: RawServiceRecordDetail[];
    reportingDepartment?: ServiceHelperDepartment | null;
    reporting_department?: ServiceHelperDepartment | null;
    createdBy?: { UserID: number; FullName: string } | null;
    created_by?: { UserID: number; FullName: string } | null;
    updatedBy?: { UserID: number; FullName: string } | null;
    updated_by?: { UserID: number; FullName: string } | null;
    reportingDepartmentHead?: string | null;
    reporting_department_head?: string | null;
    reportingDepartmentLabel?: string | null;
    reporting_department_label?: string | null;
}

const normalizeInventoryDetail = (detail?: RawServiceInventoryItem | null): ServiceInventoryItem | null => {
    if (!detail) return null;
    return {
        ...detail,
        propertyType: detail.propertyType ?? detail.property_type ?? null,
        inventory: detail.inventory ?? null,
        drDetail: detail.drDetail ?? detail.dr_detail ?? null,
    };
};

const normalizeServiceDetail = (detail: RawServiceRecordDetail): AssetServiceRecordDetail => ({
    ...detail,
    inventoryDetail: normalizeInventoryDetail(detail.inventoryDetail ?? detail.inventory_detail),
});

const normalizeServiceRecord = (record: RawServiceRecord): AssetServiceRecord => ({
    ...record,
    details: (record.details ?? []).map(normalizeServiceDetail),
    reportingDepartment: record.reportingDepartment ?? record.reporting_department ?? null,
    createdBy: record.createdBy ?? record.created_by ?? null,
    updatedBy: record.updatedBy ?? record.updated_by ?? null,
    reportingDepartmentHead: record.reportingDepartmentHead ?? record.reporting_department_head ?? null,
    reportingDepartmentLabel: record.reportingDepartmentLabel ?? record.reporting_department_label ?? null,
});

const normalizeServiceRecordsResponse = (response: ServiceRecordsResponse) => ({
    ...response,
    data: (response.data ?? []).map((record) => normalizeServiceRecord(record as RawServiceRecord)),
});

const serviceApi = {
    async getAll(filters?: ServiceFilters): Promise<ServiceRecordsResponse> {
        const params = new URLSearchParams();
        if (filters?.page) params.append('page', String(filters.page));
        if (filters?.per_page) params.append('per_page', String(filters.per_page));
        if (filters?.search) params.append('search', filters.search);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.department_id) params.append('department_id', String(filters.department_id));

        const response = await apiClient.get(`/asset-services?${params.toString()}`);
        return normalizeServiceRecordsResponse(response.data);
    },

    async getById(id: number): Promise<AssetServiceRecord> {
        const response = await apiClient.get(`/asset-services/${id}`);
        return normalizeServiceRecord(response.data as RawServiceRecord);
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

    async getProviders(): Promise<ServiceHelperProvider[]> {
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

    async getDepartmentHeads(departmentId?: number): Promise<ServiceHelperEndUser[]> {
        const params = new URLSearchParams();
        if (departmentId) params.append('department_id', String(departmentId));
        const response = await apiClient.get(`/asset-services/helpers/department-heads?${params.toString()}`);
        return response.data?.data || [];
    },

    async getInventory(search?: string, departmentId?: number): Promise<ServiceInventoryItem[]> {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (departmentId) params.append('department_id', String(departmentId));
        const response = await apiClient.get(`/asset-services/helpers/inventory?${params.toString()}`);
        return response.data?.data || [];
    },
};

export default serviceApi;
