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

    if (filters?.query) params.append('query', filters.query);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.supplier_id) params.append('supplier_id', String(filters.supplier_id));
    if (filters?.supplier_name) params.append('supplier_name', filters.supplier_name);
    if (filters?.po_number) params.append('po_number', filters.po_number);
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.status) params.append('status', filters.status);

    const response = await apiClient.get(`/procurement/delivery-receipts?${params.toString()}`);
    const payload = response.data?.data;

    // Backend returns a Laravel paginator object where pagination fields live at root,
    // while UI expects { data, meta }. Normalize both shapes defensively.
    const rows: DeliveryReceipt[] = Array.isArray(payload)
        ? payload
        : (payload?.data ?? []);

    const currentPage = Number(payload?.current_page ?? payload?.meta?.current_page ?? filters?.page ?? 1);
    const perPage = Number(payload?.per_page ?? payload?.meta?.per_page ?? filters?.per_page ?? rows.length ?? 0);
    const total = Number(payload?.total ?? payload?.meta?.total ?? rows.length);
    const lastPage = Number(payload?.last_page ?? payload?.meta?.last_page ?? 1);

    return {
        data: rows,
        meta: {
            total,
            per_page: perPage,
            current_page: currentPage,
            last_page: lastPage,
        },
    };
};

export const getDeliveryReceipt = async (id: number): Promise<DeliveryReceipt> => {
    const response = await apiClient.get(`/procurement/delivery-receipts/${id}`);
    const deliveryReceipt = response.data.data;
    if (response.data.dr_picture_url) {
        deliveryReceipt.dr_picture_url = response.data.dr_picture_url;
    }
    return deliveryReceipt;
};

export const createDeliveryReceipt = async (data: FormData): Promise<DeliveryReceipt> => {
    const response = await apiClient.post('/procurement/delivery-receipts', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    const deliveryReceipt = response.data.data;
    if (response.data.dr_picture_url) {
        deliveryReceipt.dr_picture_url = response.data.dr_picture_url;
    }
    return deliveryReceipt;
};

export const updateDeliveryReceipt = async (id: number, data: FormData): Promise<DeliveryReceipt> => {
    // Laravel requires POST with _method=PUT for multipart/form-data updates
    data.append('_method', 'PUT');
    const response = await apiClient.post(`/procurement/delivery-receipts/${id}`, data, {
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
    await apiClient.delete(`/procurement/delivery-receipts/${id}`);
};

export const getSuppliers = async (): Promise<{ SupplierID: number; SupplierName: string }[]> => {
    const response = await apiClient.get('/procurement/delivery-receipts-helpers/suppliers');
    return response.data.data;
};

export const getPropertyTypes = async (): Promise<{ PropertyTypeID: number; PropertyName: string }[]> => {
    const response = await apiClient.get('/procurement/delivery-receipts-helpers/property-types');
    return response.data.data;
};

export const getDeliveryReceiptRequesters = async (filters?: { department_id?: number }): Promise<{ UserID: number; FullName: string; DepartmentID: number; DepartmentName?: string | null }[]> => {
    const params = new URLSearchParams();
    if (filters?.department_id) params.append('department_id', String(filters.department_id));
    const response = await apiClient.get(`/procurement/delivery-receipts-helpers/requesters?${params.toString()}`);
    return response.data.data;
};

export const rejectDeliveryReceipt = async (id: number): Promise<DeliveryReceipt> => {
    const response = await apiClient.patch(`/procurement/delivery-receipts/${id}/reject`);
    return response.data.data;
};

export const getUsedSerialNumbers = async (excludeDrId?: number): Promise<string[]> => {
    const params = new URLSearchParams();
    if (excludeDrId) params.append('exclude_dr_id', String(excludeDrId));
    const response = await apiClient.get(`/procurement/delivery-receipts-helpers/used-serials?${params.toString()}`);
    return response.data.data || [];
};

export const addDeliveryReceiptItems = async (
    id: number,
    details: Record<string, unknown>[],
    finalizeDr: boolean = false
): Promise<DeliveryReceipt> => {
    const response = await apiClient.post(`/procurement/delivery-receipts/${id}/add-items`, {
        details,
        finalize_dr: finalizeDr,
    });
    return response.data.data;
};

export const finalizeDeliveryReceipt = async (id: number): Promise<DeliveryReceipt> => {
    const response = await apiClient.post(`/procurement/delivery-receipts/${id}/finalize`);
    return response.data.data;
};