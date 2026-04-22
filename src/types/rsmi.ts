export interface RsmiReportItem {
    id: number;
    ris_no: string;
    responsibility_center_code: string;
    stock_no: string;
    item_description: string;
    unit: string;
    quantity_issued: number;
}

export interface RsmiRecapitulationItem {
    stock_no: string;
    quantity: number;
}

export interface RsmiReport {
    id: number;
    serial_no: string;
    report_date: string;
    report_date_label?: string;
    entity_name: string;
    fund_cluster: string;
    items: RsmiReportItem[];
    recapitulation: RsmiRecapitulationItem[];
}

export interface RsmiReportListItem {
    id: number;
    report_date: string;
    serial_no: string;
    entity_name: string;
    fund_cluster: string;
    created_by_user_id: number;
    items_count: number;
    items_sum_quantity_issued: number | null;
}
