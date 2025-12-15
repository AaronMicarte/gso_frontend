import apiClient from '@/lib/api/client';
import {
    DeliveryReceipt,
    DeliveryReceiptDetail,
    CreateDeliveryReceiptPayload,
    UpdateDeliveryReceiptPayload,
    DeliveryReceiptFilters,
} from '@/types/procurement';

export type { DeliveryReceiptFilters };

export const getDeliveryReceipts = async (filters?: DeliveryReceiptFilters): Promise<{
    data: DeliveryReceipt[];
    meta: { total: number; per_page: number; current_page: number; last_page: number };
}> => {
    const params = new URLSearchParams();

    if (filters?.status) params.append('status', filters.status.toString());
    if (filters?.purchase_order_id) params.append('purchase_order_id', filters.purchase_order_id.toString());
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());

    const response = await apiClient.get(`/delivery-receipts?${params.toString()}`);
    return response.data;
};

export const getDeliveryReceipt = async (id: number): Promise<DeliveryReceipt> => {
    const response = await apiClient.get(`/delivery-receipts/${id}`);
    return response.data.data;
};

export const createDeliveryReceipt = async (data: CreateDeliveryReceiptPayload): Promise<DeliveryReceipt> => {
    const response = await apiClient.post('/delivery-receipts', data);
    return response.data.data;
};

export const updateDeliveryReceipt = async (id: number, data: UpdateDeliveryReceiptPayload): Promise<DeliveryReceipt> => {
    const response = await apiClient.put(`/delivery-receipts/${id}`, data);
    return response.data.data;
};

export const deleteDeliveryReceipt = async (id: number): Promise<void> => {
    await apiClient.delete(`/delivery-receipts/${id}`);
};

export const approveDeliveryReceipt = async (id: number): Promise<DeliveryReceipt> => {
    const response = await apiClient.patch(`/delivery-receipts/${id}/approve`);
    return response.data.data;
};

export const rejectDeliveryReceipt = async (id: number): Promise<DeliveryReceipt> => {
    const response = await apiClient.patch(`/delivery-receipts/${id}/reject`);
    return response.data.data;
};