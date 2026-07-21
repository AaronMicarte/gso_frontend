import { keepPreviousData, useQuery, UseQueryResult } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';

export interface LoginAuditLog {
    id: number;
    type: string;
    status: string;
    performed_by: string;
    username: string;
    ip_address: string;
    timestamp: string;
    time_ago: string;
    status_badge: {
        bgClass: string;
        label: string;
        icon: string;
    };
}

export interface PaginationData {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number;
    to: number;
}

export interface LoginAuditsResponse {
    data: LoginAuditLog[];
    pagination: PaginationData;
}

export interface LoginAuditsParams {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
}

export function useLoginAudits(params: LoginAuditsParams): UseQueryResult<LoginAuditsResponse> {
    return useQuery({
        queryKey: ['login-audits', params],
        queryFn: async () => {
            const response = await apiClient.get<LoginAuditsResponse>(
                '/security/login-audit',
                { params }
            );
            return response.data;
        },
        placeholderData: keepPreviousData,
        staleTime: 30000, // 30 seconds
        gcTime: 10 * 60 * 1000,
    });
}

export function useLoginStatuses(): UseQueryResult<{ statuses: string[] }> {
    return useQuery({
        queryKey: ['login-statuses'],
        queryFn: async () => {
            const response = await apiClient.get<{ statuses: string[] }>(
                '/security/login-audit/statuses'
            );
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
