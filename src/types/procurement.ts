export interface PurchaseRequestDetail {
    PRDetailID?: number;
    PurchaseRequestID?: number;
    ItemDescription: string;
    Quantity?: number; // Legacy/Form
    UnitCost?: number; // Legacy/Form
    TotalCost?: number; // Legacy/Form

    // Database columns
    PropertyTypeID?: number;
    UnitOfMeasureID?: number;
    QuantityRequested?: number;
    EstimatedUnitCost?: number;
    EstimatedTotalCost?: number;

    Remarks?: string;
}

export interface PurchaseRequestStatus {
    PRStatusID: number;
    StatusName: string;
}

export interface PurchaseRequest {
    PurchaseRequestID: number;
    PRNumber: string;
    RequestedBy: number;
    DepartmentID: number;
    ApprovedBy?: number;
    PRStatusID: number;
    DateRequested: string; // ISO Date
    DateApproved?: string; // ISO Date
    Purpose: string;
    Remarks?: string;
    CreatedDate: string;
    UpdatedDate?: string;

    // Relationships
    details?: PurchaseRequestDetail[];
    status?: PurchaseRequestStatus;
    requester?: {
        UserID: number;
        FullName: string;
    };
    approver?: {
        UserID: number;
        FullName: string;
    };
    department?: {
        DepartmentID: number;
        DepartmentName: string;
    };
}

export interface CreatePurchaseRequestPayload {
    Purpose: string;
    DepartmentID: number; // Will be set from user's department
    items: {
        ItemDescription: string;
        Quantity: number;
        UnitCost: number;
        UnitOfMeasureID: number;
        Remarks?: string;
    }[];
}

export interface UpdatePurchaseRequestPayload {
    Purpose: string;
    DepartmentID: number;
    items: {
        ItemDescription: string;
        Quantity: number;
        UnitCost: number;
        UnitOfMeasureID: number;
        Remarks?: string;
    }[];
}

export interface PurchaseOrderDetail {
    PurchaseOrderDetailID?: number;
    PurchaseOrderID?: number;
    ItemDescription: string;
    Quantity: number;
    UnitCost: number;
    TotalCost: number;
    Remarks?: string;
}

export interface PurchaseOrderStatus {
    POStatusID: number;
    StatusName: string;
}

export interface PurchaseOrder {
    PurchaseOrderID: number;
    PONumber: string;
    PurchaseRequestID: number;
    SupplierID: number;
    POStatusID: number;
    PODate: string;
    ModeOfProcurement?: string;
    PlaceOfDelivery?: string;
    DateOfDelivery?: string;
    DeliveryTerm?: string;
    PaymentTerm?: string;
    TotalAmount: number;
    Remarks?: string;
    CreatedBy: number;
    CreatedDate: string;
    UpdatedDate?: string;

    // Relationships
    details?: PurchaseOrderDetail[];
    status?: PurchaseOrderStatus;
    supplier?: {
        SupplierID: number;
        SupplierName: string;
    };
    purchaseRequest?: PurchaseRequest;
    creator?: {
        UserID: number;
        FullName: string;
    };
}

export interface CreatePurchaseOrderPayload {
    PONumber: string;
    PurchaseRequestID: number;
    SupplierID: number;
    PODate: string;
    ModeOfProcurement?: string;
    PlaceOfDelivery?: string;
    DateOfDelivery?: string;
    DeliveryTerm?: string;
    PaymentTerm?: string;
    Remarks?: string;
    items: {
        ItemDescription: string;
        Quantity: number;
        UnitCost: number;
        Remarks?: string;
    }[];
}

export interface UpdatePurchaseOrderPayload {
    SupplierID?: number;
    PODate?: string;
    ModeOfProcurement?: string;
    PlaceOfDelivery?: string;
    DateOfDelivery?: string;
    DeliveryTerm?: string;
    PaymentTerm?: string;
    Remarks?: string;
    items?: {
        ItemDescription: string;
        Quantity: number;
        UnitCost: number;
        Remarks?: string;
    }[];
}

export interface DeliveryReceiptDetail {
    DRDetailID?: number;
    DRID?: number;
    ItemDescription: string;
    Quantity: number;
    UnitCost: number;
    TotalCost: number;
    Remarks?: string;
}

export interface DeliveryReceiptStatus {
    DRStatusID: number;
    StatusName: string;
}

export interface DeliveryReceipt {
    DRID: number;
    DRNumber: string;
    PurchaseOrderID: number;
    DRDate: string;
    ReceivedBy: number;
    DRStatusID: number;
    DeliveryDate?: string;
    InvoiceNumber?: string;
    Remarks?: string;
    CreatedBy: number;
    CreatedDate: string;
    UpdatedDate?: string;

    // Relationships
    details?: DeliveryReceiptDetail[];
    status?: DeliveryReceiptStatus;
    purchaseOrder?: PurchaseOrder;
    receiver?: {
        UserID: number;
        FullName: string;
    };
    creator?: {
        UserID: number;
        FullName: string;
    };
}

export interface CreateDeliveryReceiptPayload {
    DRNumber: string;
    PurchaseOrderID: number;
    DRDate: string;
    DeliveryDate?: string;
    InvoiceNumber?: string;
    Remarks?: string;
    items: {
        ItemDescription: string;
        Quantity: number;
        UnitCost: number;
        Remarks?: string;
    }[];
}

export interface UpdateDeliveryReceiptPayload {
    DRDate?: string;
    DeliveryDate?: string;
    InvoiceNumber?: string;
    Remarks?: string;
    items?: {
        ItemDescription: string;
        Quantity: number;
        UnitCost: number;
        Remarks?: string;
    }[];
}

export interface DeliveryReceiptFilters {
    status?: number;
    purchase_order_id?: number;
    date_from?: string;
    date_to?: string;
    per_page?: number;
    page?: number;
}
