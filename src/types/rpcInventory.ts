export type RpcType = 'RPCPPE' | 'RPCSEP';

export interface RpcInventoryCycle {
    id: number;
    cycle_label: string;
    start_year: number;
    end_year: number;
    status: string;
    started_at?: string | null;
    closed_at?: string | null;
    close_reason?: string | null;
    closed_by_user_id?: number | null;
    reopened_at?: string | null;
    reopened_by_user_id?: number | null;
    reopen_reason?: string | null;
    reopen_count?: number;
    can_reopen?: boolean;
    is_permanently_closed?: boolean;
    scans_count: number;
    rpcppe_count: number;
    rpcsep_count: number;
}

export interface RpcInventoryCyclesResponse {
    data: RpcInventoryCycle[];
    current_cycle: {
        start_year: number;
        end_year: number;
        label: string;
    };
}

export interface RpcInventoryCondition {
    ConditionID: number;
    ConditionName: string;
}

export interface RpcInventoryPreviewAsset {
    property_id: number | null;
    inventory_detail_id: number;
    property_classification_id: number | null;
    rpc_type: RpcType;
    article: string | null;
    description: string | null;
    property_number: string | null;
    unit_of_measure: string | null;
    unit_value: number | null;
    accountable_officer: string | null;
    end_user_id: number | null;
    department_id: number | null;
    department_name: string | null;
    condition_id?: number | null;
    condition_name?: string | null;
}

export interface RpcInventoryPreviewCandidate {
    inventory_detail_id: number;
    property_id: number | null;
    property_number: string | null;
    is_scanned: boolean;
    existing_scan_id: number | null;
}

export interface RpcInventoryScanPreviewResponse {
    asset: RpcInventoryPreviewAsset;
    already_scanned: boolean;
    existing_scan_id: number | null;
    group_total_count: number;
    group_scanned_count: number;
    group_remaining_count: number;
    candidates: RpcInventoryPreviewCandidate[];
}

export interface RpcInventoryScanRecord {
    id: number;
    rpc_inventory_cycle_id: number;
    inventory_detail_id: number;
    property_id: number | null;
    rpc_type: RpcType;
    condition_id: number;
    condition?: {
        ConditionID: number;
        ConditionName: string;
    } | null;
    scanned_at: string;
    scanned_by_user_id: number;
    scanned_by?: {
        UserID: number;
        FullName: string;
    } | null;
    end_user_id: number | null;
    department_id: number | null;
    article: string | null;
    description: string | null;
    property_number: string | null;
    unit_of_measure: string | null;
    unit_value: string | number | null;
    quantity_per_card: number;
    quantity_per_count: number;
    remarks: string | null;
    accountable_officer: string | null;
    department_name?: string | null;
    created_month?: string | null;
    property_type?: string | null;
    created_at: string;
    updated_at: string;
}

export interface RpcInventoryScansPaginated {
    data: RpcInventoryScanRecord[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface RpcInventoryReportRow {
    property_type?: string | null;
    article: string;
    description: string;
    property_number: string;
    unit_of_measure: string;
    unit_value: number;
    quantity_per_card: number;
    quantity_per_count: number;
    shortage_overage_qty: number;
    shortage_overage_value: number;
    remarks: string | null;
    /**
     * Optional map of individual property number => remark for grouped rows.
     */
    property_remarks?: Record<string, string | null> | null;
    accountable_officer: string;
    date_purchased: string;
    condition?: string | null;
    is_scanned: boolean;
}

export interface RpcInventoryReportBucket {
    rows: RpcInventoryReportRow[];
    property_types?: string[];
    scanned_count: number;
    total_count: number;
}

export interface RpcInventoryAuditLogPerformer {
    UserID: number;
    FullName: string;
}

export interface RpcInventoryAuditLogScan {
    id: number;
    property_number: string | null;
    inventory_detail_id: number;
    condition_id?: number | null;
    remarks?: string | null;
    rpc_type?: string | null;
    article?: string | null;
    description?: string | null;
    accountable_officer?: string | null;
}

export interface RpcInventoryAuditLog {
    AuditID: number;
    rpc_inventory_cycle_id: number;
    rpc_inventory_scan_id: number | null;
    action: string;
    source: string;
    performed_by_user_id: number;
    performed_by_device_id: string | null;
    inventory_detail_id: number | null;
    property_id: number | null;
    property_number: string | null;
    condition_id: number | null;
    previous_condition_id: number | null;
    previous_remarks: string | null;
    new_remarks: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    performed_by?: RpcInventoryAuditLogPerformer | null;
    scan?: RpcInventoryAuditLogScan | null;
}

export interface RpcInventoryAuditLogPaginated {
    data: RpcInventoryAuditLog[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface RpcInventoryReportResponse {
    cycle: RpcInventoryCycle;
    generated_at: string;
    rpcppe: RpcInventoryReportBucket;
    rpcsep: RpcInventoryReportBucket;
}

export interface DepartmentCrossCheckItem {
    inventory_detail_id: number;
    po_number: string;
    supplier: string;
    par_ics_number: string;
    quantity: number;
    unit: string;
    description: string;
    property_number: string;
    unit_cost: number;
    total_cost: number;
    date_received: string;
    remarks: string;
    end_user: string;
    scan_status: string;
    scanned_count?: number;
    unscanned_count?: number;
    total_in_group?: number;
    rpc_type: RpcType;
    property_type: string;
}

export interface DepartmentCrossCheckResponse {
    department: {
        DepartmentID: number;
        DepartmentName: string;
        DepartmentCode: string;
        DepartmentHead?: string | null;
    };
    summary: {
        total_items: number;
        total_cost: number;
        rpcppe_count: number;
        rpcsep_count: number;
    };
    data: DepartmentCrossCheckItem[];
}
