import apiClient from './client';
import {
    AssetIssuance,
    AssetIssuanceResponse,
    PaginatedResponse,
    AssetIssuanceFilters,
    IssueAssetData,
    AcknowledgeAssetData,
    AssetRequest
} from '@/types/assetIssuance';

interface InventoryItem {
    InventoryDetailID: number;
    Description: string;
    Brand?: string;
    ModelNumber?: string;
    PropertyNumber?: string;
    SerialNumber?: string;
    UnitCost: number;
    IsAvailable: boolean;
    PropertyName?: string;
    UnitName?: string;
    inventory?: {
        InventoryNumber: string;
        DateReceived: string;
    };
    DRID?: number | null;
    DRNumber?: string | null;
    RequestedBy?: string | null;
    DepartmentName?: string | null;
    DocumentType?: 'PAR' | 'ICS' | null;
}

interface DeliveryReceiptForIssuance {
    DRID: number;
    DRNumber: string;
    RequestedBy?: string | null;
    DepartmentID?: number | null;
    DepartmentName?: string | null;
    DateReceived?: string | null;
    InspectionStatus?: 'pending' | 'inspected' | null;
    IARID?: number | null;
    IARNumber?: string | null;
    IARDateAccepted?: string | null;
    IARAcceptedBy?: number | null;
    IsAccepted?: number | boolean | null;
    AvailableItems?: number;
}

interface CreateIssuanceData {
    request_id?: number;
    dr_id?: number;
    date_issued: string;
    remarks?: string;
    inventory_items: Array<{
        request_detail_id?: number;
        inventory_detail_id: number;
        quantity_issued: number;
    }>;
    issuerSignature?: string;
    issuerSignatureSource?: 'canvas' | 'upload';
}

interface GroupedIssuance {
    RequestID: number;
    RequestNumber: string;
    RequestDate: string;
    requester: {
        FullName: string;
        Department: string;
    };
    department: {
        DepartmentName: string;
    };
    issuances: AssetIssuance[];
    totalItems: number;
    isExpanded?: boolean;
}

