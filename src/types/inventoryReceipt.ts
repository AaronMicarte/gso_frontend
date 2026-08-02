export type InventoryReceiptDialogProps = {
    inventoryDetailId: number;
    inventoryId?: number;
    articleName?: string;
    unitOfMeasureId?: number;
};

export type UnitOfMeasure = {
    id?: number;
    UnitOfMeasureID?: number;
    name?: string;
    UnitName?: string;
};

export type InventoryDetail = {
    InventoryDetailID: number;
    UnitOfMeasureID?: number;
    UnitName?: string;
    unitName?: string;
    unit_of_measure_name?: string;
    Quantity?: number;
    UnitCost?: number;
    TotalCost?: number;
    dr_article_name?: string;
    PropertyName?: string;
    Description?: string;
    dr_item_description?: string;
    property_type_description?: string;
    PropertyNumber?: string;
    StatusName?: string;
    ConditionName?: string;
    custodianName?: string;
    DocumentType?: 'PAR' | 'ICS' | string;
    PropertyType?: {
        PropertyName?: string;
    };
    PropertyTypeName?: string;
    property_type_name?: string;
    UnitOfMeasure?: {
        UnitOfMeasureID?: number;
    };
};

export type PropertyCardRow = {
    entry_type?: string;
    date?: string;
    office_officer?: string;
    receipt_qty?: number;
};

export type PropertyCardHeader = {
    unit_cost?: number;
    po_number?: string;
    supplier?: string;
    date_received?: string;
    received_by?: string;
    description?: string;
    inventory_number?: string | null;
    property_number?: string | null;
    par_ics_number?: string | null;
    document_type?: 'PAR' | 'ICS' | null;
};

export type DeliveryReceipt = {
    DRNumber?: string;
    SupplierName?: string;
    DateReceived?: string;
};

export type IAR = {
    IARNumber?: string;
    deliveryReceipt?: DeliveryReceipt;
};

export type InventoryData = {
    details?: InventoryDetail[];
    iar?: IAR;
};

export type PropertyCardData = {
    header?: PropertyCardHeader;
    rows?: PropertyCardRow[];
};
