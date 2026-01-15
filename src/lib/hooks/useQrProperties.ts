import { useQuery } from '@tanstack/react-query';
import { fetchQrProperties, type QrPropertyListParams, type PaginatedLaravelResponse } from '@/lib/api/qr';
import type { QrScanAssignedProperty } from '@/types/qr';

export function useQrProperties(params: QrPropertyListParams & { page?: number }) {
    return useQuery<PaginatedLaravelResponse<QrScanAssignedProperty>>({
        queryKey: ['qr-properties', params],
        queryFn: () => fetchQrProperties(params),
    });
}
