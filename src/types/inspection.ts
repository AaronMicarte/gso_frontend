export interface InspectionReportItem {
    IARDetailID: number;
    IARID: number;
    DRDetailID: number;
    PropertyTypeID: number;
    ConditionID: number;
    QuantityAccepted: number;
    QuantityRejected: number;
    VerifiedBrand?: string | null;
    VerifiedModel?: string | null;
    VerifiedSerial?: string | null;
    NoSerial?: boolean | null;
    Remarks?: string | null;
    change_reason?: string | null;
    drDetail?: {
        DRDetailID: number;
        ItemDescription: string;
        Brand?: string | null;
        ModelNumber?: string | null;
        SerialNumber?: string | null;
        QuantityDelivered: number;
        UnitCost: number;
        unitOfMeasure?: {
            UnitOfMeasureID: number;
            UnitName: string;
        } | null;
        propertyType?: {
            PropertyTypeID: number;
            PropertyName: string;
        } | null;
    };
    dr_detail?: {
        DRDetailID: number;
        ItemDescription: string;
        Brand?: string | null;
        ModelNumber?: string | null;
        SerialNumber?: string | null;
        QuantityDelivered: number;
        UnitCost: number;
        unit_of_measure?: {
            UnitOfMeasureID: number;
            UnitName: string;
        } | null;
        property_type?: {
            PropertyTypeID: number;
            PropertyName: string;
        } | null;
    };
    condition?: {
        ConditionID: number;
        ConditionName: string;
        Description?: string | null;
    } | null;
}

export interface InspectionReport {
    IARID: number;
    IARNumber?: string | null;
    DRID: number;
    InspectedBy: number;
    AcceptedBy?: number | null;
    DateInspected: string;
    DateAccepted?: string | null;
    Status?: 'pending' | 'inspected';
    Remarks?: string | null;
    deliveryReceipt?: {
        DRID: number;
        DRNumber: string;
        SupplierName: string;
        PONumber?: string | null;
        DateReceived: string;
        RequestedByName?: string | null;
        DepartmentName?: string | null;
    };
    inspectedByUser?: {
        UserID: number;
        FullName: string;
    };
    acceptedByUser?: {
        UserID: number;
        FullName: string;
    };
    delivery_receipt?: {
        DRID: number;
        DRNumber: string;
        SupplierName: string;
        PONumber?: string | null;
        DateReceived: string;
        RequestedByName?: string | null;
        DepartmentName?: string | null;
    };
    inspected_by_user?: {
        UserID: number;
        FullName: string;
    };
    accepted_by_user?: {
        UserID: number;
        FullName: string;
    };
    details?: InspectionReportItem[];
}

export interface InspectionPendingReceipt {
    DRID: number;
    DRNumber: string;
    SupplierName: string;
    PONumber?: string | null;
    DateReceived: string;
    inspection_status?: 'pending' | 'inspected';
    RequestedByName?: string | null;
    DepartmentName?: string | null;
    details?: Array<{
        DRDetailID: number;
        ItemDescription: string;
        Brand?: string | null;
        ModelNumber?: string | null;
        SerialNumber?: string | null;
        QuantityDelivered: number;
        UnitCost: number;
        TotalCost: number;
        inspection_status?: 'pending' | 'inspected';
        PropertyTypeID?: number;
        unitOfMeasure?: {
            UnitOfMeasureID: number;
            UnitName: string;
        } | null;
        propertyType?: {
            PropertyTypeID: number;
            PropertyName: string;
        } | null;
        unit_of_measure?: {
            UnitOfMeasureID: number;
            UnitName: string;
        } | null;
        property_type?: {
            PropertyTypeID: number;
            PropertyName: string;
        } | null;
    }>;
    iar?: InspectionReport | null;
}

export interface CreateInspectionReportPayload {
    dr_id: number;
    inspector_name: string;
    date_inspected: string;
    remarks?: string;
    items: {
        dr_detail_id: number;
        condition_id: number;
        quantity_accepted: number;
        quantity_rejected: number;
        verified_brand?: string | null;
        verified_model?: string | null;
        verified_serial?: string | null;
        no_serial?: boolean;
        remarks?: string;
        change_reason?: string;
    }[];
}

export interface UpdateInspectionReportPayload {
    remarks?: string;
    items: {
        dr_detail_id: number;
        condition_id: number;
        quantity_accepted: number;
        quantity_rejected: number;
        verified_brand?: string | null;
        verified_model?: string | null;
        verified_serial?: string | null;
        no_serial?: boolean;
        remarks?: string;
        change_reason?: string;
    }[];
}

export interface InspectionReportFilters {
    status?: 'pending' | 'inspected';
    per_page?: number;
    page?: number;
}
