// Procurement types for GSO IAMS
// Note: Purchase Requests and Purchase Orders have been removed per project requirements
// The system now starts directly at Delivery Receipts (DR)

export interface DeliveryReceiptDetail {
    DRDetailID?: number;
    DRID?: number;
    ArticleID?: number;
    ItemDescription: string;
    Brand?: string;
    ModelNumber?: string;
    SerialNumber?: string;
    PropertyTypeID: number;
    UnitOfMeasureID?: number;
    QuantityDelivered: number;
    QuantityRequested?: number;
    ChangeReason?: string | null;
    UnitCost: number;
    TotalCost: number;
    InspectionStatus?: 'pending' | 'inspected';
    article?: {
        ArticleID: number;
        ArticleName: string;
    };
    propertyType?: {
        PropertyTypeID: number;
        PropertyName: string;
    };
    unitOfMeasure?: {
        UnitOfMeasureID: number;
        UnitName: string;
    };
    inventoryDetails?: {
        InventoryDetailID: number;
        SourceDRDetailID: number;
        PropertyNumber: string;
    }[];
    propertyNumbers?: string[];
}

export interface DeliveryReceiptStatus {
    DRStatusID: number;
    StatusName: string;
}

export interface DeliveryReceipt {
    DRID: number;
    DRNumber: string;
    IARNumber?: string | null;
    SupplierID?: number | null;
    RequestedBy?: number | null; // FK -> user.UserID
    RequestedByName?: string | null; // convenience field from backend
    DepartmentID?: number | null; // derived from requester user
    DepartmentName?: string | null; // derived from requester user
    PRNumber?: string; // Manual PR number reference
    PONumber?: string; // Manual PO number reference
    SupplierName?: string; // Supplier display name
    InvoiceNumber?: string; // Invoice number from supplier
    DateReceived: string;
    ReceivedBy: number;
    InspectedBy?: number | null;
    DateInspected?: string | null;
    Remarks?: string;
    CreatedDate: string;
    dr_picture_url?: string; // URL to the DR picture
    InspectionStatus?: 'pending' | 'inspected';
    InspectionCompletedAt?: string | null;
    IsPartial?: boolean;
    is_partial?: boolean;
    FinalizedAt?: string | null;
    workflow_status?: 'pending_inspection' | 'to_be_accepted' | 'to_be_issued' | 'issued' | 'acknowledged' | string;
    workflow_status_label?: string | null;
    requestedByUser?: {
        UserID: number;
        FullName: string;
        DepartmentID: number;
        department?: {
            DepartmentID: number;
            DepartmentName: string;
        };
    };

    // Relationships
    details?: DeliveryReceiptDetail[];
    receivedByUser?: {
        UserID: number;
        FullName: string;
    };
    inspection_status?: 'pending' | 'inspected';
}

export interface CreateDeliveryReceiptPayload {
    dr_number: string;
    supplier_id: number;
    supplier_name?: string;
    requested_by_user_id: number;
    pr_number: string;
    po_number: string;
    invoice_number: string;
    date_received: string;
    remarks?: string;
    dr_picture: File;
    details: {
        item_description: string;
        brand?: string;
        model_number?: string;
        serial_number?: string;
        property_type_id: number;
        unit_of_measure_id: number;
        quantity_delivered: number;
        quantity_requested: number;
        change_reason?: string;
        unit_cost: number;
    }[];
}

export interface UpdateDeliveryReceiptPayload {
    dr_number: string;
    supplier_id: number;
    supplier_name?: string;
    requested_by_user_id: number;
    pr_number: string;
    po_number: string;
    invoice_number: string;
    date_received: string;
    remarks?: string;
    dr_picture: File;
    details: {
        dr_detail_id?: number; // Optional for updates, undefined for new items
        item_description: string;
        brand?: string;
        model_number?: string;
        serial_number?: string;
        property_type_id: number;
        unit_of_measure_id: number;
        quantity_delivered: number;
        quantity_requested: number;
        change_reason?: string;
        unit_cost: number;
    }[];
}

export interface DeliveryReceiptFilters {
    query?: string;
    start_date?: string;
    end_date?: string;
    supplier_name?: string;
    po_number?: string;
    per_page?: number;
    page?: number;
    supplier_id?: number;
    status?: 'to_be_issued' | 'acknowledged';
}


