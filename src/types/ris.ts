export type RisStatus = 'for_issuance' | 'issued' | 'received' | 'cancelled';

export interface RisRequestInfo {
    RequestID: number;
    RequestNumber: string;
    RequestDate: string;
    Status: string;
    Office?: string | null;
    office?: string | null;
    department?: { DepartmentID: number; DepartmentName: string; DepartmentCode?: string };
    requester?: { UserID: number; FullName: string; DepartmentID: number };
    reviewer?: { UserID: number; FullName: string };
    issuer?: { UserID: number; FullName: string };
}

export interface RisSignatureInfo {
    url?: string | null;
    user?: { UserID: number; FullName: string } | null;
    signature?: string | null; // for received_by (inline base64 from acknowledgment)
    acknowledged_by?: number | null;
    acknowledged_at?: string | null;
    issued_to_name?: string | null;
    designation?: string | null;
}

export interface RisItem {
    id: number;
    asset_request_detail_id: number;
    stock_no: string;
    unit: string;
    description: string;
    quantity_requested: number;
    stock_available: boolean;
    quantity_issued: number;
    issue_remarks: string;
}

export interface RisRecord {
    id: number;
    asset_request_id: number;
    ris_number: string;
    entity_name: string;
    fund_cluster: string;
    division: string;
    responsibility_center_code: string;
    purpose: string;
    status: RisStatus;
    remarks?: string | null;
    request?: RisRequestInfo | null;
    // Back-compat: some endpoints/serializers may expose the relationship as snake_case.
    asset_request?: RisRequestInfo | null;
    items: RisItem[];
    signatures: {
        requested_by: RisSignatureInfo | null;
        approved_by: RisSignatureInfo | null;
        issued_by: RisSignatureInfo | null;
        received_by: RisSignatureInfo | null;
    };
}

export interface Paginated<T> {
    data: T[];
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
}
