import type { AxiosResponse } from 'axios';
import apiClient from './client';
import type {
    RpcInventoryCondition,
    RpcInventoryCycle,
    RpcInventoryAuditLogPaginated,
    RpcInventoryCyclesResponse,
    RpcInventoryReportResponse,
    RpcInventoryScanPreviewResponse,
    RpcInventoryScansPaginated,
} from '@/types/rpcInventory';

export async function listRpcInventoryCycles() {
    const res: AxiosResponse<RpcInventoryCyclesResponse> = await apiClient.get('/rpc-inventory/cycles');
    return res.data;
}

export async function createCurrentRpcInventoryCycle() {
    const res = await apiClient.post<{ message: string; cycle: RpcInventoryCycle }>('/rpc-inventory/cycles/current');
    return res.data;
}

export async function getRpcInventoryCycleScans(
    cycleId: number,
    params?: { search?: string; type?: 'RPCPPE' | 'RPCSEP'; page?: number; per_page?: number }
) {
    const res: AxiosResponse<RpcInventoryScansPaginated> = await apiClient.get(`/rpc-inventory/cycles/${cycleId}/scans`, {
        params,
    });
    return res.data;
}

export async function previewRpcScan(
    cycleId: number,
    payload: { property_id?: number; inventory_detail_id?: number; property_number?: string; qr_value?: string }
) {
    const res: AxiosResponse<RpcInventoryScanPreviewResponse> = await apiClient.post(
        `/rpc-inventory/cycles/${cycleId}/scan-preview`,
        payload
    );
    return res.data;
}

export async function storeRpcScan(
    cycleId: number,
    payload: {
        property_id?: number;
        inventory_detail_id?: number;
        selected_inventory_detail_ids?: number[];
        condition_id: number;
        quantity_per_count?: number;
        remarks?: string;
    }
) {
    const res = await apiClient.post(`/rpc-inventory/cycles/${cycleId}/scans`, payload);
    return res.data;
}

export async function updateRpcScan(
    scanId: number,
    payload: { condition_id: number; quantity_per_count?: number; remarks?: string | null }
) {
    const res = await apiClient.patch(`/rpc-inventory/scans/${scanId}`, payload);
    return res.data;
}

export async function deleteRpcScan(scanId: number) {
    const res = await apiClient.delete(`/rpc-inventory/scans/${scanId}`);
    return res.data;
}

export async function updateRpcAssetCondition(
    cycleId: number,
    payload: { inventory_detail_id?: number; property_id?: number; condition_id: number }
) {
    const res = await apiClient.post(`/rpc-inventory/cycles/${cycleId}/update-condition`, payload);
    return res.data;
}

export async function listRpcConditions() {
    const res: AxiosResponse<{ data: RpcInventoryCondition[] }> = await apiClient.get('/rpc-inventory/helpers/conditions');
    return res.data.data;
}

export async function getRpcInventoryReport(cycleId: number) {
    const res: AxiosResponse<RpcInventoryReportResponse> = await apiClient.get(`/rpc-inventory/cycles/${cycleId}/report`);
    return res.data;
}

export async function getRpcInventoryCycleAuditLogs(
    cycleId: number,
    params?: { page?: number; per_page?: number }
) {
    const res: AxiosResponse<RpcInventoryAuditLogPaginated> = await apiClient.get(
        `/rpc-inventory/cycles/${cycleId}/audit-logs`,
        { params }
    );
    return res.data;
}

export async function getClosureSummary(cycleId: number) {
    const res = await apiClient.get(`/rpc-inventory/cycles/${cycleId}/closure-summary`);
    return res.data;
}

export async function closeRpcCycle(
    cycleId: number,
    payload: { reason: string; password: string } | string,
    password?: string
) {
    const closeReason = typeof payload === 'object' ? payload.reason : payload;
    const adminPassword = typeof payload === 'object' ? payload.password : (password || '');

    const res = await apiClient.post(`/rpc-inventory/cycles/${cycleId}/close`, {
        close_reason: closeReason,
        password: adminPassword,
    });
    return res.data;
}

export async function getReopenRequest(cycleId: number) {
    const res = await apiClient.post(`/rpc-inventory/cycles/${cycleId}/reopen-request`);
    return res.data;
}

export async function reopenRpcCycle(cycleId: number, payload: { password: string; reason: string }) {
    const res = await apiClient.post(`/rpc-inventory/cycles/${cycleId}/reopen`, {
        password: payload.password,
        reopen_reason: payload.reason,
    });
    return res.data;
}
