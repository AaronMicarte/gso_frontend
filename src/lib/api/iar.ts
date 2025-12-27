import apiClient from '@/lib/api/client';
import {
    IAR,
    CreateIARPayload,
    UpdateIARPayload,
    IARFilters,
} from '@/types/iar';

export type { IARFilters };

export const getIARs = async (filters?: IARFilters): Promise<{
    data: IAR[];
    meta: { total: number; per_page: number; current_page: number; last_page: number };
}> => {
    const params = new URLSearchParams();

    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.dr_number) params.append('dr_number', filters.dr_number);
    if (filters?.iar_number) params.append('iar_number', filters.iar_number);
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());

    const response = await apiClient.get(`/admin/procurement/inspection-acceptance-reports?${params.toString()}`);
    return response.data.data;
};

export const getIAR = async (id: number): Promise<IAR> => {
    const response = await apiClient.get(`/admin/procurement/inspection-acceptance-reports/${id}`);
    return response.data.data;
};

export const createIAR = async (data: CreateIARPayload): Promise<IAR> => {
    const response = await apiClient.post('/admin/procurement/inspection-acceptance-reports', data);
    return response.data.data;
};

export const updateIAR = async (id: number, data: UpdateIARPayload): Promise<IAR> => {
    const response = await apiClient.put(`/admin/procurement/inspection-acceptance-reports/${id}`, data);
    return response.data.data;
};

/**
 * Upload an IAR signature (inspected | accepted).
 * Accepts either a File (upload) or a base64 data URL (canvas).
 */
export const uploadIARSignature = async (id: number, role: 'inspected' | 'accepted', signature: string | File, source?: string) => {
    const form = new FormData();
    form.append('role', role);
    if (signature instanceof File) {
        form.append('signature', signature);
    } else {
        form.append('signature', signature);
    }
    if (source) form.append('source', source);
    const response = await apiClient.post(`/admin/procurement/inspection-acceptance-reports/${id}/signatures`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
};

export const deleteIAR = async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/procurement/inspection-acceptance-reports/${id}`);
};

export const getConditions = async (): Promise<{ ConditionID: number; ConditionName: string }[]> => {
    const response = await apiClient.get('/admin/procurement/inspection-acceptance-reports-helpers/conditions');
    return response.data.data;
};

export const getUsers = async (): Promise<{ UserID: number; FullName: string }[]> => {
    const response = await apiClient.get('/admin/procurement/inspection-acceptance-reports-helpers/users');
    return response.data.data;
};
