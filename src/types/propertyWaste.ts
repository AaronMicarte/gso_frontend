export type PropertyWasteStatus = 'draft' | 'for_approval' | 'approved' | 'completed' | 'cancelled';
export type PropertyWasteItemStatus = 'pending_method' | 'method_selected' | 'for_disposal' | 'disposed';

export interface PropertyWasteDisposalMethod {
    DisposalMethodID: number;
    MethodName: string;
    Description?: string | null;
    IconKey?: string | null;
}

export interface PropertyWasteItem {
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
    } | null;
}

export interface PropertyWasteReport {
    PropertyWasteReportID: number;
    WasteNumber: string;
    SourceServiceRecordID?: number | null;
    DepartmentID?: number | null;
    Status: PropertyWasteStatus;
    Notes?: string | null;
    items: PropertyWasteItem[];
    sourceServiceRecord?: {
        ServiceRecordID: number;
        ServiceNumber: string;
        Status: string;
    } | null;
    department?: {
        DepartmentID: number;
        DepartmentName?: string | null;
        DepartmentCode?: string | null;
    } | null;
    created_at?: string;
    updated_at?: string;
}

export interface PropertyWasteListResponse {
    data: PropertyWasteReport[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}
// types/unserviceable.ts
export type UnserviceableItemRow = {
    id: number;
    dateAcquired?: string | null;
    particulars?: string | null;
    propertyNumber?: string | null;
    quantity?: number | null;
    unitCost?: number | null;
    totalCost?: number | null;
    markedAt?: string | null;
    markedBy?: string | null;
};
