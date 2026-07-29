export type RlsddpStatus = 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed';

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

export interface PropertyRlsddpReport {
    RlsddpID: number;
    RlsddpNumber: string;
    DepartmentID: number;
    AccountableOfficer: string;
    Status: RlsddpStatus;
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
    department?: {
        DepartmentID: number;
        DepartmentName: string;
        DepartmentCode?: string;
    };
    items?: PropertyRlsddpItem[];
    createdBy?: {
        UserID: number;
        FullName: string;
    };
    updatedBy?: {
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