const issuanceAPI = {
    getAll: async (filters?: AssetIssuanceFilters) => {
        const { data } = await apiClient.get<PaginatedResponse<GroupedIssuance>>(
            '/property-issuances',
            { params: filters }
        );
        return data;
    },

    getById: async (id: number) => {
        const { data } = await apiClient.get<AssetIssuance>(`/property-issuances/${id}`);
        return data;
    },

    create: async (issuanceData: CreateIssuanceData) => {
        const { data } = await apiClient.post<import('@/types/assetIssuance').AssetIssuanceCreateResponse>(
            '/property-issuances',
            issuanceData
        );
        return data;
    },

    issueFromRequest: async (requestId: number, issuanceData: IssueAssetData) => {
        const { data } = await apiClient.post<AssetIssuanceResponse>(
            `/asset-requests/${requestId}/issue`,
            issuanceData
        );
        return data;
    },

    // Acknowledge receipt of issued asset
    acknowledge: async (id: number, acknowledgmentData: AcknowledgeAssetData) => {
        const { data } = await apiClient.post<AssetIssuanceResponse>(
            `/property-issuances/${id}/acknowledge`,
            acknowledgmentData
        );
        return data;
    },

    // Acknowledge inspected IAR to ingest inventory
    acknowledgeInspection: async (payload: { dr_id?: number; iar_id?: number }) => {
        const { data } = await apiClient.post<{
            message: string;
            data?: {
                DRID: number;
                issuances_created: number;
                ris_id?: number;
                ris_number?: string;
            };
        }>(
            '/property-issuances/acknowledge-iar',
            payload
        );
        return data;
    },

    // Ensure issuances exist for inspected DRs (for pre-printing PAR/ICS)
    ensureIssuances: async (payload: { dr_id?: number; iar_id?: number }) => {
        const { data } = await apiClient.post<{
            message: string;
            data: {
                DRID: number;
                IARID?: number;
                issuances_by_document_type: {
                    PAR?: {
                        IssuanceID: number;
                        DocumentType?: 'PAR' | 'ICS' | string | null;
                        DocumentNumber?: string | null;
                        Status?: string | null;
                    } | null;
                    ICS?: {
                        IssuanceID: number;
                        DocumentType?: 'PAR' | 'ICS' | string | null;
                        DocumentNumber?: string | null;
                        Status?: string | null;
                    } | null;
                };
                items_by_document_type?: {
                    PAR?: Array<{
                        DRDetailID: number;
                        ItemDescription?: string | null;
                        Brand?: string | null;
                        ModelNumber?: string | null;
                        SerialNumber?: string | null;
                        QuantityAccepted?: number | null;
                        DocumentType?: string | null;
                    }>;
                    ICS?: Array<{
                        DRDetailID: number;
                        ItemDescription?: string | null;
                        Brand?: string | null;
                        ModelNumber?: string | null;
                        SerialNumber?: string | null;
                        QuantityAccepted?: number | null;
                        DocumentType?: string | null;
                    }>;
                };
            };
        }>(
            '/property-issuances/ensure-issuances',
            payload
        );
        return data;
    },

    // Get approved requests ready for issuance
    getApprovedRequests: async (filters?: { per_page?: number; page?: number }) => {
        const { data } = await apiClient.get<{ data: AssetRequest[]; message: string; total: number }>(
            '/asset-requests/approved',
            { params: filters }
        );
        return data;
    },

    // Get requests ready for issuance (new GSO endpoint)
    getRequestsForIssuance: async (filters?: { per_page?: number; page?: number }) => {
        const { data } = await apiClient.get<PaginatedResponse<AssetRequest>>(
            '/property-issuances/requests-for-issuance',
            { params: filters }
        );
        return data;
    },

    // Get available inventory items for issuance selection
    getAvailableInventory: async (filters?: {
        per_page?: number;
        page?: number;
        search?: string;
        property_type?: number;
        dr_id?: number;
    }) => {
        const { data } = await apiClient.get<PaginatedResponse<InventoryItem>>(
            '/property-issuances/available-inventory',
            { params: filters }
        );
        return data;
    },

    // Get delivery receipts that have available inventory items for issuance
    getDeliveryReceiptsForIssuance: async (filters?: { per_page?: number; page?: number; search?: string }) => {
        const { data } = await apiClient.get<PaginatedResponse<DeliveryReceiptForIssuance>>(
            '/property-issuances/delivery-receipts',
            { params: filters }
        );
        return data;
    },

    // Generate PAR/ICS document
    generateDocument: async (id: number, type: 'PAR' | 'ICS') => {
        const response = await apiClient.get(`/property-issuances/${id}/document/${type}`, {
            responseType: 'blob'
        });
        return response.data;
    },

    // Assign receivers for issuance items
    getAssignments: async (id: number) => {
        const { data } = await apiClient.get(`/property-issuances/${id}/assignments`);
        return data;
    },

    getReceiverSuggestions: async (query?: string) => {
        const { data } = await apiClient.get<{ data: Array<{ receiver_name: string; position_office?: string | null }> }>(
            '/property-issuances/receiver-suggestions',
            { params: query ? { query } : undefined }
        );
        return data;
    },

    saveAssignments: async (id: number, payload: { assignments: Array<{ issuance_detail_id: number; receiver_name: string; position_office?: string; quantity: number; }> }) => {
        const { data } = await apiClient.post(`/property-issuances/${id}/assignments`, payload);
        return data;
    },

    // Get issuance statistics
    getStats: async () => {
        const { data } = await apiClient.get('/property-issuances/stats');
        return data;
    },

    // Return issued asset
    returnAsset: async (id: number, returnData: { notes?: string }) => {
        const { data } = await apiClient.post<AssetIssuanceResponse>(
            `/property-issuances/${id}/return`,
            returnData
        );
        return data;
    },

    // Dispose of asset
    disposeAsset: async (id: number, disposeData: { notes: string }) => {
        const { data } = await apiClient.post<AssetIssuanceResponse>(
            `/property-issuances/${id}/dispose`,
            disposeData
        );
        return data;
    }
};

export default issuanceAPI;