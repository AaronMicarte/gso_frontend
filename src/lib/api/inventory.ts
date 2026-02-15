import apiClient from '@/lib/api/client';
import type { AxiosResponse } from 'axios';

export type InventoryListResponse = {
    data: {
        InventoryID: number;
        InventoryNumber: string;
        DateAcquired: string;
        Remarks?: string;
        Description?: string;
        TotalItems: number;
        TotalValue: number;
        PrimaryStatus?: 'Available' | 'Assigned';
        CurrentCustodianName?: string;
        CurrentLocation?: string;
        LastIssuedDate?: string | null;
        iar?: { IARNumber: string; deliveryReceipt?: { DRNumber: string } };
    }[];
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
};

export type InventoryDetail = {
    InventoryDetailID: number;
    InventoryID: number;
    Description?: string;
    dr_item_description?: string;
    dr_article_name?: string;
    Brand?: string;
    ModelNumber?: string;
    SerialNumber?: string;
    PropertyName?: string;
    PropertyNumber?: string;
    property_type_description?: string;
    ClassificationName?: string;
    DocumentType?: 'ICS' | 'PAR';
    drDetail?: { DRDetailID: number; ItemDescription?: string };
    Quantity: number;
    UnitCost: number;
    TotalCost: number;
    ConditionID?: number;
    PropertyStatusID?: number;
    PropertyTypeID?: number;
    StatusName?: string;
    custodianName?: string;
    locationDepartment?: string;
    lastIssuedDate?: string | null;
    qrCode?: { QRCodeData: string };
};

export type InventoryResponse = {
    InventoryID: number;
    InventoryNumber: string;
    DateAcquired: string;
    Remarks?: string;
    PrimaryStatus?: 'Available' | 'Assigned';
    details?: InventoryDetail[];
    iar?: { IARNumber: string; deliveryReceipt?: { DRNumber: string; SupplierName?: string; DateReceived?: string } };
};
export type PendingIar = { IARID: number; IARNumber: string; DateAccepted: string; details: { IARDetailID: number; QuantityAccepted: number; ItemDescription?: string; VerifiedBrand?: string; VerifiedModel?: string; VerifiedSerial?: string; UnitCost?: number; propertyType?: { PropertyTypeID: number; PropertyName: string } }[]; signatures?: { id: number; role: string; url?: string; created_at: string; user?: { UserID: number; FullName: string } }[] };
export type InventoryItem = { InventoryDetailID: number; InventoryID: number; PropertyTypeID?: number; ConditionID: number; Brand?: string; ModelNumber?: string; SerialNumber?: string; PropertyNumber?: string; Description?: string; Quantity: number; QuantityAvailable: number; PropertyStatusID: number; UnitOfMeasureID?: number; UnitCost?: number; TotalCost?: number; SourceIARDetailID?: number; SourceDRDetailID?: number; Remarks?: string; CreatedDate: string; UpdatedDate?: string; PropertyName?: string; ClassificationName?: string; DocumentType?: 'ICS' | 'PAR'; InventoryNumber?: string; StatusName?: string; ConditionName?: string; dr_item_description?: string; dr_article_name?: string; dr_brand?: string; dr_model?: string; dr_serial?: string; custodianName?: string; locationDepartment?: string; lastIssuedDate?: string | null; qrCodeData?: string | null };
export type InventoryItemsListResponse = { data: InventoryItem[]; total: number; per_page: number; current_page: number; last_page: number };

export const getInventories = async (params?: { page?: number; per_page?: number; search?: string }): Promise<InventoryListResponse> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.append('page', String(params.page));
    if (params?.per_page) qs.append('per_page', String(params.per_page));
    if (params?.search) qs.append('search', params.search);

    const response: AxiosResponse<InventoryListResponse> = await apiClient.get(`/admin/inventory?${qs.toString()}`);
    return response.data;
};

export const getAllInventoryItems = async (params?: { page?: number; per_page?: number; search?: string; property_status_id?: number; property_type_id?: number }): Promise<InventoryItemsListResponse> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.append('page', String(params.page));
    if (params?.per_page) qs.append('per_page', String(params.per_page));
    if (params?.search) qs.append('search', params.search);
    if (params?.property_status_id) qs.append('property_status_id', String(params.property_status_id));
    if (params?.property_type_id) qs.append('property_type_id', String(params.property_type_id));

    const response: AxiosResponse<InventoryItemsListResponse> = await apiClient.get(`/admin/inventory/all-items?${qs.toString()}`);
    return response.data;
};

export const getPendingIngestion = async (): Promise<PendingIar[]> => {
    const response: AxiosResponse<PendingIar[]> = await apiClient.get('/admin/inventory/pending-ingestion');
    return response.data;
};

export const ingestFromIar = async (iarId: number): Promise<unknown> => {
    const response: AxiosResponse<unknown> = await apiClient.post('/admin/inventory/ingest-from-iar', { iar_id: iarId });
    return response.data;
};

export const getInventory = async (id: number): Promise<InventoryResponse> => {
    const response: AxiosResponse<InventoryResponse> = await apiClient.get(`/admin/inventory/${id}`);
    return response.data;
};

export const postIssuance = async (payload: Record<string, unknown>): Promise<unknown> => {
    const response: AxiosResponse<unknown> = await apiClient.post(`/admin/inventory/issuances`, payload);
    return response.data;
};

export const postGenerateQr = async (id: number, force = false): Promise<unknown> => {
    const response: AxiosResponse<unknown> = await apiClient.post(`/admin/inventory/details/${id}/generate-qr`, { force });
    return response.data;
};

export const updateInventoryDetail = async (id: number, data: { Description?: string }): Promise<unknown> => {
    const response: AxiosResponse<unknown> = await apiClient.put(`/admin/inventory/details/${id}`, data);
    return response.data;
};
