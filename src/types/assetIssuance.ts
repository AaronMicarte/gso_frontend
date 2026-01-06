// Asset Issuance Types
// Based on real GSO property issuance workflow

export interface AssetRequest {
    RequestID: number;
    RequestNumber: string;
    RequestedBy: number;
    DepartmentID: number;
    Status: 'pending' | 'approved' | 'rejected' | 'issued' | 'cancelled';
    ReviewedBy: number | null;
    ReviewedAt: string | null;
    ReviewNotes: string | null;
    IssuedBy: number | null;
    IssuedAt: string | null;
    RequestDate: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;

    // Relationships
    requester?: User;
    department?: Department;
    details?: AssetRequestDetail[];
    reviewer?: User;
    issuer?: User;
    issuances?: AssetIssuance[];
    auditLogs?: AssetAuditLog[];
}

export interface AssetRequestDetail {
    RequestDetailID: number;
    RequestID: number;
    PropertyInventoryDetailID: number | null;
    ItemDescription: string | null;
    Unit: string | null;
    QuantityRequested: number;
    Purpose: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;

    // Relationships
    inventoryDetail?: InventoryDetail;
}

export interface AssetIssuance {
    IssuanceID: number;
    RequestID: number;
    DocumentType: 'PAR' | 'ICS';
    DocumentNumber: string;
    PropertyInventoryDetailID: number;
    QuantityIssued: number;
    IssuedTo: number;
    IssuedBy: number;
    IssuanceDate: string;
    Status: 'pending_acknowledgment' | 'acknowledged' | 'returned' | 'disposed';
    IssuanceNotes: string | null;
    AcknowledgedBy: number | null;
    AcknowledgedAt: string | null;
    AcknowledgmentSignature: string | null;
    AcknowledgmentNotes: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;

    // Relationships
    request?: AssetRequest;
    inventoryDetail?: InventoryDetail;
    issuedToUser?: User;
    issuer?: User;
    acknowledger?: User;
    auditLogs?: AssetAuditLog[];

    // Computed
    signature_url?: string;
}

export interface AssetAuditLog {
    AuditID: number;
    EntityType: 'asset_request' | 'asset_issuance';
    EntityID: number;
    Action: string;
    PerformedBy: number;
    Details: Record<string, unknown> | null;
    IPAddress: string | null;
    UserAgent: string | null;
    CreatedAt: string;

    // Relationships
    performer?: User;
}

export interface User {
    UserID: number;
    FirstName: string;
    LastName: string;
    FullName: string;
    Email: string;
    DepartmentID?: number;
    department?: Department;
}

export interface Department {
    DepartmentID: number;
    DepartmentName: string;
    DepartmentCode: string;
    IsActive: boolean;
}

export interface InventoryDetail {
    InventoryDetailID: number;
    InventoryID: number;
    QuantityOnHand: number;
    ConditionID: number;
    PropertyTypeID: number;
    UnitOfMeasureID: number;

    // Relationships
    propertyInventory?: PropertyInventory;
    propertyType?: PropertyType;
    condition?: Condition;
    unitOfMeasure?: UnitOfMeasure;
}

export interface PropertyInventory {
    InventoryID: number;
    ItemDescription: string;
    Brand: string | null;
    ModelNumber: string | null;
    SerialNumber: string | null;
}

export interface PropertyType {
    PropertyTypeID: number;
    PropertyTypeName: string;
    PropertyClassificationID: number;
    propertyClassification?: PropertyClassification;
}

export interface PropertyClassification {
    PropertyClassificationID: number;
    ClassificationName: string;
    DocumentType: 'PAR' | 'ICS';
}

export interface Condition {
    ConditionID: number;
    ConditionName: string;
}

export interface UnitOfMeasure {
    UnitOfMeasureID: number;
    UnitName: string;
}

// Form types
export interface CreateAssetRequestData {
    items: {
        PropertyInventoryDetailID: number | null;
        ItemDescription?: string;
        Unit?: string;
        QuantityRequested: number;
        Purpose: string;
    }[];
}

export interface ReviewAssetRequestData {
    ReviewNotes?: string;
}

export interface IssueAssetData {
    RequestID: number;
    IssuanceNotes?: string;
}

export interface AcknowledgeAssetData {
    signature: string; // Base64 encoded
    notes?: string;
}

// Response types
export interface AssetRequestResponse {
    message: string;
    request: AssetRequest;
}

export interface AssetIssuanceResponse {
    message: string;
    issuance: AssetIssuance;
}

// Pagination
export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

// Filter types
export interface AssetRequestFilters {
    status?: AssetRequest['Status'];
    from_date?: string;
    to_date?: string;
    per_page?: number;
    page?: number;
}

export interface AssetIssuanceFilters {
    status?: AssetIssuance['Status'];
    document_type?: 'PAR' | 'ICS';
    per_page?: number;
    page?: number;
}
