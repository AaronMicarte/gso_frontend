// Procurement types for GSO IAMS
// Note: Purchase Requests and Purchase Orders have been removed per project requirements
// The system now starts directly at Delivery Receipts (DR)

export interface DeliveryReceiptDetail {
    DRDetailID?: number;
    DRID?: number;
    ItemDescription: string;
    PropertyTypeID: number;
    QuantityDelivered: number;
    UnitCost: number;
    TotalCost: number;
    propertyType?: {
        PropertyTypeID: number;
        PropertyTypeName: string;
    };
}

export interface DeliveryReceiptStatus {
    DRStatusID: number;
    StatusName: string;
}

export interface DeliveryReceipt {
    DRID: number;
    DRNumber: string;
    PONumber: string; // Manual PO number reference (required for manual entry)
    SupplierName: string; // Manual supplier name (required for manual entry)
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
}

export interface CreateDeliveryReceiptPayload {
    supplier_name: string; // Required manual supplier name
    po_number: string; // Required manual PO reference
    invoice_number?: string; // Invoice number from supplier
    date_received: string;
    remarks?: string;
    details: {
        item_description: string;
        property_type_id: number;
        quantity_delivered: number;
        unit_cost: number;
    }[];
}

export interface UpdateDeliveryReceiptPayload {
    supplier_name: string;
    po_number: string;
    date_received: string;
    remarks?: string;
    details: {
        item_description: string;
        property_type_id: number;
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


