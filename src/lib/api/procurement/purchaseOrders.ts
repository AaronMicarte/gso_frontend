import apiClient from '../client';
import {
    PurchaseOrder,
    CreatePurchaseOrderPayload,
    UpdatePurchaseOrderPayload
} from '@/types/procurement';
import { PaginatedResponse } from '@/types/masterData';

export interface PurchaseOrderFilters {
    search?: string;
    status?: number;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export async function getPurchaseOrders(filters?: PurchaseOrderFilters): Promise<PaginatedResponse<PurchaseOrder>> {
    const params = new URLSearchParams();

    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<PaginatedResponse<PurchaseOrder>>(
        `/admin/procurement/purchase-orders?${params.toString()}`
    );
    return response.data;
}

export async function getPurchaseOrder(id: number): Promise<PurchaseOrder> {
    const response = await apiClient.get<PurchaseOrder>(`/admin/procurement/purchase-orders/${id}`);
    return response.data;
}

export async function createPurchaseOrder(data: CreatePurchaseOrderPayload): Promise<PurchaseOrder> {
    const response = await apiClient.post<PurchaseOrder>('/admin/procurement/purchase-orders', data);
    return response.data;
}

export async function updatePurchaseOrder(id: number, data: UpdatePurchaseOrderPayload): Promise<PurchaseOrder> {
    const response = await apiClient.put<PurchaseOrder>(`/admin/procurement/purchase-orders/${id}`, data);
    return response.data;
}

export async function approvePurchaseOrder(id: number): Promise<void> {
    await apiClient.post(`/admin/procurement/purchase-orders/${id}/approve`);
}

export async function rejectPurchaseOrder(id: number): Promise<void> {
    await apiClient.post(`/admin/procurement/purchase-orders/${id}/reject`);
}
