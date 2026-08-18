export type RlsddpStatus = 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed';
export type RlsddpApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface PropertyRlsddpItem {
    RlsddpItemID?: number;
    RlsddpID?: number;
    InventoryDetailID: number;
    PropertyNumber: string;
    AcquisitionCost: number;
    Description: string;
    created_at?: string;
    updated_at?: string;
}

export interface RemovedInventoryItem {
    RlsddpItemID: number;
    RlsddpID: number;
    InventoryDetailID: number;
    PropertyNumber: string;
    AcquisitionCost: number;
    Description: string;
    RlsddpNumber: string;
    RlsddpStatus: string;
    AccountableOfficer: string;
    DepartmentName: string | null;
    removed_at: string;
}

export interface PaginatedRemovedItemsResponse {
    current_page: number;
    data: RemovedInventoryItem[];
    last_page: number;
    per_page: number;
    total: number;
    next_page_url: string | null;
    prev_page_url: string | null;
    from: number | null;
    to: number | null;
}

export interface PropertyRlsddpReport {
    RlsddpID: number;
    RlsddpNumber: string;
    DepartmentID: number;
    AccountableOfficer: string;
    Status: RlsddpStatus;
    ApprovalStatus: RlsddpApprovalStatus;
    RejectionNotes?: string | null;
    RejectedAt?: string | null;
    PoliceNotified: boolean;
    PoliceStation?: string | null;
    DateReported?: string | null;
    Remarks?: string | null;
    CreatedByUserID: number;
    UpdatedByUserID?: number | null;
    created_at: string;
    updated_at: string;
    PARNumber?: string | null;
    PARDate?: string | null;
    ICSNumber?: string | null;
    ICSDate?: string | null;
    DocumentType?: 'PAR' | 'ICS' | null;
    department?: {
        DepartmentID: number;
        DepartmentName: string;
        DepartmentCode?: string;
    };
    items?: PropertyRlsddpItem[];
    removedItems?: PropertyRlsddpItem[];
    createdBy?: {
        UserID: number;
        FullName: string;
    };
    created_by?: {
        UserID: number;
        FullName: string;
    };
    updatedBy?: {
        UserID: number;
        FullName: string;
    };
    updated_by?: {
        UserID: number;
        FullName: string;
    };
}


export interface RlsddpDocument {
    document_number: string;
    document_type: string;
    department_id: number;
    department_name: string;
    accountable_officer: string;
    items: DepartmentAsset[];
}

export interface AccountableOfficerOption {
    name: string;
    label?: string;
    source: string;
    type: string;
}

export interface AccountableOfficersResponse {
    accountable_officers: AccountableOfficerOption[];
    default_officer: string;
    default_source?: string | null;
    default_type?: string | null;
}

export interface DepartmentAsset {
    InventoryDetailID: number;
    ParNumber: string;
    PropertyNumber: string;
    AcquisitionCost: number;
    ArticleName: string;
    ItemDescription: string;
    Brand: string;
    ModelNumber: string;
    SerialNumber: string;
    Description: string;
    SourceDRDetailID?: number | null;
    InventoryID?: number | null;
}

export interface CreateRlsddpPayload {
    DepartmentID: number;
    AccountableOfficer: string;
    Status: RlsddpStatus;
    PoliceNotified: boolean;
    PoliceStation?: string | null;
    DateReported?: string | null;
    Remarks?: string | null;
    items: {
        InventoryDetailID: number;
        PropertyNumber?: string;
        AcquisitionCost?: number;
        Description?: string;
    }[];
}

export interface UpdateRlsddpPayload {
    DepartmentID?: number;
    AccountableOfficer?: string;
    Status?: RlsddpStatus;
    PoliceNotified?: boolean;
    PoliceStation?: string | null;
    DateReported?: string | null;
    Remarks?: string | null;
    items?: {
        InventoryDetailID: number;
        PropertyNumber?: string;
        AcquisitionCost?: number;
        Description?: string;
    }[];
}
