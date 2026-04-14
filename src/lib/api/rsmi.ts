import type { AxiosResponse } from 'axios';
import apiClient from '@/lib/api/client';
import type { RsmiReport, RsmiReportListItem } from '@/types/rsmi';

export const listRsmiReports = async (params?: { month?: number; year?: number }): Promise<RsmiReportListItem[]> => {
    const response: AxiosResponse<RsmiReportListItem[]> = await apiClient.get('/rsmi-reports', { params });
    return response.data;
};

export const getRsmiReport = async (id: number): Promise<RsmiReport> => {
    const response: AxiosResponse<RsmiReport> = await apiClient.get(`/rsmi-reports/${id}`);
    return response.data;
};
