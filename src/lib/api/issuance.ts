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

const issuanceAPI = {
    // Get all property issuances with filters
    getAll: async (filters?: AssetIssuanceFilters) => {
        const { data } = await apiClient.get<PaginatedResponse<AssetIssuance>>(
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

    // Issue assets from approved request
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

    // Generate PAR/ICS document
    generateDocument: async (id: number, type: 'PAR' | 'ICS') => {
        const response = await apiClient.get(`/property-issuances/${id}/document/${type}`, {
            responseType: 'json'
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