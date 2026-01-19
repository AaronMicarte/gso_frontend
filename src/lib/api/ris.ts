import apiClient from '@/lib/api/client';
import type { AxiosResponse } from 'axios';
import type { Paginated, RisRecord } from '@/types/ris';

type RisByRequestResponse = RisRecord | { exists: false; message?: string; request_id?: number };

export const listRis = async (params?: { page?: number; per_page?: number; status?: string; search?: string }): Promise<Paginated<RisRecord>> => {
    const response: AxiosResponse<Paginated<RisRecord>> = await apiClient.get('/requisition-issue-slips', { params });
    return response.data;
};

export const getRis = async (id: number): Promise<RisRecord> => {
    const response: AxiosResponse<RisRecord> = await apiClient.get(`/requisition-issue-slips/${id}`);
    return response.data;
};

export const getRisByRequest = async (requestId: number): Promise<RisRecord | null> => {
    try {
        const response: AxiosResponse<RisByRequestResponse> = await apiClient.get(`/requisition-issue-slips/by-request/${requestId}`);
        const data = response.data;

        if (typeof data === 'object' && data !== null && 'exists' in data && data.exists === false) {
            return null;
        }

        return data as RisRecord;
    } catch (error: unknown) {
        // Back-compat: older backend behavior used 404 when no RIS exists yet.
        if (typeof error === 'object' && error && 'response' in error) {
            const resp = (error as { response?: { status?: number } }).response;
            if (resp?.status === 404) return null;
        }
        throw error;
    }
};

export const prepareRis = async (payload: {
    asset_request_id: number;
    ris_date: string;
    entity_name: string;
    fund_cluster: string;
    division: string;
    responsibility_center_code: string;
    remarks?: string;
}): Promise<{ message: string; ris: RisRecord }> => {
    const response: AxiosResponse<{ message: string; ris: RisRecord }> = await apiClient.post('/requisition-issue-slips', payload);
    return response.data;
};
