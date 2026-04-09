import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getPendingInspectionReceipts,
    getInspectionReports,
    getInspectionReport,
    createInspectionReport,
    updateInspectionReport,
    completeInspectionReport,
    getInspectionConditions,
    InspectionReportFilters,
} from '@/lib/api/inspection';
import { ApiError } from '@/types/api';
import { toast } from 'sonner';

export const inspectionKeys = {
    all: ['inspection'] as const,
    pending: (filters?: { per_page?: number; page?: number }) => ['inspection', 'pending', filters] as const,
    reports: (filters?: InspectionReportFilters) => ['inspection', 'reports', filters] as const,
    report: (id: number) => ['inspection', 'report', id] as const,
};

export function usePendingInspectionReceipts(filters?: { per_page?: number; page?: number }) {
    return useQuery({
        queryKey: inspectionKeys.pending(filters),
        queryFn: () => getPendingInspectionReceipts(filters),
        placeholderData: keepPreviousData,
        staleTime: 2 * 60 * 1000,
    });
}

export function useInspectionReports(filters?: InspectionReportFilters) {
    return useQuery({
        queryKey: inspectionKeys.reports(filters),
        queryFn: () => getInspectionReports(filters),
        placeholderData: keepPreviousData,
        staleTime: 2 * 60 * 1000,
    });
}

export function useInspectionReport(id: number) {
    return useQuery({
        queryKey: inspectionKeys.report(id),
        queryFn: () => getInspectionReport(id),
        enabled: !!id,
    });
}

export function useCreateInspectionReport() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createInspectionReport,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: inspectionKeys.pending() });
            queryClient.invalidateQueries({ queryKey: inspectionKeys.reports() });
            queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] });
        },
        onError: (error: Error) => {
            toast.error((error as ApiError).response?.data?.message || 'Failed to save inspection report');
        },
    });
}

export function useUpdateInspectionReport() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateInspectionReport>[1] }) =>
            updateInspectionReport(id, payload),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: inspectionKeys.report(variables.id) });
            queryClient.invalidateQueries({ queryKey: inspectionKeys.pending() });
            queryClient.invalidateQueries({ queryKey: inspectionKeys.reports() });
        },
        onError: (error: Error) => {
            toast.error((error as ApiError).response?.data?.message || 'Failed to update inspection report');
        },
    });
}

export function useCompleteInspectionReport() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => completeInspectionReport(id),
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: inspectionKeys.report(id) });
            queryClient.invalidateQueries({ queryKey: inspectionKeys.pending() });
            queryClient.invalidateQueries({ queryKey: inspectionKeys.reports() });
            queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] });
        },
        onError: (error: Error) => {
            toast.error((error as ApiError).response?.data?.message || 'Failed to complete inspection');
        },
    });
}

export function useInspectionConditions() {
    return useQuery({
        queryKey: ['inspection', 'conditions'],
        queryFn: () => getInspectionConditions(),
        staleTime: 10 * 60 * 1000,
    });
}
