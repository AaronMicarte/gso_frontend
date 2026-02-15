import apiClient from '@/lib/api/client';
import {
    InspectionPendingReceipt,
    InspectionReport,
    CreateInspectionReportPayload,
    UpdateInspectionReportPayload,
    InspectionReportFilters,
} from '@/types/inspection';

export type InspectionCondition = {
    ConditionID: number;
    ConditionName: string;
    Description?: string | null;
};

export type { InspectionReportFilters };

export type PagedResponse<T> = {
    data: T[];
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
};

export const getPendingInspectionReceipts = async (filters?: { per_page?: number; page?: number }): Promise<PagedResponse<InspectionPendingReceipt>> => {
    const params = new URLSearchParams();
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    const response = await apiClient.get(`/inspection/pending-items?${params.toString()}`);
    return response.data.data;
};

export const getInspectionReports = async (filters?: InspectionReportFilters): Promise<PagedResponse<InspectionReport>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    const response = await apiClient.get(`/inspection/reports?${params.toString()}`);
    return response.data.data;
};

export const getInspectionReport = async (id: number): Promise<InspectionReport> => {
    const response = await apiClient.get(`/inspection/reports/${id}`);
    return response.data.data;
};

export const createInspectionReport = async (payload: CreateInspectionReportPayload): Promise<InspectionReport> => {
    const response = await apiClient.post('/inspection/reports', payload);
    return response.data.data;
};

export const updateInspectionReport = async (id: number, payload: UpdateInspectionReportPayload): Promise<InspectionReport> => {
    const response = await apiClient.patch(`/inspection/reports/${id}`, payload);
    return response.data.data;
};

export const completeInspectionReport = async (id: number): Promise<InspectionReport> => {
    const response = await apiClient.post(`/inspection/reports/${id}/complete`);
    return response.data.data;
};

export const getInspectionConditions = async (): Promise<InspectionCondition[]> => {
    const response = await apiClient.get('/inspection/conditions');
    return response.data.data;
};
