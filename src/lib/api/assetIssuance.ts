import apiClient from './client';
import {
    AssetRequest,
    AssetIssuance,
    AssetRequestResponse,
    AssetIssuanceResponse,
    PaginatedResponse,
    AssetRequestFilters,
    AssetIssuanceFilters,
    CreateAssetRequestData,
    ReviewAssetRequestData,
    IssueAssetData,
    AcknowledgeAssetData,
    InventoryDetail,
} from '@/types/assetIssuance';

const assetIssuanceAPI = {
    // Asset Requests
    requests: {
        getAll: async (filters?: AssetRequestFilters) => {
            const { data } = await apiClient.get<PaginatedResponse<AssetRequest>>(
                '/asset-requests',
                { params: filters }
            );
            return data;
        },

        getById: async (id: number) => {
            const { data } = await apiClient.get<AssetRequest>(`/asset-requests/${id}`);
            return data;
        },

        create: async (requestData: CreateAssetRequestData) => {
            const { data } = await apiClient.post<AssetRequestResponse>(
                '/asset-requests',
                requestData
            );
            return data;
        },

        approve: async (id: number, reviewData: ReviewAssetRequestData) => {
            const { data } = await apiClient.post<AssetRequestResponse>(
                `/asset-requests/${id}/approve`,
                reviewData
            );
            return data;
        },

        reject: async (id: number, reviewData: Required<ReviewAssetRequestData>) => {
            const { data } = await apiClient.post<AssetRequestResponse>(
                `/asset-requests/${id}/reject`,
                reviewData
            );
            return data;
        },

        cancel: async (id: number) => {
            const { data } = await apiClient.post<AssetRequestResponse>(
                `/asset-requests/${id}/cancel`
            );
            return data;
        },

        getAvailableInventory: async () => {
            const { data } = await apiClient.get<InventoryDetail[]>(
                '/asset-requests/available-inventory'
            );
            return data;
        },
    },

    // Asset Issuances
    issuances: {
        getAll: async (filters?: AssetIssuanceFilters) => {
            const { data } = await apiClient.get<PaginatedResponse<AssetIssuance>>(
                '/asset-issuances',
                { params: filters }
            );
            return data;
        },

        getById: async (id: number) => {
            const { data } = await apiClient.get<AssetIssuance>(`/asset-issuances/${id}`);
            return data;
        },

        create: async (issueData: IssueAssetData) => {
            const { data } = await apiClient.post<AssetIssuanceResponse>(
                '/asset-issuances',
                issueData
            );
            return data;
        },

        acknowledge: async (id: number, ackData: AcknowledgeAssetData) => {
            const { data } = await apiClient.post<AssetIssuanceResponse>(
                `/asset-issuances/${id}/acknowledge`,
                ackData
            );
            return data;
        },

        getByRequest: async (requestId: number) => {
            const { data } = await apiClient.get<AssetIssuance[]>(
                `/asset-issuances/request/${requestId}`
            );
            return data;
        },
    },
};

export default assetIssuanceAPI;
