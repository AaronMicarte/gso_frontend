export type AssetServiceStatus =
    | 'pending'
    | 'work_approved'
    | 'repair_in_progress'
    | 'verification'
    | 'fixed'
    | 'unserviceable';

export type AssetServiceHandlingDecision = 'warranty' | 'no_warranty';
export type AssetServiceBudgetStatus = 'pending_check' | 'warranty_covered' | 'budget_available' | 'budget_unavailable';

export interface ServiceHelperProvider {
    ProviderType: 'vendor' | 'supplier';
    ProviderID: number;
    ProviderName: string;
    ContactPerson?: string | null;
    ContactNumber?: string | null;
    Email?: string | null;
}

export interface ServiceHelperDepartment {
    DepartmentID: number;
    DepartmentName: string;
    DepartmentCode?: string | null;
}

export interface ServiceHelperEndUser {
    EndUserID: number;
    DepartmentID: number;
    FullName: string;
    DepartmentName?: string | null;
}

export interface ServiceInventoryItem {
    InventoryDetailID: number;
    PropertyNumber?: string | null;
    PropertyName?: string | null;
    Description?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
    UnitCost?: number | null;
    propertyType?: {
        PropertyTypeID?: number | null;
        PropertyName?: string | null;
    } | null;
    condition?: {
        ConditionID?: number | null;
        ConditionName?: string | null;
    } | null;
    propertyStatus?: {
        PropertyStatusID?: number | null;
        StatusName?: string | null;
    } | null;
    inventory?: {
        InventoryID?: number | null;
        InventoryNumber?: string | null;
        DateReceived?: string | null;
    } | null;
    SupplierID?: number | null;
    SupplierName?: string | null;
    dr_article_name?: string | null;
    drDetail?: {
        DRDetailID?: number | null;
        DRID?: number | null;
        ArticleID?: number | null;
        ItemDescription?: string | null;
        Brand?: string | null;
        ModelNumber?: string | null;
        SerialNumber?: string | null;
        article?: {
            ArticleID?: number | null;
            ArticleName?: string | null;
        } | null;
    } | null;
}

export interface AssetServiceRecordDetail {
    ServiceRecordDetailID: number;
    ServiceRecordID: number;
    InventoryDetailID: number;
    PropertyNumber?: string | null;
    ItemDescription?: string | null;
    ProblemDescription: string;
    HandlingDecision?: AssetServiceHandlingDecision | null;
    BudgetStatus: AssetServiceBudgetStatus;
    Status: AssetServiceStatus;
    AssignedVendorID?: number | null;
    AssignedSupplierID?: number | null;
    assigned_provider_type?: 'vendor' | 'supplier' | null;
    assigned_provider_id?: number | null;
    assigned_provider_name?: string | null;
    EstimatedCost?: number | null;
    ActualCost?: number | null;
    WarrantyClaimNumber?: string | null;
    RepairOrderNumber?: string | null;
    InvoiceAttachment?: string | null;
    invoice_url?: string | null;
    SupportingAttachments?: string[] | null;
    supporting_attachment_urls?: string[] | null;
    vendor?: { VendorID: number; VendorName: string } | null;
    supplier?: { SupplierID: number; SupplierName: string } | null;
    inventoryDetail?: ServiceInventoryItem | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface AssetServiceRecord {
    ServiceRecordID: number;
    ServiceNumber: string;
    DateReported: string;
    ReportSource: number;
    Status: AssetServiceStatus;
    RecordNotes?: string | null;
    CreatedByUserID: number;
    UpdatedByUserID?: number | null;
    FinalNotes?: string | null;
    details: AssetServiceRecordDetail[];
    reportingDepartment?: ServiceHelperDepartment | null;
    reportingDepartmentHead?: string | null;
    reportingDepartmentLabel?: string | null;
    createdBy?: { UserID: number; FullName: string } | null;
    updatedBy?: { UserID: number; FullName: string } | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface AssetServiceRecordCreatePayload {
    date_reported: string;
    report_source_id: number;
    status?: AssetServiceStatus;
    record_notes?: string;
    details: Array<{
        inventory_detail_id: number;
        problem_description: string;
        handling_decision?: AssetServiceHandlingDecision | null;
        budget_status?: AssetServiceBudgetStatus;
        status?: AssetServiceStatus;
        assigned_vendor_id?: number | null;
        assigned_supplier_id?: number | null;
        estimated_cost?: number | null;
        actual_cost?: number | null;
        warranty_claim_number?: string;
        repair_order_number?: string;
        invoice_attachment?: string;
        supporting_attachments?: string[];
    }>;
}

export interface AssetServiceRecordUpdatePayload {
    date_reported?: string;
    report_source_id?: number;
    status?: AssetServiceStatus;
    record_notes?: string;
    final_notes?: string;
    details?: Array<{
        service_record_detail_id?: number;
        inventory_detail_id: number;
        problem_description: string;
        handling_decision?: AssetServiceHandlingDecision | null;
        budget_status?: AssetServiceBudgetStatus;
        status?: AssetServiceStatus;
        assigned_vendor_id?: number | null;
        assigned_supplier_id?: number | null;
        estimated_cost?: number | null;
        actual_cost?: number | null;
        warranty_claim_number?: string;
        repair_order_number?: string;
        invoice_attachment?: string;
        supporting_attachments?: string[];
    }>;
}

export interface ServiceRecordsResponse {
    data: AssetServiceRecord[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
}
