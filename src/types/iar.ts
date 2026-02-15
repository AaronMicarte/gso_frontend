// Inspection and Acceptance Report (IAR) types for GSO IAMS

export interface IARDetail {
    IARDetailID?: number;
    IARID?: number;
    DRDetailID: number;
    PropertyTypeID: number;
    ConditionID: number;
    QuantityAccepted: number;
    QuantityRejected: number;
    Remarks?: string;
    VerifiedBrand?: string;
    VerifiedModel?: string;
    VerifiedSerial?: string;
    change_reason?: string | null;
    // Relationships
    propertyType?: {
        PropertyTypeID: number;
        PropertyName: string;
        RequiresVerification?: boolean;
        requires_verification?: boolean;
    };
    condition?: {
        ConditionID: number;
        ConditionName: string;
    };
    drDetail?: {
        DRDetailID: number;
        ItemDescription: string;
        Brand?: string;
        ModelNumber?: string;
        SerialNumber?: string;
        QuantityDelivered: number;
        UnitCost: number;
        UnitName?: string;
        unitOfMeasure?: {
            UnitOfMeasureID: number;
            UnitName: string;
        } | null;
    };
}

export interface IAR {
    IARID: number;
    IARNumber: string;
    DRID: number;
    InspectedBy: number;
    AcceptedBy?: number;
    DateInspected: string;
    DateAccepted?: string;
    Remarks?: string;
    CreatedDate: string;
    // Relationships
    details?: IARDetail[];
    inspectedByUser?: {
        UserID: number;
        FullName: string;
    };
    acceptedByUser?: {
        UserID: number;
        FullName: string;
    };
    deliveryReceipt?: {
        DRID: number;
        DRNumber: string;
        SupplierName: string;
        DateReceived: string;
        PONumber?: string;
        InvoiceNumber?: string;
        requestedByUser?: {
            UserID: number;
            FullName: string;
            DepartmentID: number;
            department?: {
                DepartmentID: number;
                DepartmentName: string;
            };
        };
    };
    // Optional signature relationships
    inspectedSignature?: { url: string } | null;
    acceptedSignature?: { url: string } | null;
    // Backwards-compatible inline base64 signatures
    inspected_signature?: string;
    accepted_signature?: string | null;
}

export interface CreateIARPayload {
    dr_id: number;
    inspected_by: number;
    accepted_by?: number | null;
    date_inspected: string;
    date_accepted?: string | null;
    remarks?: string;
    details: {
        dr_detail_id: number;
        property_type_id: number;
        condition_id: number;
        quantity_accepted: number;
        quantity_rejected: number;
        verified_brand?: string | null;
        verified_model?: string | null;
        verified_serial?: string | null;
        remarks?: string;
    }[];
    // Signatures
    inspected_signature?: string; // base64 data URL
    inspected_signature_source?: 'canvas' | 'upload';
    accepted_signature?: string | null;
    accepted_signature_source?: 'canvas' | 'upload' | null;
}

export interface UpdateIARPayload {
    inspected_by: number;
    accepted_by?: number | null;
    date_inspected: string;
    date_accepted?: string;
    remarks?: string;
    details: {
        dr_detail_id: number;
        property_type_id: number;
        condition_id: number;
        quantity_accepted: number;
        quantity_rejected: number;
        verified_brand?: string | null;
        verified_model?: string | null;
        verified_serial?: string | null;
        remarks?: string;
    }[];
    // Optional signatures when updating (accept flow uses these)
    accepted_signature?: string | null;
    accepted_signature_source?: 'canvas' | 'upload' | null;
}

export interface IARFilters {
    start_date?: string;
    end_date?: string;
    dr_number?: string;
    iar_number?: string;
    per_page?: number;
    page?: number;
}
