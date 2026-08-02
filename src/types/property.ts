/**
 * Property Management Types
 * Based on GSO database schema
 */

// ============================================
// LEGACY TYPES (PascalCase - for Property/Procurement system)
// ============================================

export interface Supplier {
    SupplierID: number;
    SupplierName: string;
    ContactPerson?: string;
    Address?: string;
    ContactNumber?: string;
    Email?: string;
    TIN?: string;
    IsActive: boolean;
    CreatedDate: string;
    UpdatedDate?: string;
}

export interface UnitOfMeasure {
    UnitOfMeasureID: number;
    UnitName: string;
    Description?: string;
}

export interface Category {
    id: number;
    name: string;
    description?: string | null;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface CategoryInput {
    name: string;
    description?: string;
}

// ============================================
// PROPERTY INVENTORY
// ============================================

export interface PropertyInventory {
    InventoryID: number;
    PropertyCode: string;
    PropertyTypeID: number;
    Description: string;
    Quantity: number;
    UnitOfMeasureID: number;
    UnitCost: number;
    TotalCost: number;
    AcquisitionDate: string; // ISO date string
    PropertyStatusID: number;
    LocationID?: number;
    Remarks?: string;
    CreatedBy: number;
    CreatedDate: string;
    UpdatedDate?: string;
    // Relations
    PropertyType?: PropertyType;
    PropertyStatus?: PropertyStatus;
    UnitOfMeasure?: UnitOfMeasure;
}

export interface PropertyInventoryDetail {
    InventoryDetailID: number;
    InventoryID: number;
    SerialNumber?: string;
    ModelNumber?: string;
    ConditionID: number;
    PropertyClassificationID: number;
    Remarks?: string;
    CreatedDate: string;
    UpdatedDate?: string;
    // Relations
    Condition?: Condition;
    PropertyClassification?: PropertyClassification;
}

// ============================================
// PROPERTY TYPES & CLASSIFICATIONS
// ============================================

export interface PropertyType {
    PropertyTypeID: number;
    PropertyName: string;
    CategoryID: number;
    ClassificationID: number;
    PropertyClassificationID: number;
    Description?: string;
    CreatedDate: string;
    UpdatedDate?: string;
    // Relations
    Category?: Category;
    Classification?: Classification;
    PropertyClassification?: PropertyClassification;
}

export interface Classification {
    ClassificationID: number;
    ClassificationName: string;
    CategoryID: number;
    Description?: string;
    CreatedDate: string;
    UpdatedDate?: string;
}

export interface PropertyClassification {
    PropertyClassificationID: number;
    ClassificationName: string;
    Description?: string;
    DocumentType?: 'ICS' | 'PAR'; // Semi-Expendable or PPE
}

export interface Condition {
    ConditionID: number;
    ConditionName: string;
    Description?: string;
}

export interface PropertyStatus {
    PropertyStatusID: number;
    StatusName: string;
    Description?: string;
}

// ============================================
// PROCUREMENT (SIMPLIFIED - Starting from Delivery Receipt)
// Note: Purchase Requests and Purchase Orders removed per project requirements
// ============================================

export interface DeliveryReceipt {
    DRID: number;
    DRNumber: string;
    IARNumber?: string; // Auto-generated IAR reference
    PONumber?: string; // Manual PO reference (optional)
    DeliveryDate: string;
    SupplierName?: string; // Manual supplier name (optional)
    ReceivedBy: number;
    Remarks?: string;
    CreatedDate: string;
    // Relations
    ReceivedByUser?: User;
    Details?: DeliveryReceiptDetail[];
}

export interface DeliveryReceiptDetail {
    DRDetailID: number;
    DRID: number;
    PropertyTypeID: number;
    ItemDescription: string;
    QuantityDelivered: number;
    UnitOfMeasureID: number;
    UnitCost: number;
    TotalCost: number;
    // Relations
    PropertyType?: PropertyType;
    UnitOfMeasure?: UnitOfMeasure;
}

export interface InspectionAcceptanceReport {
    IARID: number;
    IARNumber: string;
    DRID: number;
    InspectionDate: string;
    InspectedBy: number;
    AcceptedBy: number;
    Remarks?: string;
    CreatedDate: string;
    // Relations
    DeliveryReceipt?: DeliveryReceipt;
    InspectedByUser?: User;
    AcceptedByUser?: User;
    Details?: IARDetail[];
}

export interface IARDetail {
    IARDetailID: number;
    IARID: number;
    DRDetailID: number;
    PropertyTypeID: number;
    QuantityAccepted: number;
    ConditionID: number;
    Remarks?: string;
    // Relations
    PropertyType?: PropertyType;
    Condition?: Condition;
}

// ============================================
// ISSUANCE & ASSIGNMENT
// ============================================

export interface PropertyIssuance {
    IssuanceID: number;
    IssuanceDate: string;
    DepartmentID: number;
    IssuedTo: number;
    Remarks?: string;
    CreatedDate: string;
    // Relations
    Department?: Department;
    IssuedToUser?: User;
    Details?: PropertyIssuanceDetail[];
}

export interface PropertyIssuanceDetail {
    IssuanceDetailID: number;
    IssuanceID: number;
    InventoryDetailID: number;
    Remarks?: string;
    // Relations
    InventoryDetail?: PropertyInventoryDetail;
}

export interface AssignedProperty {
    PropertyID: number;
    InventoryDetailID: number;
    EndUserID: number;
    DepartmentID: number;
    AssignedDate: string;
    ReturnedDate?: string;
    ConditionID: number;
    Remarks?: string;
    CreatedDate: string;
    UpdatedDate?: string;
    // Relations
    InventoryDetail?: PropertyInventoryDetail;
    EndUser?: EndUser;
    Department?: Department;
    Condition?: Condition;
}

export interface PAR {
    PARID: number;
    PARNumber: string;
    EndUserID: number;
    DepartmentID: number;
    IssueDate: string;
    IssuedBy: number;
    ReceivedBy: number;
    Remarks?: string;
    CreatedDate: string;
    // Relations
    EndUser?: EndUser;
    Department?: Department;
    IssuedByUser?: User;
    ReceivedByUser?: User;
}

export interface ICS {
    ICSID: number;
    ICSNumber: string;
    EndUserID: number;
    DepartmentID: number;
    IssueDate: string;
    IssuedBy: number;
    Remarks?: string;
    CreatedDate: string;
    // Relations
    EndUser?: EndUser;
    Department?: Department;
    IssuedByUser?: User;
    Details?: ICSDetail[];
}

export interface ICSDetail {
    ICSDetailID: number;
    ICSID: number;
    PropertyID: number;
    Quantity: number;
    Remarks?: string;
    // Relations
    Property?: AssignedProperty;
}

// ============================================
// USERS & DEPARTMENTS
// ============================================

export interface User {
    UserID: number;
    Username: string;
    Email: string;
    FullName: string;
    UserRoleID: number;
    DepartmentID?: number;
    PositionID?: number;
    IsActive: boolean;
    CreatedDate: string;
    UpdatedDate?: string;
    // Relations
    Role: string; // From UserRole join
    Department?: string; // From Department join
    Position?: string; // From Position join
}

export interface Department {
    DepartmentID: number;
    DepartmentName: string;
    Description?: string;
    CreatedDate: string;
    UpdatedDate?: string;
}

export interface EndUser {
    EndUserID: number;
    DepartmentID: number;
    PositionID: number;
    FullName: string;
    ContactNumber?: string;
    Email?: string;
    CreatedDate: string;
    UpdatedDate?: string;
    // Relations
    Department?: Department;
    Position?: Position;
}

export interface Position {
    PositionID: number;
    PositionName: string;
    Description?: string;
    CreatedDate: string;
    UpdatedDate?: string;
}

// ============================================
// QR CODE
// ============================================

export interface QRCode {
    QRCodeID: number;
    PropertyID: number;
    QRCodeData: string;
    DepartmentID?: number;
    DateGenerated: string;
    // Relations
    Property?: AssignedProperty;
    Department?: Department;
}

// ============================================
// FORM INPUTS (for create/update)
// ============================================

export interface PropertyInventoryInput {
    PropertyCode: string;
    PropertyTypeID: number;
    Description: string;
    Quantity: number;
    UnitOfMeasureID: number;
    UnitCost: number;
    AcquisitionDate: string;
    PropertyStatusID: number;
    LocationID?: number;
    Remarks?: string;
}

export interface PropertyTypeInput {
    PropertyName: string;
    CategoryID: number;
    ClassificationID: number;
    PropertyClassificationID: number;
    Description?: string;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        total: number;
        per_page: number;
        current_page: number;
        last_page: number;
        from: number;
        to: number;
    };
}

