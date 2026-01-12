import apiClient from './client';
import type { QrScanResponse, QrCodeRecord, QrScanAssignedProperty } from '@/types/qr';

export interface QrPropertyListParams {
    per_page?: number;
    search?: string;
    with_qr_only?: boolean;
    missing_qr_only?: boolean;
}

export interface PaginatedLaravelResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export async function fetchQrProperties(params: QrPropertyListParams) {
    const res = await apiClient.get<PaginatedLaravelResponse<QrScanAssignedProperty>>('/qr/properties', {
        params,
    });
    return res.data;
}

export async function generateQrForProperty(propertyId: number) {
    const res = await apiClient.post<{ message: string; qr: QrCodeRecord }>(`/qr/properties/${propertyId}/generate`);
    return res.data;
}

export async function scanProperty(propertyId: number) {
    const res = await apiClient.get<QrScanResponse>(`/qr/scan/${propertyId}`);
    return res.data;
}
