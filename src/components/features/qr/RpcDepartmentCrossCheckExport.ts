import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { DepartmentCrossCheckResponse } from '@/types/rpcInventory';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
};

const TOTAL_COLS = 13;

function normalizeStatus(raw: unknown): 'scanned' | 'not_scanned' | 'other' {
    const s = String(raw ?? '').trim().toLowerCase();
    if (s === 'scanned') return 'scanned';
    if (s === 'not scanned' || s === 'unscanned') return 'not_scanned';
    return 'other';
}

function parseDate(value: unknown): Date | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(String(value));
    return isNaN(d.getTime()) ? null : d;
}

export async function exportDepartmentCrossCheckToExcel(
    data: DepartmentCrossCheckResponse,
    selectedType: string = 'ALL'
): Promise<void> {
    const department = data.department as
        | (NonNullable<DepartmentCrossCheckResponse['department']> & {
            DepartmentHead?: string;
        })
        | undefined;
    const items = data.data || [];
    const summary = data.summary;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GSO Inventory System';
    workbook.created = new Date();

    const deptCodeClean = (department?.DepartmentCode || 'DEPT').replace(/[^a-zA-Z0-9_-]/g, '_');
    const sheetName = `CrossCheck_${deptCodeClean}`.substring(0, 31);

    const worksheet = workbook.addWorksheet(sheetName, {
        pageSetup: {
            orientation: 'landscape',
            paperSize: 9,
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: {
                left: 0.4,
                right: 0.4,
                top: 0.5,
                bottom: 0.5,
                header: 0.2,
                footer: 0.2,
            },
        },
    });

    // 1. Column definitions
    worksheet.columns = [
        { key: 'po_number', width: 16 },
        { key: 'supplier', width: 22 },
        { key: 'par_ics', width: 18 },
        { key: 'quantity', width: 8 },
        { key: 'unit', width: 10 },
        { key: 'description', width: 34 },
        { key: 'property_number', width: 22 },
        { key: 'unit_cost', width: 15 },
        { key: 'total_cost', width: 16 },
        { key: 'date_received', width: 15 },
        { key: 'remarks', width: 18 },
        { key: 'end_user', width: 24 },
        { key: 'scan_status', width: 22 },
    ];

    // 2. TITLE (Row 1) — centered, no bold
    const row1 = worksheet.getRow(1);
    row1.getCell(1).value = 'PROPERTY ACKNOWLEDGEMENT RECEIPT';
    row1.getCell(1).font = { name: 'Calibri', size: 16 };
    row1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.mergeCells(1, 1, 1, TOTAL_COLS);
    row1.height = 26;

    // 3. Department Head / Department name (Row 2) — centered, no bold
    const row2 = worksheet.getRow(2);
    row2.getCell(1).value =
        department?.DepartmentHead && String(department.DepartmentHead).trim() !== ''
            ? `${String(department.DepartmentHead).toUpperCase()} / ${department?.DepartmentName ?? ''
            }`
            : `${department?.DepartmentName ?? ''}`;
    row2.getCell(1).font = { name: 'Calibri', size: 12 };
    row2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.mergeCells(2, 1, 2, TOTAL_COLS);
    row2.height = 20;

    // Row 3: spacer
    worksheet.getRow(3).height = 8;

    // 4. Table header (Row 4) — centered, no fill, no color, no bold
    const headers = [
        'PO Number',
        'Supplier',
        'PAR/ICS Number',
        'Quantity',
        'Unit',
        'Description',
        'Property Number',
        'Unit Cost',
        'Total Cost',
        'Date Received',
        'Remarks',
        'End User',
        'Scan Status',
    ];

    const headerRow = worksheet.getRow(4);
    headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', size: 9.5 };
        cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: true,
        };
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            bottom: { style: 'medium', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } },
        };
    });
    headerRow.height = 26;

    // 5. Data rows
    let currentRowIdx = 5;
    items.forEach((item) => {
        const row = worksheet.getRow(currentRowIdx);
        row.getCell(1).value = item.po_number || '-';
        row.getCell(2).value = item.supplier || '-';
        row.getCell(3).value = item.par_ics_number || '-';
        row.getCell(4).value = Number(item.quantity || 1);
        row.getCell(5).value = item.unit || 'unit';
        row.getCell(6).value = item.description || '-';
        row.getCell(7).value = item.property_number || '-';
        row.getCell(8).value = Number(item.unit_cost || 0);
        row.getCell(9).value = Number(item.total_cost || 0);

        const parsedDate = parseDate(item.date_received);
        if (parsedDate) {
            row.getCell(10).value = parsedDate;
            row.getCell(10).numFmt = 'yyyy-mm-dd';
        } else {
            row.getCell(10).value = '-';
        }

        row.getCell(11).value = item.remarks || '';
        row.getCell(12).value = item.end_user || '-';
        row.getCell(13).value = item.scan_status || 'Not Scanned';

        for (let col = 1; col <= TOTAL_COLS; col++) {
            const cell = row.getCell(col);
            cell.font = { name: 'Calibri', size: 9 };
            cell.border = THIN_BORDER;
            cell.alignment = {
                vertical: 'middle',
                horizontal: [4, 5, 10].includes(col)
                    ? 'center'
                    : [8, 9].includes(col)
                        ? 'right'
                        : 'left',
                wrapText: [2, 6, 11, 12].includes(col),
            };

            if (col === 4) {
                cell.numFmt = '#,##0';
            } else if (col === 8 || col === 9) {
                cell.numFmt = '#,##0.00';
            }
        }

        row.height = 22;
        currentRowIdx++;
    });

    // 6. Total row — style BEFORE merging, no bold
    const totalRow = worksheet.getRow(currentRowIdx);

    for (let c = 1; c <= TOTAL_COLS; c++) {
        const cell = totalRow.getCell(c);
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            bottom: { style: 'double', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } },
        };
    }

    totalRow.getCell(1).value = `Total Assets: ${items.length} items`;
    totalRow.getCell(1).font = { name: 'Calibri', size: 9.5 };
    totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.mergeCells(currentRowIdx, 1, currentRowIdx, 7);

    totalRow.getCell(8).value = 'Grand Total:';
    totalRow.getCell(8).font = { name: 'Calibri', size: 9.5 };
    totalRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    totalRow.getCell(9).value = Number(summary?.total_cost ?? 0);
    totalRow.getCell(9).numFmt = '#,##0.00';
    totalRow.getCell(9).font = { name: 'Calibri', size: 9.5 };
    totalRow.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };

    totalRow.height = 24;

    // 7. Freeze header (frozen below header row = 4)
    worksheet.views = [{ state: 'frozen', ySplit: 4 }];

    // 8. Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateFile = format(new Date(), 'yyyyMMdd');
    a.download = `CrossCheck_${deptCodeClean}_${dateFile}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}