// Combined view helper type — frontend-only augmentation for grouped inventory rows
export interface InventoryDetailCombined {
    InventoryDetailID: number;
    InventoryID: number;
    Description?: string;
    Brand?: string;
    ModelNumber?: string;
    SerialNumber?: string;
    PropertyName?: string;
    PropertyNumber?: string;
    ClassificationName?: string;
    DocumentType?: 'ICS' | 'PAR';
    Quantity: number;
    QuantityAvailable?: number;
    UnitOfMeasureID?: number;
    UnitCost?: number;
    TotalCost?: number;
    ConditionID?: number;
    ConditionName?: string;
    PropertyStatusID?: number;
    StatusName?: string;
    custodianName?: string;
    locationDepartment?: string;
    currentDepartmentHead?: string | null;
    departmentHeadVacant?: boolean;
    accountabilityLabel?: string | null;
    currentBorrowerName?: string | null;
    dr_article_name?: string;
    qrCode?: { QRCodeData?: string | null } | null;
    qrCodeData?: string | null;
    endUserName?: string | null;
    endUserPosition?: string | null;
    rlsddpStatus?: 'Lost' | 'Stolen' | 'Damaged' | 'Destroyed' | null;
    rlsddpNumber?: string | null;
    rlsddpId?: number | null;
    // Augmented fields for Combined view
    CombinedQuantity?: number;
    CombinedTotalCost?: number;
    combinedItems?: any[];
}

// ============================================
// FILTERS & QUERIES
// ============================================

export interface PropertyFilters {
    search?: string;
    PropertyTypeID?: number;
    PropertyStatusID?: number;
    PropertyClassificationID?: number;
    DepartmentID?: number;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}
