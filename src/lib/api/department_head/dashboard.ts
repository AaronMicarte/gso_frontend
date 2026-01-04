import apiClient from '@/lib/api/client';
import { DepartmentHeadStatsResponse, DepartmentHeadActivityResponse } from '@/types/dashboard';

/**
 * Fetch department head dashboard statistics
 */
export async function getDepartmentHeadStats(): Promise<DepartmentHeadStatsResponse> {
    const response = await apiClient.get<DepartmentHeadStatsResponse>('/department-head/dashboard/stats');
    return response.data;
}

/**
 * Fetch department head recent activities
 */
export async function getDepartmentHeadActivities(): Promise<DepartmentHeadActivityResponse> {
    const response = await apiClient.get<DepartmentHeadActivityResponse>('/department-head/dashboard/activities');
    return response.data;
}