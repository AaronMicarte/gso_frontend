import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchQrProperties, updatePropertyCondition, type QrPropertyListParams, type PaginatedLaravelResponse } from '@/lib/api/qr';
import type { QrScanAssignedProperty } from '@/types/qr';

export function useQrProperties(params: QrPropertyListParams & { page?: number }) {
    return useQuery<PaginatedLaravelResponse<QrScanAssignedProperty>>({
        queryKey: ['qr-properties', params],
        queryFn: () => fetchQrProperties(params),
    });
}

export function useUpdatePropertyCondition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ propertyId, conditionId }: { propertyId: number; conditionId: number }) =>
            updatePropertyCondition(propertyId, conditionId),
        onSuccess: () => {
            queryClient.invalidateQueries(['qr-properties']);
        },
    });
}
