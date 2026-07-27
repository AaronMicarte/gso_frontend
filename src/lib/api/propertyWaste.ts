import type { AxiosResponse } from 'axios';
import apiClient from '@/lib/api/client';
import type {
    PropertyWasteDisposalMethod,
    PropertyWasteListResponse,
    PropertyWasteReport,
    PropertyWasteStatus,
    PropertyWasteItemStatus
} from '@/types/propertyWaste';

export interface ListUnserviceableParams {
    per_page?: number;
    page?: number;
    start_date?: string;
    end_date?: string;
    month?: number;
    year?: number;
    asset_type?: 'non_expendable' | 'semi_expendable' | string;
}

/**
 * Fetches the flattened list of unserviceable items from the inventory detail table
 * and maps the flat database values into the structural format expected by the frontend tables.
 */
export const listUnserviceable = async (params?: ListUnserviceableParams): Promise<any> => {
    const response: AxiosResponse = await apiClient.get('/property-unserviceable', { params });

    if (response.data && Array.isArray(response.data.data)) {
        response.data.data = response.data.data.map((row: any) => ({
            PropertyWasteItemID: row.PropertyWasteItemID || null,
            PropertyWasteReportID: row.PropertyWasteReportID || null,
            InventoryDetailID: row.InventoryDetailID,
            PropertyNumber: row.PropertyNumber,
            ItemDescription: row.Particulars,
            ConditionID: 2,
            Status: (row.PropertyWasteItemID ? 'method_selected' : 'pending_method') as PropertyWasteItemStatus,
            marked_at: row.marked_at,
            marked_by_fullname: row.marked_by_fullname,
            DateAcquired: row.DateAcquired || row.DateReceived || row.ParentCreatedDate || null, // Cascades fallback date values
            condition: {
                ConditionID: 2,
                ConditionName: row.ConditionName || 'Unserviceable'
            },
            inventoryDetail: {
                InventoryDetailID: row.InventoryDetailID,
                InventoryID: row.InventoryID,
                PropertyNumber: row.PropertyNumber,
                Description: row.Particulars,
                Quantity: row.Quantity,
                UnitCost: row.UnitCost,
                TotalCost: row.TotalCost,
                drDetail: null
            }
        }));
    }

    return response.data;
};

interface PropertyWasteFilters {
    page?: number;
    per_page?: number;
    search?: string;
    status?: PropertyWasteStatus;
    department_id?: number;
}

type RawPropertyWasteItem = {
    PropertyWasteItemID: number;
    PropertyWasteReportID: number;
    ServiceRecordDetailID?: number | null;
    InventoryDetailID: number;
    PropertyNumber?: string | null;
    ItemDescription?: string | null;
    ConditionID?: number | null;
    DisposalMethodID?: number | null;
    DisposalMethodNote?: string | null;
    Status: PropertyWasteItemStatus;
    disposalMethod?: PropertyWasteDisposalMethod | null;
    disposal_method?: PropertyWasteDisposalMethod | null;
    condition?: {
        ConditionID: number;
        ConditionName: string;
    } | null;
    inventoryDetail?: {
        InventoryDetailID: number;
        PropertyNumber?: string | null;
        Description?: string | null;
        Brand?: string | null;
        ModelNumber?: string | null;
        SerialNumber?: string | null;
        SourceDRDetailID?: number | null;
        drDetail?: {
            DRDetailID: number;
            ArticleID?: number | null;
            ItemDescription?: string | null;
            Brand?: string | null;
            ModelNumber?: string | null;
            SerialNumber?: string | null;
            article?: {
                ArticleID: number;
                ArticleName?: string | null;
            } | null;
        } | null;
        dr_detail?: {
            DRDetailID: number;
            ArticleID?: number | null;
            ItemDescription?: string | null;
            Brand?: string | null;
            ModelNumber?: string | null;
            SerialNumber?: string | null;
            article?: {
                ArticleID: number;
                ArticleName?: string | null;
            } | null;
        } | null;
    } | null;
    inventory_detail?: {
        InventoryDetailID: number;
        PropertyNumber?: string | null;
        Description?: string | null;
        Brand?: string | null;
        ModelNumber?: string | null;
        SerialNumber?: string | null;
        SourceDRDetailID?: number | null;
        drDetail?: {
            DRDetailID: number;
            ArticleID?: number | null;
            ItemDescription?: string | null;
            Brand?: string | null;
            ModelNumber?: string | null;
            SerialNumber?: string | null;
            article?: {
                ArticleID: number;
                ArticleName?: string | null;
            } | null;
        } | null;
        dr_detail?: {
            DRDetailID: number;
            ArticleID?: number | null;
            ItemDescription?: string | null;
            Brand?: string | null;
            ModelNumber?: string | null;
            SerialNumber?: string | null;
            article?: {
                ArticleID: number;
                ArticleName?: string | null;
            } | null;
        } | null;
    } | null;
};

