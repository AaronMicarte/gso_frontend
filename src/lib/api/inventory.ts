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
        CurrentLocationDepartmentID?: number | null;
        CurrentDepartmentHead?: string | null;
        DepartmentHeadVacant?: boolean;
        AccountabilityLabel?: string | null;
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
    ConditionName?: string;
    PropertyStatusID?: number;
    PropertyTypeID?: number;
    StatusName?: string;
    custodianName?: string;
    locationDepartment?: string;
    locationDepartmentId?: number | null;
    currentDepartmentHead?: string | null;
    departmentHeadVacant?: boolean;
    accountabilityLabel?: string | null;
    lastIssuedDate?: string | null;
    currentBorrowerName?: string | null;
    currentBorrowerDepartment?: string | null;
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
export type InventoryHistoryActor = { id: number; name: string };
export type InventoryHistoryItem = {
    type: string;
    action: string;
    title: string;
    description?: string | null;
    occurred_at: string;
    actor?: InventoryHistoryActor | null;
    meta?: Record<string, unknown> | null;
};
export type InventoryHistoryResponse = { inventory_detail_id: number; history: InventoryHistoryItem[] };
export type PropertyCardRow = {
    date: string | null;
    reference: string | null;
    receipt_qty: number | null;
    issue_qty: number | null;
    office_officer: string | null;
    balance_qty: number;
    amount: number | null;
    remarks: string | null;
    entry_type: string;
    source_type: string;
};
export type PropertyCardResponse = {
    inventory_detail_id: number;
    header: {
        entity_name: string;
        fund_cluster: string;
        property_plant_equipment: string;
        property_number: string | null;
        description: string | null;
        unit_cost: number | null;
        // Optional fields added by backend to surface receiving details
        po_number?: string | null;
        supplier?: string | null;
        date_received?: string | null;
        received_by?: string | null;
    };
    rows: PropertyCardRow[];
};
export type PendingIar = { IARID: number; IARNumber: string; DateAccepted: string; details: { IARDetailID: number; QuantityAccepted: number; ItemDescription?: string; VerifiedBrand?: string; VerifiedModel?: string; VerifiedSerial?: string; UnitCost?: number; propertyType?: { PropertyTypeID: number; PropertyName: string } }[]; signatures?: { id: number; role: string; url?: string; created_at: string; user?: { UserID: number; FullName: string } }[] };
export type InventoryItem = { InventoryDetailID: number; InventoryID: number; PropertyTypeID?: number; ConditionID: number; Brand?: string; ModelNumber?: string; SerialNumber?: string; PropertyNumber?: string; Description?: string; Quantity: number; QuantityAvailable: number; PropertyStatusID: number; UnitOfMeasureID?: number; UnitCost?: number; TotalCost?: number; SourceIARDetailID?: number; SourceDRDetailID?: number; Remarks?: string; CreatedDate: string; UpdatedDate?: string; PropertyName?: string; ClassificationName?: string; DocumentType?: 'ICS' | 'PAR'; InventoryNumber?: string; StatusName?: string; ConditionName?: string; dr_item_description?: string; dr_article_name?: string; dr_brand?: string; dr_model?: string; dr_serial?: string; custodianName?: string; locationDepartment?: string; locationDepartmentId?: number | null; currentDepartmentHead?: string | null; departmentHeadVacant?: boolean; accountabilityLabel?: string | null; lastIssuedDate?: string | null; currentBorrowerName?: string | null; currentBorrowerDepartment?: string | null; qrCodeData?: string | null };
export type InventoryItemsListResponse = { 
    data: InventoryItem[]; 
    total: number; 
    per_page: number; 
    current_page: number; 
    last_page: number; 
    stats?: { 
        total: number;
        available: number; 
        issued: number; 
        other: number; 
    }; 
};

export const getInventories = async (params?: { page?: number; per_page?: number; search?: string; sort_by?: 'date' | 'inventory_number'; sort_dir?: 'asc' | 'desc' }): Promise<InventoryListResponse> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.append('page', String(params.page));
    if (params?.per_page) qs.append('per_page', String(params.per_page));
    if (params?.search) qs.append('search', params.search);
    if (params?.sort_by) qs.append('sort_by', params.sort_by);
    if (params?.sort_dir) qs.append('sort_dir', params.sort_dir);

    const response: AxiosResponse<InventoryListResponse> = await apiClient.get(`/inventory?${qs.toString()}`);
    return response.data;
};

export const getAllInventoryItems = async (params?: { page?: number; per_page?: number; search?: string; property_status_id?: number; property_type_id?: number; document_type?: 'PAR' | 'ICS'; display_mode?: 'individual' | 'combined' }): Promise<InventoryItemsListResponse> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.append('page', String(params.page));
    if (params?.per_page) qs.append('per_page', String(params.per_page));
    if (params?.search) qs.append('search', params.search);
    if (params?.property_status_id) qs.append('property_status_id', String(params.property_status_id));
    if (params?.property_type_id) qs.append('property_type_id', String(params.property_type_id));
    if (params?.document_type) qs.append('document_type', params.document_type);
    if (params?.display_mode) qs.append('display_mode', params.display_mode);

    const response: AxiosResponse<InventoryItemsListResponse> = await apiClient.get(`/inventory/all-items?${qs.toString()}`);
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
    const response: AxiosResponse<InventoryResponse> = await apiClient.get(`/inventory/${id}`);
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

export type InventoryDetailEditData = {
    Description?: string;
    Brand?: string;
    ModelNumber?: string;
    SerialNumber?: string;
    Condition?: string;
};

export const updateInventoryDetail = async (id: number, data: InventoryDetailEditData): Promise<unknown> => {
    const response: AxiosResponse<unknown> = await apiClient.put(`/inventory/details/${id}`, data);
    return response.data;
};

export const getInventoryDetailHistory = async (id: number): Promise<InventoryHistoryResponse> => {
    const response: AxiosResponse<InventoryHistoryResponse> = await apiClient.get(`/inventory/details/${id}/history`);
    return response.data;
};

export const getInventoryPropertyCard = async (id: number): Promise<PropertyCardResponse> => {
    const response: AxiosResponse<PropertyCardResponse> = await apiClient.get(`/inventory/details/${id}/property-card`);
    return response.data;
};
