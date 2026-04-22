import type { AxiosResponse } from 'axios';
import apiClient from '@/lib/api/client';
import type { RsmiReport, RsmiReportListItem } from '@/types/rsmi';

export interface ListRsmiReportsParams {
    month?: number;
    year?: number;
    start_date?: string;
    end_date?: string;
}

export const listRsmiReports = async (params?: ListRsmiReportsParams): Promise<RsmiReportListItem[]> => {
    const response: AxiosResponse<RsmiReportListItem[]> = await apiClient.get('/rsmi-reports', { params });
    return response.data;
};

export const getRsmiReport = async (id: number): Promise<RsmiReport> => {
    const response: AxiosResponse<RsmiReport> = await apiClient.get(`/rsmi-reports/${id}`);
    return response.data;
};
