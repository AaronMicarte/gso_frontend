import axios from '@/lib/api/client';
import { PurchaseRequest, CreatePurchaseRequestPayload, UpdatePurchaseRequestPayload } from '@/types/procurement';

interface PurchaseRequestsResponse {
    data: PurchaseRequest[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
}

export const getPurchaseRequests = async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}) => {
    const response = await axios.get<PurchaseRequestsResponse>('/admin/procurement/purchase-requests', { params });

    // Map legacy fields for frontend compatibility
    response.data.data = response.data.data.map(pr => {
        if (pr.details) {
            pr.details = pr.details.map(d => ({
                ...d,
                Quantity: d.QuantityRequested ?? d.Quantity,
                UnitCost: d.EstimatedUnitCost ?? d.UnitCost,
                TotalCost: d.EstimatedTotalCost ?? d.TotalCost,
                UnitOfMeasureID: d.UnitOfMeasureID,
            }));
        }
        return pr;
    });

    return response.data;
};

export const getPurchaseRequest = async (id: number) => {
    const response = await axios.get<PurchaseRequest>(`/admin/procurement/purchase-requests/${id}`);

    // Map legacy fields for frontend compatibility
    if (response.data.details) {
        response.data.details = response.data.details.map(d => ({
            ...d,
            Quantity: d.QuantityRequested ?? d.Quantity,
            UnitCost: d.EstimatedUnitCost ?? d.UnitCost,
            TotalCost: d.EstimatedTotalCost ?? d.TotalCost,
            UnitOfMeasureID: d.UnitOfMeasureID,
        }));
    }

    return response.data;
};

export const createPurchaseRequest = async (data: CreatePurchaseRequestPayload) => {
    const response = await axios.post<PurchaseRequest>('/admin/procurement/purchase-requests', data);
    return response.data;
};

export const updatePurchaseRequest = async (id: number, data: UpdatePurchaseRequestPayload) => {
    const response = await axios.put<PurchaseRequest>(`/admin/procurement/purchase-requests/${id}`, data);
    return response.data;
};

export const deletePurchaseRequest = async (id: number) => {
    await axios.delete(`/admin/procurement/purchase-requests/${id}`);
};

export const approvePurchaseRequest = async (id: number) => {
    const response = await axios.post(`/admin/procurement/purchase-requests/${id}/approve`);
    return response.data;
};

export const rejectPurchaseRequest = async (id: number) => {
    const response = await axios.post(`/admin/procurement/purchase-requests/${id}/reject`);
    return response.data;
};

export const setBudgetCheckedPurchaseRequest = async (id: number) => {
    const response = await axios.post(`/admin/procurement/purchase-requests/${id}/budget-checked`);
    return response.data;
};
