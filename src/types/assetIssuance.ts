// Asset Issuance Types
// Based on real GSO property issuance workflow

import { User } from './auth';

export interface AssetRequestDepartment {
    DepartmentID: number;
    DepartmentName: string;
    DepartmentCode?: string | null;
}

export interface AssetRequest {
    RequestID: number;
    RequestNumber: string;
    RequestedBy: number;
    DepartmentID: number;
    Purpose?: string;
    Status: 'pending' | 'approved' | 'waiting_for_issuance' | 'rejected' | 'issued' | 'received' | 'cancelled';
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
    department?: AssetRequestDepartment;
    details?: AssetRequestDetail[];
    reviewer?: User;
    issuer?: User;
    issuances?: AssetIssuance[];
    auditLogs?: AssetAuditLog[];
    signatures?: AssetRequestSignature[];
}

export interface AssetRequestDetail {
    RequestDetailID: number;
    RequestID: number;
    PropertyInventoryDetailID: number | null;
    ItemDescription: string | null;
    Unit: string | null;
    QuantityRequested: number;
    Purpose: string;
    IntendedEndUser: string | null;
    AdditionalNotes: string | null;
    PropertyClassification: 'ICS' | 'PAR' | null;
    AssignedEndUserID: number | null;
    AssignedDepartmentID: number | null;
    AdminNotes: string | null;
    IsApprovedForIssuance?: boolean | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;

    // Relationships
    inventoryDetail?: InventoryDetail;
    assignedEndUser?: EndUser;
    assignedDepartment?: AssetRequestDepartment;
    assignments?: AssetAssignment[];
}

export interface AssetAssignment {
    AssignmentID: number;
    AssetRequestDetailID: number | null;
    PropertyInventoryDetailID: number | null;
    AssignedUserID: number | null;
    AssignedDepartmentID: number | null;
    AssignmentType: 'request' | 'issuance';
    PropertyClassification: 'ICS' | 'PAR' | null;
    AdminNotes: string | null;
    AssignedBy: number;
    AssignedAt: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;

    // Relationships
    assetRequestDetail?: AssetRequestDetail;
    propertyInventoryDetail?: InventoryDetail;
    assignedUser?: User;
    assignedDepartment?: AssetRequestDepartment;
    assignedByUser?: User;
}

export interface AssetIssuance {
    IssuanceID: number;
    RequestID: number;
    DocumentType: 'PAR' | 'ICS';
    DocumentNumber: string;
    PropertyInventoryDetailID?: number; // Optional if it's a header
    QuantityIssued?: number; // Optional if it's a header
    IssuedTo: number | null;
    IssuedToName?: string | null;
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
    details?: IssuanceDetail[];
    issuedToUser?: User;
    issuer?: User;
    acknowledger?: User;
    auditLogs?: AssetAuditLog[];

    // Computed
    signature_url?: string;
}

export interface IssuanceDetail {
    IssuanceDetailID: number;
    IssuanceID: number;
    RequestDetailID?: number;
    InventoryDetailID: number;
    QuantityIssued: number;
    ItemDescription?: string | null;
    Unit?: string | null;
    Remarks?: string;
    created_at: string;
    updated_at: string;

    // Relationships
    inventoryDetail?: InventoryDetail;
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

// End User
export interface EndUser {
    EndUserID: number;
    PositionID: number;
    DepartmentID: number;
    FullName: string;
    ContactNumber: string | null;
    Email: string | null;
    IsActive: boolean;
    CreatedDate: string;
    UpdatedDate: string | null;
    deleted_at: string | null;

    // Relationships
    position?: Position;
    department?: AssetRequestDepartment;
}

// Review Data for admin review
export interface AssetRequestReviewData {
    details: {
        RequestDetailID: number;
        PropertyClassification: 'ICS' | 'PAR' | null;
        AssignedEndUserID: number | null;
        AssignedDepartmentID: number | null;
        AdminNotes: string | null;
        IsApprovedForIssuance: boolean;
    }[];
    ReviewNotes?: string;
    approverSignature?: string;
    approverSignatureSource?: 'canvas' | 'upload';
}

// Position
export interface Position {
    PositionID: number;
    PositionName: string;
    PositionDescription: string | null;
    CreatedDate: string;
    UpdatedDate: string | null;
    deleted_at: string | null;
}

// Request form types
export interface AssetRequestFormData {
    Purpose: string;
    items: AssetRequestItem[];
}

export interface AssetRequestItem {
    ItemDescription: string;
    Unit: string;
    QuantityRequested: number;
    Purpose: string;
    IntendedEndUser?: string;
    AdditionalNotes?: string;
}

export interface InventoryDetail {
    InventoryDetailID: number;
    InventoryID: number;
    Quantity: number;
    QuantityAvailable: number;
    ConditionID: number;
    PropertyTypeID: number;
    UnitOfMeasureID: number;
    PropertyNumber?: string | null;
    UnitCost?: number | null;

    // Optional descriptive fields used by print/report views
    Description?: string | null;
    InventoryNumber?: string | null;
    EstimatedUsefulLife?: string | null;

    // Relationships
    propertyInventory?: PropertyInventory;
    propertyType?: PropertyType;
    condition?: Condition;
    unitOfMeasure?: UnitOfMeasure;
}

export interface PropertyInventory {
    InventoryID: number;
    ItemName?: string | null;
    ItemDescription: string;
    Brand: string | null;
    ModelNumber: string | null;
    SerialNumber: string | null;

    // Traceability/reporting fields (optional; depends on backend payload)
    DateReceived?: string | null;
    DateAcquired?: string | null;
    InventoryNumber?: string | null;
    EstimatedUsefulLife?: string | null;
}

export interface PropertyType {
    PropertyTypeID: number;
    PropertyName: string;
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
    Purpose: string;
    items: {
        PropertyInventoryDetailID?: number | null;
        ItemDescription: string;
        Unit: string;
        QuantityRequested: number;
        Purpose: string;
        IntendedEndUser?: string;
        AdditionalNotes?: string;
    }[];
    requesterSignature: string;
    requesterSignatureSource: 'canvas' | 'upload';
}

export interface ReviewAssetRequestData {
    ReviewNotes?: string;
}

export interface IssueAssetData {
    request_id: number;
    date_issued: string;
    remarks: string | null;
    issuerSignature: string;
    issuerSignatureSource: 'canvas' | 'upload';
}

export interface AcknowledgeAssetData {
    acknowledgment_signature: string; // Base64 encoded (data URL recommended)
    acknowledgment_notes?: string;
    acknowledged_by: number;
}

// Response types
export interface AssetRequestResponse {
    message: string;
    request: AssetRequest;
}

export interface AssetIssuanceResponse {
    message: string;
    issuance?: AssetIssuance;
}

// Backend returns { message, data: { issuances: AssetIssuance[] } } for the create endpoint
export interface AssetIssuanceCreateResponse {
    message: string;
    data: { issuances: AssetIssuance[] };
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

export interface AssetRequestSignature {
    id: number;
    request_id: number;
    role: string; // e.g., 'requester', 'approver', 'issuer'
    signed_by_user_id: number;
    source: 'canvas' | 'upload';
    storage_disk: string;
    storage_path: string;
    url: string;
    mime: string;
    width: number | null;
    height: number | null;
    size_bytes: number | null;
    sha256_hash: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    updated_at: string;

    // Relationships
    signedByUser?: User;
}
