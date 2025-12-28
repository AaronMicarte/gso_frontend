import apiClient from '@/lib/api/client';
import type { AxiosResponse } from 'axios';

export type InventoryListResponse = { data: { InventoryID: number; InventoryNumber: string; DateAcquired: string; Remarks?: string }[]; meta?: { total: number; per_page: number; current_page: number; last_page: number } };
export type InventoryDetail = { InventoryDetailID: number; ItemDescription?: string; propertyType?: { PropertyName: string }; Quantity: number; UnitCost: number; qrCode?: { QRCodeData: string } };
export type InventoryResponse = { InventoryID: number; InventoryNumber: string; DateAcquired: string; Remarks?: string; details?: InventoryDetail[] };
export type PendingIar = { IARID: number; IARNumber: string; DateAccepted: string; details: { IARDetailID: number; QuantityAccepted: number }[] };

export const getInventories = async (params?: { page?: number; per_page?: number }): Promise<InventoryListResponse> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.append('page', String(params.page));
    if (params?.per_page) qs.append('per_page', String(params.per_page));

    const response: AxiosResponse<InventoryListResponse> = await apiClient.get(`/admin/inventory?${qs.toString()}`);
    return response.data;
};

export const getPendingIngestion = async (): Promise<PendingIar[]> => {
    const response: AxiosResponse<PendingIar[]> = await apiClient.get('/admin/inventory/pending-ingestion');
    return response.data;
};

export const ingestFromIar = async (iarId: number): Promise<unknown> => {
    const response: AxiosResponse<unknown> = await apiClient.post('/admin/inventory/ingest-from-iar', { iar_id: iarId });
    return response.data;
};

export const getInventory = async (id: number): Promise<InventoryResponse> => {
    const response: AxiosResponse<InventoryResponse> = await apiClient.get(`/admin/inventory/${id}`);
    return response.data;
};

export const postIssuance = async (payload: Record<string, unknown>): Promise<unknown> => {
    const response: AxiosResponse<unknown> = await apiClient.post(`/admin/inventory/issuances`, payload);
    return response.data;
};

export const postGenerateQr = async (id: number, force = false): Promise<unknown> => {
    const response: AxiosResponse<unknown> = await apiClient.post(`/admin/inventory/details/${id}/generate-qr`, { force });
    return response.data;
};
