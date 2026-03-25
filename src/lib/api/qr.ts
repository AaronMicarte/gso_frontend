import apiClient from './client';
import type { QrScanResponse, QrCodeRecord, QrScanAssignedProperty } from '@/types/qr';

export interface QrPropertyListParams {
    page?: number;
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

interface LaravelResourceMeta {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
}

type QrPropertiesApiResponse<T> =
    | PaginatedLaravelResponse<T>
    | {
        data: T[];
        meta?: LaravelResourceMeta;
    };

function normalizePaginatedResponse<T>(payload: QrPropertiesApiResponse<T>): PaginatedLaravelResponse<T> {
    const meta = 'meta' in payload ? payload.meta : undefined;

    const currentPage =
        ('current_page' in payload && typeof payload.current_page === 'number' ? payload.current_page : undefined)
        ?? (typeof meta?.current_page === 'number' ? meta.current_page : undefined)
        ?? 1;

    const perPage =
        ('per_page' in payload && typeof payload.per_page === 'number' ? payload.per_page : undefined)
        ?? (typeof meta?.per_page === 'number' ? meta.per_page : undefined)
        ?? payload.data.length
        ?? 0;

    const total =
        ('total' in payload && typeof payload.total === 'number' ? payload.total : undefined)
        ?? (typeof meta?.total === 'number' ? meta.total : undefined)
        ?? payload.data.length
        ?? 0;

    const lastPage =
        ('last_page' in payload && typeof payload.last_page === 'number' ? payload.last_page : undefined)
        ?? (typeof meta?.last_page === 'number' ? meta.last_page : undefined)
        ?? Math.max(1, Math.ceil(total / Math.max(1, perPage)));

    return {
        data: payload.data,
        current_page: currentPage,
        last_page: lastPage,
        per_page: perPage,
        total,
    };
}

export async function fetchQrProperties(params: QrPropertyListParams) {
    const res = await apiClient.get<QrPropertiesApiResponse<QrScanAssignedProperty>>('/qr/properties', {
        params,
    });
    return normalizePaginatedResponse(res.data);
}

export async function generateQrForProperty(propertyId: number) {
    const res = await apiClient.post<{ message: string; qr: QrCodeRecord }>(`/qr/properties/${propertyId}/generate`);
    return res.data;
}

export async function scanProperty(propertyId: number) {
    const res = await apiClient.get<QrScanResponse>(`/qr/scan/${propertyId}`);
    return res.data;
}

export async function updatePropertyCondition(propertyId: number, conditionId: number) {
    const res = await apiClient.put(`/qr/properties/${propertyId}`, { condition_id: conditionId });
    return res.data;
}