type RawPropertyWasteReport = Omit<PropertyWasteReport, 'items' | 'sourceServiceRecord'> & {
    items: RawPropertyWasteItem[];
    sourceServiceRecord?: PropertyWasteReport['sourceServiceRecord'];
    source_service_record?: PropertyWasteReport['sourceServiceRecord'];
};

const normalizeItem = (item: RawPropertyWasteItem) => {
    const rawInventory = item.inventoryDetail ?? item.inventory_detail ?? null;
    const rawDrDetail = rawInventory?.drDetail ?? rawInventory?.dr_detail ?? null;

    return {
        ...item,
        disposalMethod: item.disposalMethod ?? item.disposal_method ?? null,
        inventoryDetail: rawInventory
            ? {
                ...rawInventory,
                drDetail: rawDrDetail
                    ? {
                        ...rawDrDetail,
                        article: rawDrDetail.article ?? null,
                    }
                    : null,
            }
            : null,
    };
};

const normalizeReport = (report: RawPropertyWasteReport): PropertyWasteReport => ({
    ...report,
    items: (report.items ?? []).map(normalizeItem),
    sourceServiceRecord: report.sourceServiceRecord ?? report.source_service_record ?? null,
});

const normalizeListResponse = (payload: PropertyWasteListResponse): PropertyWasteListResponse => ({
    ...payload,
    data: (payload.data as unknown as RawPropertyWasteReport[]).map(normalizeReport),
});

const propertyWasteApi = {
    async getAll(filters?: PropertyWasteFilters): Promise<PropertyWasteListResponse> {
        const params = new URLSearchParams();
        if (filters?.page) params.append('page', String(filters.page));
        if (filters?.per_page) params.append('per_page', String(filters.per_page));
        if (filters?.search) params.append('search', filters.search);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.department_id) params.append('department_id', String(filters.department_id));

        const response = await apiClient.get(`/property-wastes?${params.toString()}`);
        return normalizeListResponse(response.data);
    },

    async getById(id: number): Promise<PropertyWasteReport> {
        const response = await apiClient.get(`/property-wastes/${id}`);
        return normalizeReport(response.data as RawPropertyWasteReport);
    },

    async update(
        id: number,
        payload: {
            status?: PropertyWasteStatus;
            notes?: string;
            items?: Array<{
                property_waste_item_id: number;
                disposal_method_id?: number | null;
                disposal_method_note?: string | null;
                status?: PropertyWasteItemStatus;
            }>;
        }
    ): Promise<{ message: string; report: PropertyWasteReport }> {
        const response = await apiClient.post(`/property-wastes/${id}`, payload);
        return {
            ...response.data,
            report: normalizeReport(response.data.report as RawPropertyWasteReport),
        };
    },

    async getDisposalMethods(): Promise<PropertyWasteDisposalMethod[]> {
        const response = await apiClient.get('/property-wastes/helpers/disposal-methods');
        return response.data?.data ?? [];
    },
};

export default propertyWasteApi;