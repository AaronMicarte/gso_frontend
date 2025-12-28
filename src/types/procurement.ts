// Procurement types for GSO IAMS
// Note: Purchase Requests and Purchase Orders have been removed per project requirements
// The system now starts directly at Delivery Receipts (DR)

export interface DeliveryReceiptDetail {
    DRDetailID?: number;
    DRID?: number;
    ItemDescription: string;
    Brand?: string;
    ModelNumber?: string;
    SerialNumber?: string;
    PropertyTypeID: number;
    UnitOfMeasureID?: number;
    QuantityDelivered: number;
    UnitCost: number;
    TotalCost: number;
    propertyType?: {
        PropertyTypeID: number;
        PropertyName: string;
    };
    unitOfMeasure?: {
        UnitOfMeasureID: number;
        UnitName: string;
    };
}

export interface DeliveryReceiptStatus {
    DRStatusID: number;
    StatusName: string;
}

export interface DeliveryReceipt {
    DRID: number;
    DRNumber: string;
    PONumber?: string; // Manual PO number reference (OPTIONAL - just a reference)
    SupplierName: string; // Manual supplier name (required)
    InvoiceNumber?: string; // Invoice number from supplier
    DateReceived: string;
    ReceivedBy: number;
    Remarks?: string;
    CreatedDate: string;

    // Relationships
    details?: DeliveryReceiptDetail[];
    receivedByUser?: {
        UserID: number;
        FullName: string;
    };
    // IAR status
    hasIAR?: boolean;
    iar?: {
        IARID: number;
        IARNumber: string;
        DateInspected: string;
    };
    // Computed status string from backend: 'Pending IAR' | 'Inspected' | 'Accepted'
    iar_status?: string;
}

export interface CreateDeliveryReceiptPayload {
    dr_number: string;
    supplier_name: string; // Required manual supplier name
    po_number?: string; // OPTIONAL manual PO reference (just for record keeping)
    invoice_number?: string; // Invoice number from supplier
    date_received: string;
    remarks?: string;
    details: {
        item_description: string;
        brand?: string;
        model_number?: string;
        serial_number?: string;
        property_type_id: number;
        unit_of_measure_id: number;
        quantity_delivered: number;
        unit_cost: number;
    }[];
}

export interface UpdateDeliveryReceiptPayload {
    dr_number: string;
    supplier_name: string;
    po_number?: string; // OPTIONAL
    date_received: string;
    remarks?: string;
    details: {
        dr_detail_id?: number; // Optional for updates, undefined for new items
        item_description: string;
        brand?: string;
        model_number?: string;
        serial_number?: string;
        property_type_id: number;
        unit_of_measure_id: number;
        quantity_delivered: number;
        unit_cost: number;
    }[];
}

export interface DeliveryReceiptFilters {
    start_date?: string;
    end_date?: string;
    supplier_name?: string;
    po_number?: string;
    per_page?: number;
    page?: number;
}


