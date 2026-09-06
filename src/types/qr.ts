export interface QrCodeRecord {
    QRCodeID: number;
    PropertyID: number;
    InventoryDetailID?: number | null;
    DepartmentID: number;
    QRCodeData: string | null;
    DateGenerated: string;
}

export interface QrScanIssuedBy {
    UserID: number;
    FullName: string;
}

export interface QrScanIssuance {
    IssuanceID: number;
    DocumentType: string;
    DocumentNumber: string;
    Status: string;
    DateIssued: string;
    Remarks?: string | null;
    AcknowledgedAt?: string | null;
    AcknowledgmentSignature?: string | null;
    AcknowledgmentNotes?: string | null;
    issuedBy?: QrScanIssuedBy | null;
    // Laravel may serialize relations in snake_case depending on configuration.
    issued_by?: QrScanIssuedBy | null;
}

export interface QrScanIssuanceDetail {
    IssuanceDetailID: number;
    IssuanceID: number;
    InventoryDetailID: number;
    QuantityIssued: number;
    issuance?: QrScanIssuance | null;
}

export interface QrScanInventoryDetail {
    InventoryDetailID: number;
    PropertyNumber?: string | null;
    Description?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
    UnitCost?: number | null;
    drDetail?: {
        DRDetailID: number;
        ItemDescription?: string | null;
        article?: {
            ArticleID: number;
            ArticleName: string;
        } | null;
    } | null;
    PropertyName?: string | null;
    ClassificationName?: string | null;
    unitOfMeasure?: {
        UnitName: string;
    } | null;
}

export interface QrScanEndUser {
    EndUserID: number;
    FullName: string;
    DepartmentID: number;
    department?: {
        DepartmentID: number;
        DepartmentName: string;
        DepartmentCode?: string | null;
    } | null;
}

export interface QrScanAssignedProperty {
    PropertyID: number;
    InventoryDetailID: number;
    EndUserID: number;
    DepartmentID: number;
    PropertyCardNumber?: string | null;
    Description?: string | null;
    AssignedDate: string;
    PropertyStatusID: number;
    ConditionID: number;
    Remarks?: string | null;
    CreatedDate?: string | null;
    UpdatedDate?: string | null;
    inventoryDetail?: QrScanInventoryDetail | null;
    endUser?: QrScanEndUser | null;
    department?: {
        DepartmentID: number;
        DepartmentName: string;
        DepartmentCode?: string | null;
    } | null;
    propertyStatus?: {
        PropertyStatusID: number;
        StatusName: string;
    } | null;
    condition?: {
        ConditionID: number;
        ConditionName: string;
    } | null;
    qrCode?: QrCodeRecord | null;
    // the requester's full name (asset request requester) if available from backend
    requester?: string | null;
    // the document type (PAR or ICS) from the latest issuance
    documentType?: string | null;
    // current department head for the accountable department (null when vacant)
    currentDepartmentHead?: string | null;
    // true when the accountable department has no active department head
    departmentHeadVacant?: boolean;
    // display-friendly accountability label from backend
    accountabilityLabel?: string | null;
}

export interface QrScanResponse {
    property: QrScanAssignedProperty;
    latest_issuance_detail?: QrScanIssuanceDetail | null;
}

export interface QrUnassignedInventoryDetail {
    InventoryDetailID: number;
    PropertyNumber?: string | null;
    Description?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
    UnitCost?: number | null;
    UnitName?: string | null;
    PropertyName?: string | null;
    ClassificationName?: string | null;
    ArticleName?: string | null;
    ConditionName?: string | null;
    DateAcquired?: string | null;
    DRNumber?: string | null;
    Supplier?: string | null;
    Status: string;
}

export interface QrLookupResponse {
    success: boolean;
    found: boolean;
    type?: 'assigned' | 'inventory_unassigned';
    property?: QrScanAssignedProperty;
    latest_issuance_detail?: QrScanIssuanceDetail | null;
    inventory_detail?: QrUnassignedInventoryDetail;
    message?: string;
}
