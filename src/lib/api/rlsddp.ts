import apiClient from './client';
import {
    PropertyRlsddpItem,
    PropertyRlsddpReport,
    AccountableOfficersResponse,
    DepartmentAsset,
    CreateRlsddpPayload,
    UpdateRlsddpPayload,
    RlsddpDocument,
    PaginatedRemovedItemsResponse,
} from '@/types/propertyRlsddp';
import { TransferDepartment } from '@/types/propertyTransfer';

interface RawRlsddpUser {
    UserID: number;
    FullName: string;
}

interface RawRlsddpReport extends Omit<PropertyRlsddpReport, 'createdBy' | 'created_by' | 'updatedBy' | 'updated_by'> {
    createdBy?: RawRlsddpUser | null;
    created_by?: RawRlsddpUser | null;
    updatedBy?: RawRlsddpUser | null;
    updated_by?: RawRlsddpUser | null;
    items?: PropertyRlsddpItem[];
    removedItems?: PropertyRlsddpItem[];
    removed_items?: PropertyRlsddpItem[];
}

interface RawPaginatedRlsddpResponse extends Omit<PaginatedRlsddpResponse, 'data'> {
    data: RawRlsddpReport[];
}

const normalizeRlsddpUser = (user?: RawRlsddpUser | null): RawRlsddpUser | undefined => {
    if (!user) return undefined;
    return {
        UserID: user.UserID,
        FullName: user.FullName,
    };
};

const normalizeRlsddpReport = (report: RawRlsddpReport): PropertyRlsddpReport => {
    const {
        createdBy,
        created_by,
        updatedBy,
        updated_by,
        items,
        removedItems,
        removed_items,
        ...rest
    } = report;

    return {
        ...rest,
        createdBy: normalizeRlsddpUser(createdBy ?? created_by),
        updatedBy: normalizeRlsddpUser(updatedBy ?? updated_by),
        items: items ?? [],
        removedItems: removedItems ?? removed_items ?? [],
    };
};

const normalizePaginatedRlsddpResponse = (response: RawPaginatedRlsddpResponse): PaginatedRlsddpResponse => ({
    ...response,
    data: (response.data ?? []).map(normalizeRlsddpReport),
});

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
        const { data } = await apiClient.get<RawPaginatedRlsddpResponse>('/property-rlsddp', { params });
        return normalizePaginatedRlsddpResponse(data);
    },

    getReport: async (id: number): Promise<PropertyRlsddpReport> => {
        const { data } = await apiClient.get<RawRlsddpReport>(`/property-rlsddp/${id}`);
        return normalizeRlsddpReport(data);
    },

    createReport: async (payload: CreateRlsddpPayload): Promise<{ message: string; report: PropertyRlsddpReport }> => {
        const { data } = await apiClient.post<{ message: string; report: RawRlsddpReport }>('/property-rlsddp', payload);
        return {
            ...data,
            report: normalizeRlsddpReport(data.report),
        };
    },

    updateReport: async (id: number, payload: UpdateRlsddpPayload): Promise<{ message: string; report: PropertyRlsddpReport }> => {
        const { data } = await apiClient.put<{ message: string; report: RawRlsddpReport }>(`/property-rlsddp/${id}`, payload);
        return {
            ...data,
            report: normalizeRlsddpReport(data.report),
        };
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

    removeItem: async (itemId: number): Promise<{ message: string }> => {
        const { data } = await apiClient.post<{ message: string }>(`/property-rlsddp/items/${itemId}/remove`);
        return data;
    },

    restoreItem: async (itemId: number): Promise<{ message: string }> => {
        const { data } = await apiClient.post<{ message: string }>(`/property-rlsddp/items/${itemId}/restore`);
        return data;
    },

    getRemovedItems: async (params?: {
        search?: string;
        page?: number;
        per_page?: number;
    }): Promise<PaginatedRemovedItemsResponse> => {
        const { data } = await apiClient.get<PaginatedRemovedItemsResponse>('/property-rlsddp/removed-items', { params });
        return data;
    },
};

export default rlsddpAPI;
