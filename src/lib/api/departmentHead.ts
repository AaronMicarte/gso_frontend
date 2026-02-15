import apiClient from './client';

export interface DepartmentReceivedItem {
    DRDetailID: number;
    ItemDescription?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
    QuantityDelivered: number;
    QuantityAccepted: number;
    DocumentType: 'PAR' | 'ICS' | string | null;
    status: 'pending' | 'inspected' | 'accepted' | 'to_be_issued' | 'issued' | 'acknowledged';
    status_label: string;
}

export interface DepartmentReceivedDr {
    DRID: number;
    DRNumber: string;
    DateReceived?: string | null;
    InspectionStatus?: string | null;
    RequestedBy?: string | null;
    DepartmentName?: string | null;
    IARID?: number | null;
    IARNumber?: string | null;
    IARDateAccepted?: string | null;
    items: DepartmentReceivedItem[];
}

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

const departmentHeadAPI = {
    getReceivedItems: async (filters?: { page?: number; per_page?: number; search?: string }) => {
        const { data } = await apiClient.get<PaginatedResponse<DepartmentReceivedDr>>(
            '/department-head/received-items',
            { params: filters }
        );
        return data;
    },
};

export default departmentHeadAPI;
