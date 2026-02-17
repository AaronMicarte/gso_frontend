import apiClient from './client';
import { PaginatedResponse } from '@/types/assetIssuance';
import {
    PropertyTransfer,
    PropertyTransferCreatePayload,
    PropertyTransferActionResponse,
    PropertyTransferCompletePayload,
    TransferableItem,
    TransferDepartment,
    TransferEndUser,
} from '@/types/propertyTransfer';

interface TransferFilters {
    status?: PropertyTransfer['Status'];
    search?: string;
    scope?: 'incoming' | 'outgoing';
    per_page?: number;
    page?: number;
}

interface TransferableItemFilters {
    search?: string;
    from_department_id?: number;
    from_end_user_id?: number;
    per_page?: number;
    page?: number;
}

const transferAPI = {
    getAll: async (filters?: TransferFilters) => {
        const { data } = await apiClient.get<PaginatedResponse<PropertyTransfer>>('/property-transfers', {
            params: filters,
        });
        return data;
    },

    getById: async (id: number) => {
        const { data } = await apiClient.get<PropertyTransfer>(`/property-transfers/${id}`);
        return data;
    },

    create: async (payload: PropertyTransferCreatePayload) => {
        const { data } = await apiClient.post<{ message: string; transfer: PropertyTransfer }>(
            '/property-transfers',
            payload
        );
        return data;
    },

    approve: async (id: number) => {
        const { data } = await apiClient.post<PropertyTransferActionResponse>(`/property-transfers/${id}/approve`);
        return data;
    },

    reject: async (id: number, payload?: { notes?: string | null }) => {
        const { data } = await apiClient.post<PropertyTransferActionResponse>(
            `/property-transfers/${id}/reject`,
            payload || {}
        );
        return data;
    },

    complete: async (id: number, payload: PropertyTransferCompletePayload) => {
        const { data } = await apiClient.post<PropertyTransferActionResponse>(
            `/property-transfers/${id}/complete`,
            payload
        );
        return data;
    },

    getAvailableItems: async (filters?: TransferableItemFilters) => {
        const { data } = await apiClient.get<PaginatedResponse<TransferableItem>>(
            '/property-transfers/available-items',
            { params: filters }
        );
        return data;
    },

    getDepartments: async () => {
        const { data } = await apiClient.get<TransferDepartment[]>('/property-transfers/helpers/departments');
        return data;
    },

    getEndUsers: async (departmentId?: number) => {
        const { data } = await apiClient.get<TransferEndUser[]>('/property-transfers/helpers/end-users', {
            params: departmentId ? { department_id: departmentId } : undefined,
        });
        return data;
    },
};

export default transferAPI;
