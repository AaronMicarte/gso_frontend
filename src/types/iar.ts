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
    // Relationships
    propertyType?: {
        PropertyTypeID: number;
        PropertyName: string;
    };
    condition?: {
        ConditionID: number;
        ConditionName: string;
    };
    drDetail?: {
        DRDetailID: number;
        ItemDescription: string;
        QuantityDelivered: number;
        UnitCost: number;
    };
}

export interface IAR {
    IARID: number;
    IARNumber: string;
    DRID: number;
    InspectedBy: number;
    AcceptedBy: number;
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
    };
}

export interface CreateIARPayload {
    dr_id: number;
    inspected_by: number;
    accepted_by: number;
    date_inspected: string;
    date_accepted?: string;
    remarks?: string;
    details: {
        dr_detail_id: number;
        property_type_id: number;
        condition_id: number;
        quantity_accepted: number;
        quantity_rejected: number;
        remarks?: string;
    }[];
}

export interface UpdateIARPayload {
    inspected_by: number;
    accepted_by: number;
    date_inspected: string;
    date_accepted?: string;
    remarks?: string;
    details: {
        dr_detail_id: number;
        property_type_id: number;
        condition_id: number;
        quantity_accepted: number;
        quantity_rejected: number;
        remarks?: string;
    }[];
}

export interface IARFilters {
    start_date?: string;
    end_date?: string;
    dr_number?: string;
    iar_number?: string;
    per_page?: number;
    page?: number;
}
