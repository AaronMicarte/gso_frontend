import apiClient from './client';
import {
    PropertyRlsddpReport,
    AccountableOfficersResponse,
    DepartmentAsset,
    CreateRlsddpPayload,
    UpdateRlsddpPayload,
    RlsddpDocument,
} from '@/types/propertyRlsddp';
import { TransferDepartment } from '@/types/propertyTransfer';

export interface PaginatedRlsddpResponse {
    current_page: number;
    data: PropertyRlsddpReport[];
    first_page_url: string;
    from: number | null;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number | null;
    total: number;
}

export const rlsddpAPI = {
    getReports: async (params?: {
        search?: string;
        department_id?: number;
        status?: string;
        page?: number;
        per_page?: number;
    }): Promise<PaginatedRlsddpResponse> => {
        const { data } = await apiClient.get<PaginatedRlsddpResponse>('/property-rlsddp', { params });
        return data;
    },

    getReport: async (id: number): Promise<PropertyRlsddpReport> => {
        const { data } = await apiClient.get<PropertyRlsddpReport>(`/property-rlsddp/${id}`);
        return data;
    },

    createReport: async (payload: CreateRlsddpPayload): Promise<{ message: string; report: PropertyRlsddpReport }> => {
        const { data } = await apiClient.post<{ message: string; report: PropertyRlsddpReport }>('/property-rlsddp', payload);
        return data;
    },

    updateReport: async (id: number, payload: UpdateRlsddpPayload): Promise<{ message: string; report: PropertyRlsddpReport }> => {
        const { data } = await apiClient.put<{ message: string; report: PropertyRlsddpReport }>(`/property-rlsddp/${id}`, payload);
        return data;
    },

    getAccountableOfficers: async (departmentId: number): Promise<AccountableOfficersResponse> => {
        const { data } = await apiClient.get<AccountableOfficersResponse>(`/property-rlsddp/accountable-officer/${departmentId}`);
        return data;
    },

    getDepartmentAssets: async (departmentId: number, params?: { search?: string; officer?: string; officer_type?: string }): Promise<DepartmentAsset[]> => {
        const { data } = await apiClient.get<{ data: DepartmentAsset[] }>(`/property-rlsddp/department-assets/${departmentId}`, {
            params,
        });
        return data.data;
    },

    getDocuments: async (): Promise<RlsddpDocument[]> => {
        const { data } = await apiClient.get<{ data: RlsddpDocument[] }>('/property-rlsddp/documents');
        return data.data;
    },

    getDepartments: async (): Promise<TransferDepartment[]> => {
        const { data } = await apiClient.get<TransferDepartment[]>('/property-transfers/helpers/departments');
        return data;
    },
};

export default rlsddpAPI;
