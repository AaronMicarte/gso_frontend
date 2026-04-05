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
