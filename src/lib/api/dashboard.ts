import apiClient from '@/lib/api/client';
import { DashboardStatsResponse, RecentActivityResponse } from '@/types/dashboard';

/**
 * Fetch dashboard statistics from the database
 */
export async function getDashboardStats(): Promise<DashboardStatsResponse> {
    const response = await apiClient.get<DashboardStatsResponse>('/dashboard/stats');
    return response.data;
}

/**
 * Fetch recent activity for the dashboard
 */
export async function getRecentActivity(): Promise<RecentActivityResponse> {
    const response = await apiClient.get<RecentActivityResponse>('/dashboard/activity');
    return response.data;
}
