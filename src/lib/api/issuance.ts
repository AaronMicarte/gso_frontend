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
}

interface CreateIssuanceData {
    request_id: number;
    date_issued: string;
    remarks?: string;
    inventory_items: Array<{
        request_detail_id: number;
        inventory_detail_id: number;
        quantity_issued: number;
    }>;
    issuerSignature: string;
    issuerSignatureSource: 'canvas' | 'upload';
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
    // Get all property issuances with filters (now returns grouped data)
    getAll: async (filters?: AssetIssuanceFilters) => {
        const { data } = await apiClient.get<PaginatedResponse<GroupedIssuance>>(
            '/property-issuances',
            { params: filters }
        );
        return data;
    },

    // Get single issuance by ID
    getById: async (id: number) => {
        const { data } = await apiClient.get<AssetIssuance>(`/property-issuances/${id}`);
        return data;
    },

    // Create new issuance following GSO workflow
    create: async (issuanceData: CreateIssuanceData) => {
        const { data } = await apiClient.post<AssetIssuanceResponse>(
            '/property-issuances',
            issuanceData
        );
        return data;
    },

    // Issue assets from approved request (legacy method)
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
    }) => {
        const { data } = await apiClient.get<PaginatedResponse<InventoryItem>>(
            '/property-issuances/available-inventory',
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