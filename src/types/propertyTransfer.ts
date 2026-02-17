export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
export type ReleasingDecision = 'pending' | 'approved' | 'rejected';

export interface TransferDepartment {
    DepartmentID: number;
    DepartmentName: string;
    DepartmentCode?: string | null;
}

export interface TransferEndUser {
    EndUserID: number;
    FullName: string;
    DepartmentID?: number | null;
    DepartmentName?: string | null;
}

export interface TransferUser {
    UserID: number;
    FullName: string;
    DepartmentID?: number | null;
    department?: TransferDepartment | null;
}

export interface TransferInventoryDetail {
    InventoryDetailID: number;
    PropertyNumber?: string | null;
    Description?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
    UnitCost?: number | null;
    unitOfMeasure?: {
        UnitName?: string | null;
    } | null;
    inventory?: {
        InventoryNumber?: string | null;
        DateReceived?: string | null;
        DateAcquired?: string | null;
    } | null;
    drDetail?: {
        ItemDescription?: string | null;
        article?: {
            ArticleName?: string | null;
        } | null;
    } | null;
}

export interface PropertyTransferItem {
    TransferItemID: number;
    TransferID: number;
    InventoryDetailID: number;
    Quantity: number;
    Remarks?: string | null;
    inventoryDetail?: TransferInventoryDetail | null;
}

export interface PropertyTransfer {
    TransferID: number;
    TransferNumber: string;
    RequestedByUserID: number;
    FromDepartmentID: number;
    ToDepartmentID: number;
    FromEndUserID?: number | null;
    ToEndUserID?: number | null;
    Reason?: string | null;
    RequestedItemsCount?: number | null;
    ReleasingDecision?: ReleasingDecision;
    ReleasingApprovedCount?: number | null;
    ReleasingDecisionReason?: string | null;
    ReleasingReviewedByUserID?: number | null;
    ReleasingReviewedAt?: string | null;
    Status: TransferStatus;
    ApprovedByUserID?: number | null;
    ApprovedAt?: string | null;
    CompletedByUserID?: number | null;
    CompletedAt?: string | null;
    BorrowerSignedAt?: string | null;
    BorrowingSignedAt?: string | null;
    GsoNotes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    items?: PropertyTransferItem[];
    items_count?: number;
    requestedBy?: TransferUser | null;
    releasingReviewedBy?: TransferUser | null;
    approvedBy?: TransferUser | null;
    completedBy?: TransferUser | null;
    fromDepartment?: TransferDepartment | null;
    toDepartment?: TransferDepartment | null;
    fromEndUser?: TransferEndUser | null;
    toEndUser?: TransferEndUser | null;
}

export interface TransferableItem {
    PropertyID: number;
    InventoryDetailID: number;
    DepartmentID: number;
    EndUserID: number;
    PropertyCardNumber?: string | null;
    AssignedDescription?: string | null;
    InventoryDescription?: string | null;
    ItemDescription?: string | null;
    ArticleName?: string | null;
    PropertyNumber?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
    UnitCost?: number | null;
    UnitName?: string | null;
    DepartmentName?: string | null;
    EndUserName?: string | null;
}

export interface PropertyTransferCreatePayload {
    from_department_id: number;
    to_department_id: number;
    from_end_user_id: number;
    to_end_user_id: number;
    reason?: string | null;
    items: Array<{
        inventory_detail_id: number;
        quantity: number;
    }>;
}

export interface PropertyTransferCompletePayload {
    borrower_signed_at?: string | null;
    borrowing_signed_at?: string | null;
    notes?: string | null;
}

export interface PropertyTransferActionResponse {
    message: string;
    transfer: PropertyTransfer;
}

export interface PropertyTransferReleasingReviewPayload {
    decision: 'approved' | 'rejected';
    approved_quantities?: Record<number, number>;
    reason?: string | null;
}
