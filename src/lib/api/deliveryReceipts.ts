import apiClient from '@/lib/api/client';
import {
    DeliveryReceipt,
    DeliveryReceiptFilters,
} from '@/types/procurement';

export type { DeliveryReceiptFilters };

export const getDeliveryReceipts = async (filters?: DeliveryReceiptFilters): Promise<{
    data: DeliveryReceipt[];
    meta: { total: number; per_page: number; current_page: number; last_page: number };
}> => {
    const params = new URLSearchParams();

    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.supplier_name) params.append('supplier_name', filters.supplier_name);
    if (filters?.po_number) params.append('po_number', filters.po_number);
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());

    const response = await apiClient.get(`/admin/procurement/delivery-receipts?${params.toString()}`);
    // Backend returns { success: true, data: { data: DeliveryReceipt[], meta: { ... } } }
    // Normalize to return the paginated payload directly so callers can use `result.data.map(...)`
    return response.data.data;
};

export const getDeliveryReceipt = async (id: number): Promise<DeliveryReceipt> => {
    const response = await apiClient.get(`/admin/procurement/delivery-receipts/${id}`);
    const deliveryReceipt = response.data.data;
    // Add dr_picture_url from the response if available
    if (response.data.dr_picture_url) {
        deliveryReceipt.dr_picture_url = response.data.dr_picture_url;
    }
    return deliveryReceipt;
};

export const createDeliveryReceipt = async (data: FormData): Promise<DeliveryReceipt> => {
    const response = await apiClient.post('/admin/procurement/delivery-receipts', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    const deliveryReceipt = response.data.data;
    // Add dr_picture_url from the response if available
    if (response.data.dr_picture_url) {
        deliveryReceipt.dr_picture_url = response.data.dr_picture_url;
    }
    return deliveryReceipt;
};

export const updateDeliveryReceipt = async (id: number, data: FormData): Promise<DeliveryReceipt> => {
    // Laravel requires POST with _method=PUT for multipart/form-data updates
    data.append('_method', 'PUT');
    const response = await apiClient.post(`/admin/procurement/delivery-receipts/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    const deliveryReceipt = response.data.data;
    // Add dr_picture_url from the response if available
    if (response.data.dr_picture_url) {
        deliveryReceipt.dr_picture_url = response.data.dr_picture_url;
    }
    return deliveryReceipt;
};

export const deleteDeliveryReceipt = async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/procurement/delivery-receipts/${id}`);
};

export const getSuppliers = async (): Promise<{ SupplierID: number; SupplierName: string }[]> => {
    const response = await apiClient.get('/admin/procurement/delivery-receipts-helpers/suppliers');
    return response.data.data;
};

export const getPropertyTypes = async (): Promise<{ PropertyTypeID: number; PropertyName: string }[]> => {
    const response = await apiClient.get('/admin/procurement/delivery-receipts-helpers/property-types');
    return response.data.data;
};

export const rejectDeliveryReceipt = async (id: number): Promise<DeliveryReceipt> => {
    const response = await apiClient.patch(`/admin/procurement/delivery-receipts/${id}/reject`);
    return response.data.data;
};