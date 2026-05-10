import { keepPreviousData, useQuery, UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';

export interface AuditLog {
    id: number;
    type: string;
    action: string;
    action_key?: string;
    description: string;
    summary?: string;
    entity_label?: string;
    performed_by: string;
    entity_type: string;
    detail_highlights?: string[];
    meta?: Record<string, unknown> | null;
    ip_address?: string | null;
    timestamp: string;
    time_ago: string;
}

export interface PaginationData {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number;
    to: number;
}

export interface ActivityLogsResponse {
    data: AuditLog[];
    pagination: PaginationData;
}

export interface ActivityLogsParams {
    page?: number;
    per_page?: number;
    search?: string;
    entity_type?: string;
    start_date?: string;
    end_date?: string;
}

export function useActivityLogs(params: ActivityLogsParams): UseQueryResult<ActivityLogsResponse> {
    return useQuery({
        queryKey: ['activity-logs', params],
        queryFn: async () => {
            const response = await apiClient.get<ActivityLogsResponse>(
                '/security/activity-logs',
                { params }
            );
            return response.data;
        },
        placeholderData: keepPreviousData,
        staleTime: 30000, // 30 seconds
        gcTime: 10 * 60 * 1000,
    });
}

export function useEntityTypes(): UseQueryResult<{ entity_types: string[] }> {
    return useQuery({
        queryKey: ['entity-types'],
        queryFn: async () => {
            const response = await apiClient.get<{ entity_types: string[] }>(
                '/security/activity-logs/entity-types'
            );
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
