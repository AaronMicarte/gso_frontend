export type AssetServiceStatus =
    | 'pending'
    | 'under_review'
    | 'work_approved'
    | 'repair_in_progress'
    | 'verification'
    | 'closed'
    | 'unrepairable';

export type AssetServiceReportSource = 'cce_user' | 'inventory_check' | 'audit' | 'other';
export type AssetServiceHandlingDecision = 'warranty_claim' | 'vendor_repair' | 'replacement_evaluation';
export type AssetServiceBudgetStatus = 'pending_check' | 'warranty_covered' | 'budget_available' | 'budget_unavailable';

export interface ServiceHelperVendor {
    VendorID: number;
    VendorName: string;
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
}

export interface ServiceInventoryItem {
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
    condition?: {
        ConditionID?: number | null;
        ConditionName?: string | null;
    } | null;
    inventory?: {
        InventoryID?: number | null;
        InventoryNumber?: string | null;
        DateReceived?: string | null;
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
    EstimatedCost?: number | null;
    ActualCost?: number | null;
    WarrantyCovered: boolean;
    WarrantyOutcome?: string | null;
    CompletionNotes?: string | null;
    VerificationNotes?: string | null;
    InvoiceAttachment?: string | null;
    invoice_url?: string | null;
    SupportingAttachments?: string[] | null;
    supporting_attachment_urls?: string[] | null;
    vendor?: ServiceHelperVendor | null;
    inventoryDetail?: ServiceInventoryItem | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface AssetServiceRecord {
    ServiceRecordID: number;
    ServiceNumber: string;
    DateReported: string;
    ReportSource: AssetServiceReportSource;
    SubmittedByName?: string | null;
    SubmittedByEndUserID?: number | null;
    ReportingDepartmentID?: number | null;
    Status: AssetServiceStatus;
    RecordNotes?: string | null;
    CreatedByUserID: number;
    UpdatedByUserID?: number | null;
    details: AssetServiceRecordDetail[];
    reportingDepartment?: ServiceHelperDepartment | null;
    submittedByEndUser?: ServiceHelperEndUser | null;
    createdBy?: { UserID: number; FullName: string } | null;
    updatedBy?: { UserID: number; FullName: string } | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface AssetServiceRecordCreatePayload {
    date_reported: string;
    report_source: AssetServiceReportSource;
    submitted_by_name?: string;
    submitted_by_end_user_id?: number | null;
    reporting_department_id?: number | null;
    status?: AssetServiceStatus;
    record_notes?: string;
    details: Array<{
        inventory_detail_id: number;
        problem_description: string;
        handling_decision?: AssetServiceHandlingDecision | null;
        budget_status?: AssetServiceBudgetStatus;
        status?: AssetServiceStatus;
        assigned_vendor_id?: number | null;
        estimated_cost?: number | null;
        actual_cost?: number | null;
        warranty_covered?: boolean;
        warranty_outcome?: string;
        completion_notes?: string;
        verification_notes?: string;
        invoice_attachment?: string;
        supporting_attachments?: string[];
    }>;
}

export interface AssetServiceRecordUpdatePayload {
    date_reported?: string;
    report_source?: AssetServiceReportSource;
    submitted_by_name?: string;
    submitted_by_end_user_id?: number | null;
    reporting_department_id?: number | null;
    status?: AssetServiceStatus;
    record_notes?: string;
    details?: Array<{
        service_record_detail_id?: number;
        inventory_detail_id: number;
        problem_description: string;
        handling_decision?: AssetServiceHandlingDecision | null;
        budget_status?: AssetServiceBudgetStatus;
        status?: AssetServiceStatus;
        assigned_vendor_id?: number | null;
        estimated_cost?: number | null;
        actual_cost?: number | null;
        warranty_covered?: boolean;
        warranty_outcome?: string;
        completion_notes?: string;
        verification_notes?: string;
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
