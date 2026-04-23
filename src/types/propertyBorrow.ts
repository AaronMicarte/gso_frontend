export type BorrowStatus = 'pending' | 'approved' | 'rejected' | 'borrowed' | 'partially_returned' | 'returned' | 'completed' | 'cancelled';
export type BorrowReleasingDecision = 'pending' | 'approved' | 'rejected';

export interface BorrowDepartment {
    DepartmentID: number;
    DepartmentName: string;
    DepartmentCode?: string | null;
}

export interface BorrowEndUser {
    EndUserID: number;
    FullName: string;
    DepartmentID?: number | null;
    DepartmentName?: string | null;
}

export interface BorrowUser {
    UserID: number;
    FullName: string;
    DepartmentID?: number | null;
    department?: BorrowDepartment | null;
}

export interface BorrowInventoryDetail {
    InventoryDetailID: number;
    PropertyNumber?: string | null;
    Description?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
    UnitCost?: number | null;
    propertyType?: {
        PropertyTypeID?: number | null;
        PropertyName?: string | null;
    } | null;
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
            ArticleImage?: string | null;
        } | null;
    } | null;
}

export interface PropertyBorrowItem {
    BorrowItemID: number;
    BorrowID: number;
    InventoryDetailID: number;
    Quantity: number;
    Remarks?: string | null;
    inventoryDetail?: BorrowInventoryDetail | null;
}

export interface PropertyBorrowReturnItem {
    ReturnItemID: number;
    ReturnID: number;
    BorrowItemID: number;
    InventoryDetailID: number;
    QuantityReturned: number;
    ConditionID?: number | null;
    Remarks?: string | null;
    inventoryDetail?: BorrowInventoryDetail | null;
    borrowItem?: PropertyBorrowItem | null;
    condition?: BorrowCondition | null;
}

export interface BorrowCondition {
    ConditionID: number;
    ConditionName: string;
}

export interface PropertyBorrowReturn {
    ReturnID: number;
    ReturnNumber: string;
    BorrowID: number;
    ReturnedByUserID: number;
    ReturnedAt?: string | null;
    Notes?: string | null;
    created_at?: string | null;
    returnedBy?: BorrowUser | null;
    items?: PropertyBorrowReturnItem[];
}

export interface PropertyBorrow {
    BorrowID: number;
    BorrowNumber: string;
    RequestedByUserID: number;
    FromDepartmentID: number;
    ToDepartmentID: number;
    FromEndUserID?: number | null;
    ToEndUserID?: number | null;
    Purpose?: string | null;
    RequestedItemsCount?: number | null;
    DueDate: string;
    ReleasingDecision?: BorrowReleasingDecision;
    ReleasingApprovedCount?: number | null;
    ReleasingDecisionReason?: string | null;
    ReleasingReviewedByUserID?: number | null;
    ReleasingReviewedAt?: string | null;
    Status: BorrowStatus;
    ApprovedByUserID?: number | null;
    ApprovedAt?: string | null;
    BorrowedAt?: string | null;
    GsoNotes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    items?: PropertyBorrowItem[];
    items_count?: number;
    requestedBy?: BorrowUser | null;
    releasingReviewedBy?: BorrowUser | null;
    approvedBy?: BorrowUser | null;
    fromDepartment?: BorrowDepartment | null;
    toDepartment?: BorrowDepartment | null;
    fromEndUser?: BorrowEndUser | null;
    toEndUser?: BorrowEndUser | null;
    returns?: PropertyBorrowReturn[];
}

export interface BorrowableItem {
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
    PropertyTypeID?: number | null;
    PropertyTypeName?: string | null;
    DepartmentName?: string | null;
    EndUserName?: string | null;
}

export interface BorrowAllowedPropertyType {
    PropertyTypeID: number;
    PropertyName: string;
}

export interface PropertyBorrowCreatePayload {
    from_department_id: number;
    to_department_id: number;
    from_end_user_id: number;
    to_end_user_id: number;
    purpose?: string | null;
    due_date: string;
    items: Array<{
        inventory_detail_id: number;
        quantity: number;
    }>;
}

export interface PropertyBorrowReturnPayload {
    notes?: string | null;
    items: Array<{
        borrow_item_id: number;
        quantity: number;
        condition_id?: number | null;
    }>;
}

export interface PropertyBorrowActionResponse {
    message: string;
    borrow: PropertyBorrow;
}

export interface PropertyBorrowReleasingReviewPayload {
    decision: 'approved' | 'rejected';
    approved_quantities?: Record<number, number>;
    reason?: string | null;
}
