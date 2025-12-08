/**
 * Property Management Types
 * Based on GSO database schema
 */

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
    PropertyTypeName: string;
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

export interface Category {
    CategoryID: number;
    CategoryName: string;
    Description?: string;
    CreatedDate: string;
    UpdatedDate?: string;
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

export interface UnitOfMeasure {
    UnitOfMeasureID: number;
    UnitName: string;
    Description?: string;
}

// ============================================
// PROCUREMENT
// ============================================

export interface PurchaseRequest {
    PurchaseRequestID: number;
    PRNumber: string;
    RequestDate: string;
    DepartmentID: number;
    RequestedBy: number;
    Purpose: string;
    PRStatusID: number;
    ApprovedBy?: number;
    ApprovedDate?: string;
    Remarks?: string;
    CreatedDate: string;
    UpdatedDate?: string;
    // Relations
    Department?: Department;
    RequestedByUser?: User;
    ApprovedByUser?: User;
    PRStatus?: PurchaseRequestStatus;
    Details?: PurchaseRequestDetail[];
}

export interface PurchaseRequestDetail {
    PRDetailID: number;
    PurchaseRequestID: number;
    PropertyTypeID: number;
    Description: string;
    Quantity: number;
    UnitOfMeasureID: number;
    EstimatedCost?: number;
    Remarks?: string;
    // Relations
    PropertyType?: PropertyType;
    UnitOfMeasure?: UnitOfMeasure;
}

export interface PurchaseRequestStatus {
    PRStatusID: number;
    StatusName: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
}

export interface PurchaseOrder {
    POID: number;
    PONumber: string;
    PurchaseRequestID?: number;
    PODate: string;
    SupplierID: number;
    DeliveryDate?: string;
    POStatusID: number;
    TotalAmount: number;
    PreparedBy: number;
    ApprovedBy?: number;
    Remarks?: string;
    CreatedDate: string;
    UpdatedDate?: string;
    // Relations
    PurchaseRequest?: PurchaseRequest;
    Supplier?: Supplier;
    POStatus?: PurchaseOrderStatus;
    Details?: PurchaseOrderDetail[];
}

export interface PurchaseOrderDetail {
    PODetailID: number;
    POID: number;
    PropertyTypeID: number;
    Description: string;
    Quantity: number;
    UnitOfMeasureID: number;
    UnitCost: number;
    TotalCost: number;
    // Relations
    PropertyType?: PropertyType;
    UnitOfMeasure?: UnitOfMeasure;
}

export interface PurchaseOrderStatus {
    POStatusID: number;
    StatusName: 'Pending' | 'Partially Delivered' | 'Fully Delivered' | 'Completed' | 'Cancelled';
}

export interface DeliveryReceipt {
    DRID: number;
    DRNumber: string;
    POID: number;
    DeliveryDate: string;
    SupplierID: number;
    ReceivedBy: number;
    Remarks?: string;
    CreatedDate: string;
    // Relations
    PurchaseOrder?: PurchaseOrder;
    Supplier?: Supplier;
    ReceivedByUser?: User;
    Details?: DeliveryReceiptDetail[];
}

export interface DeliveryReceiptDetail {
    DRDetailID: number;
    DRID: number;
    PODetailID: number;
    PropertyTypeID: number;
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
    FirstName: string;
    LastName: string;
    DepartmentID: number;
    PositionID: number;
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

export interface Supplier {
    SupplierID: number;
    SupplierName: string;
    ContactPerson: string;
    Address: string;
    ContactNumber: string;
    Email?: string;
    TIN?: string;
    IsActive: boolean;
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
    PropertyTypeName: string;
    CategoryID: number;
    ClassificationID: number;
    PropertyClassificationID: number;
    Description?: string;
}

export interface PurchaseRequestInput {
    PRNumber: string;
    RequestDate: string;
    DepartmentID: number;
    Purpose: string;
    Details: PurchaseRequestDetailInput[];
}

export interface PurchaseRequestDetailInput {
    PropertyTypeID: number;
    Description: string;
    Quantity: number;
    UnitOfMeasureID: number;
    EstimatedCost?: number;
    Remarks?: string;
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
