import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { compressPropertyNumbers } from '@/lib/utils/propertyNumbers';
import type { RpcType, RpcInventoryReportRow, RpcInventoryReportResponse } from '@/types/rpcInventory';

const C_ARTICLE = 2;
const C_DESC = 3;
const C_PROP_NO = 4;
const C_UNIT = 5;
const C_UNIT_COST = 6;
const C_TOTAL_COST = 7;
const C_QTY_CARD = 8;
const C_QTY_COUNT = 9;
const C_SHORTAGE_Q = 10;
const C_SHORTAGE_V = 11;
const C_REMARKS = 12;
const C_END_USER = 13;
const C_DATE_DEPT = 14;

const DATA_START = 13;
const FONT = 'Aptos Narrow';
const THIN: ExcelJS.BorderStyle = 'thin';

const normalizeSortText = (v?: string | null) => (v || '').trim().toLocaleLowerCase();

const compareRows = (a: RpcInventoryReportRow, b: RpcInventoryReportRow): number => {
    const ak = [a.article, a.description].map(normalizeSortText).join('|');
    const bk = [b.article, b.description].map(normalizeSortText).join('|');
    const cmp = ak.localeCompare(bk, undefined, { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return normalizeSortText(a.property_number).localeCompare(
        normalizeSortText(b.property_number), undefined, { sensitivity: 'base' });
};

const formatPrintEndUser = (type: RpcType, officer?: string | null): string => {
    if (!officer) return '';
    const clean = officer.split('-')[0].trim();
    if (type === 'RPCPPE') {
        const parts = clean.split(/\s+/).filter(Boolean);
        if (!parts.length) return '';
        if (parts.length === 1) return parts[0].toUpperCase();
        return `${parts[0][0].toUpperCase()}. ${parts.slice(1).join(' ').toUpperCase()}`;
    }
    return clean.toUpperCase();
};

const extractDepartment = (officer?: string | null): string => {
    if (!officer) return '';
    const parts = officer.split('-');
    return parts.length > 1 ? parts.slice(1).join('-').trim().toUpperCase() : '';
};

const computeRemarks = (row: RpcInventoryReportRow): string => {
    if (row.remarks && row.remarks !== '-') return row.remarks;
    const expected = Number(row.quantity_per_card || 0);
    const counted = Number(row.quantity_per_count || 0);
    const notFound = expected - counted;
    if (expected > 0) {
        if (notFound <= 0) return '';
        if (notFound === expected) return 'Not Found';
        return `${notFound} Not Found`;
    }
    if (row.property_remarks && Object.keys(row.property_remarks).length > 0) {
        return Object.entries(row.property_remarks)
            .map(([pn, rm]) => `${pn}: ${rm ?? ''}`).join('; ');
    }
    return '';
};

const thinBox = (): Partial<ExcelJS.Borders> => ({
    top: { style: THIN },
    bottom: { style: THIN },
    left: { style: THIN },
    right: { style: THIN },
});

export async function exportRPCPPEToExcel(
    report: RpcInventoryReportResponse,
    type: RpcType = 'RPCPPE',
): Promise<void> {
    const templateUrl = `${window.location.origin}/assets/templates/RPCPPE.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Failed to load RPCPPE template (${response.status})`);
    const buffer = await response.arrayBuffer();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet(1);
    if (!ws) throw new Error('Worksheet not found in RPCPPE template');

    const tps = ws.pageSetup;
    const templatePaperSize = tps.paperSize;
    const templateMargins = tps.margins;
    const templateHCenter = tps.horizontalCentered;
    const templateVCenter = tps.verticalCentered;
    const templateColWidths: number[] = [];
    ws.columns.forEach((col, i) => {
        templateColWidths[i] = col.width ?? 8;
    });

    ws.name = 'TEMPLATE_TEMP_REMOVED';

    const bucket = type === 'RPCPPE' ? report.rpcppe : report.rpcsep;

    const generatedAt = report.generated_at || new Date().toISOString();
    const year = format(toZonedTime(new Date(generatedAt), 'Asia/Manila'), 'yyyy');
    const reportAsOfDate = `December 31, ${year}`;
    const assumedDate = `DECEMBER ${year}`;

    const groupedRows = bucket.rows.reduce<Record<string, RpcInventoryReportRow[]>>((acc, row) => {
        const key = (row.property_type || '').trim();
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
    }, {});

    const knownTypes = [...(bucket.property_types || [])]
        .map(n => n.trim()).filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const extraTypes = Object.keys(groupedRows)
        .filter(n => !knownTypes.includes(n))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const orderedTypes = [...knownTypes, ...extraTypes];

    const groups = orderedTypes.length > 0
        ? orderedTypes.map(pt => ({
            propertyType: pt,
            rows: [...(groupedRows[pt] || [])].sort(compareRows),
        }))
        : [{ propertyType: '', rows: [] as RpcInventoryReportRow[] }];

    groups.forEach((group, groupIndex) => {
        const sheet = wb.addWorksheet(group.propertyType.slice(0, 31) || `Sheet${groupIndex + 1}`);

        sheet.pageSetup.paperSize = 5; // Legal
        sheet.pageSetup.orientation = 'landscape';
        sheet.pageSetup.scale = 51;
        sheet.pageSetup.fitToPage = false;
        sheet.pageSetup.fitToWidth = undefined;
        sheet.pageSetup.fitToHeight = 0;
        sheet.pageSetup.margins = templateMargins;

        // Freeze rows 1-12 (header) so only data rows scroll
        sheet.views = [
            {
                state: 'frozen',
                ySplit: 12,
                topLeftCell: 'A13',
                activeCell: 'A13',
                zoomScale: 70,
                zoomScaleNormal: 70,
            }
        ];

        templateColWidths.forEach((w, i) => {
            if (w) sheet.getColumn(i + 1).width = w;
        });

        const HEADER_ROW_HEIGHTS: Record<number, number> = {
            2: 30, 3: 20, 4: 20, 5: 20,
            7: 40, 8: 20,
            11: 30, 12: 25,
        };
        Object.entries(HEADER_ROW_HEIGHTS).forEach(([r, h]) => {
            sheet.getRow(Number(r)).height = h;
        });

        writeTemplateHeader(sheet, type, reportAsOfDate, assumedDate, group.propertyType);

        const rows = group.rows;
        const lastDataRow = DATA_START + rows.length - 1;
        const TOTAL_ROW = DATA_START + rows.length;

        rows.forEach((row, idx) => {
            const r = DATA_START + idx;

            const set = (
                col: number,
                value: ExcelJS.CellValue,
                numFmt?: string,
                hAlign: ExcelJS.Alignment['horizontal'] = 'center',
            ) => {
                const cell = sheet.getCell(r, col);
                cell.value = value;
                cell.font = { name: FONT, size: 11 };
                cell.alignment = { horizontal: hAlign, vertical: 'middle', wrapText: true };
                cell.border = thinBox();
                if (numFmt) cell.numFmt = numFmt;
            };

            set(C_ARTICLE, row.article || '');
            set(C_DESC, row.description || '');
            set(C_PROP_NO, compressPropertyNumbers(row.property_number));
            set(C_UNIT, row.unit_of_measure || '');
            set(C_UNIT_COST, row.unit_value || 0, '#,##0.00');

            const gCell = sheet.getCell(r, C_TOTAL_COST);
            gCell.value = { formula: `H${r}*F${r}` };
            gCell.font = { name: FONT, size: 11 };
            gCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            gCell.border = thinBox();
            gCell.numFmt = '#,##0.00;;';

            set(C_QTY_CARD, row.quantity_per_card ?? 0, 'General');
            set(C_QTY_COUNT, row.quantity_per_count ?? 0, 'General');

            const jCell = sheet.getCell(r, C_SHORTAGE_Q);
            jCell.value = { formula: `H${r}-I${r}` };
            jCell.font = { name: FONT, size: 11 };
            jCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            jCell.border = thinBox();
            jCell.numFmt = '0';

            const kCell = sheet.getCell(r, C_SHORTAGE_V);
            kCell.value = { formula: `G${r}/H${r}*J${r}` };
            kCell.font = { name: FONT, size: 11 };
            kCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            kCell.border = thinBox();
            kCell.numFmt = '#,##0.00';

            set(C_REMARKS, computeRemarks(row));
            set(C_END_USER, formatPrintEndUser(type, row.accountable_officer));

            const nCell = sheet.getCell(r, C_DATE_DEPT);
            if (type === 'RPCPPE') {
                const dp = row.date_purchased && row.date_purchased !== '-' ? row.date_purchased : null;
                nCell.value = dp ? toZonedTime(new Date(dp), 'Asia/Manila') : null;
                nCell.numFmt = 'm/d/yy;@';
            } else {
                nCell.value = extractDepartment(row.accountable_officer);
            }
            nCell.font = { name: FONT, size: 11 };
            nCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            nCell.border = thinBox();
        });

        // Totals row
        sheet.getCell(TOTAL_ROW, C_UNIT).value = 'TOTAL';
        sheet.getCell(TOTAL_ROW, C_UNIT).font = { name: FONT, size: 11, bold: true };
        sheet.getCell(TOTAL_ROW, C_UNIT).alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells(TOTAL_ROW, C_UNIT_COST, TOTAL_ROW, C_TOTAL_COST);
        const totalValCell = sheet.getCell(TOTAL_ROW, C_UNIT_COST);
        totalValCell.value = rows.length > 0
            ? { formula: `SUM(G${DATA_START}:G${lastDataRow})` }
            : 0;
        totalValCell.font = { name: FONT, size: 11, bold: true };
        totalValCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totalValCell.numFmt = '#,##0.00';

        const totalQtyCard = sheet.getCell(TOTAL_ROW, C_QTY_CARD);
        totalQtyCard.value = rows.length > 0
            ? { formula: `SUM(H${DATA_START}:H${lastDataRow})` }
            : 0;
        totalQtyCard.font = { name: FONT, size: 11, bold: true };
        totalQtyCard.alignment = { horizontal: 'center', vertical: 'middle' };

        const totalQtyCount = sheet.getCell(TOTAL_ROW, C_QTY_COUNT);
        totalQtyCount.value = rows.length > 0
            ? { formula: `SUM(I${DATA_START}:I${lastDataRow})` }
            : 0;
        totalQtyCount.font = { name: FONT, size: 11, bold: true };
        totalQtyCount.alignment = { horizontal: 'center', vertical: 'middle' };

        // Signature block
        const sigOffset = (templateRow: number) => TOTAL_ROW + (templateRow - 152);

        const setStr = (r: number, col: number, value: string, bold = false, sz = 14) => {
            const cell = sheet.getCell(r, col);
            cell.value = value;
            cell.font = { name: FONT, size: sz, bold };
        };

        setStr(sigOffset(158), C_ARTICLE, 'Prepared by: ');

        setStr(sigOffset(160), C_DESC, 'JUN RAY B. APAG. LPT', true);
        sheet.getCell(sigOffset(160), C_DESC).alignment = { horizontal: 'left' };
        sheet.getCell(sigOffset(160), C_DESC).font = { name: FONT, size: 14, bold: true, underline: true };

        setStr(sigOffset(161), C_DESC, 'SUPPLY OFFICER II');
        sheet.getCell(sigOffset(161), C_DESC).alignment = { horizontal: 'left' };

        setStr(sigOffset(164), C_ARTICLE, 'Certified Correct:');
        setStr(sigOffset(164), C_QTY_COUNT, 'Approved by:');

        setStr(sigOffset(166), C_DESC, 'NILO J. SABAYANON', true);
        sheet.getCell(sigOffset(166), C_DESC).font = { name: FONT, size: 14, bold: true, underline: true };

        setStr(sigOffset(166), C_PROP_NO, 'MARY PAULINE J. GABULE, CPA', true);
        sheet.getCell(sigOffset(166), C_PROP_NO).font = { name: FONT, size: 14, bold: true, underline: true };

        sheet.mergeCells(sigOffset(166), C_SHORTAGE_Q, sigOffset(166), C_REMARKS);
        setStr(sigOffset(166), C_SHORTAGE_Q, 'HON. EDGAR S. LIGNES', true);
        sheet.getCell(sigOffset(166), C_SHORTAGE_Q).alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getCell(sigOffset(166), C_SHORTAGE_Q).font = { name: FONT, size: 14, bold: true, underline: true };

        setStr(sigOffset(167), C_DESC, '  OIC - GSO ');
        setStr(sigOffset(167), C_PROP_NO, 'CITY ACCOUNTANT');

        sheet.mergeCells(sigOffset(167), C_SHORTAGE_Q, sigOffset(167), C_REMARKS);
        setStr(sigOffset(167), C_SHORTAGE_Q, 'CITY MAYOR');
        sheet.getCell(sigOffset(167), C_SHORTAGE_Q).alignment = { horizontal: 'center', vertical: 'middle' };
        // Dynamic print area
        const lastPrintRow = sigOffset(167);
        sheet.pageSetup.printArea = `A1:P${lastPrintRow}`;
    });

    wb.removeWorksheet('TEMPLATE_TEMP_REMOVED');

    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const cycleLabel = report.cycle?.cycle_label
        ? report.cycle.cycle_label.replace(/[/\\?%*:|"<>]/g, '-')
        : 'report';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_${cycleLabel}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

function writeTemplateHeader(
    sheet: ExcelJS.Worksheet,
    type: RpcType,
    reportAsOfDate: string,
    assumedDate: string,
    propertyType: string,
): void {
    const THIN_STYLE: ExcelJS.BorderStyle = 'thin';
    const thinBox = (): Partial<ExcelJS.Borders> => ({
        top: { style: THIN_STYLE }, bottom: { style: THIN_STYLE },
        left: { style: THIN_STYLE }, right: { style: THIN_STYLE },
    });

    const merge = (r: number, c1: number, c2: number) => {
        try { sheet.mergeCells(r, c1, r, c2); } catch (_) { }
    };
    const setCell = (
        r: number, c: number, value: string,
        sz: number, bold: boolean,
        hAlign: ExcelJS.Alignment['horizontal'] = 'center',
    ) => {
        const cell = sheet.getCell(r, c);
        cell.value = value;
        cell.font = { name: FONT, size: sz, bold };
        cell.alignment = { horizontal: hAlign, vertical: 'middle', wrapText: true };
    };

    const title = type === 'RPCPPE'
        ? 'REPORT ON THE PHYSICAL COUNT OF PROPERTY, PLANT AND EQUIPMENT'
        : 'REPORT ON THE PHYSICAL COUNT OF SEMI-EXPENDABLE PROPERTY';
    const subtitle = type === 'RPCPPE'
        ? '(Type of Property, Plant and Equipment)'
        : '(Type of Semi-Expendable Property)';

    merge(2, 2, 14); setCell(2, 2, title, 16, true);
    merge(3, 2, 14); setCell(3, 2, propertyType, 12, true);
    merge(4, 2, 14); setCell(4, 2, subtitle, 12, false);
    merge(5, 2, 14); setCell(5, 2, `As of ${reportAsOfDate}`, 12, true);
    merge(7, 2, 14); setCell(7, 2,
        `For which NILO SABAYANON,OIC-CGSO, LOCAL GOVERNMENT UNIT OF ELSALVADOR CITY is accountable, having assumed such accountability on ${assumedDate}. `,
        11, false,
    );
    merge(8, 2, 14); setCell(8, 2,
        '                               (Name of Accountable officer)      (Official Designation)                               (LGU)                                                                                                                                                                                 (Date of Assumption)',
        9, false,
    );

    const rowSpanCols: Array<[number, string]> = [
        [2, 'ARTICLE'],
        [3, 'DESCRIPTION'],
        [4, type === 'RPCPPE' ? 'PROPERTY NUMBER' : 'SEMI-EXPENDABLE PROPERTY NO.'],
        [5, 'UNIT OF MEASURE'],
        [12, 'REMARKS'],
        [13, 'END USER '],
        [14, type === 'RPCPPE' ? 'DATE PURCHASE' : 'DEPARTMENT'],
    ];
    rowSpanCols.forEach(([col, label]) => {
        try { sheet.mergeCells(11, col, 12, col); } catch (_) { }
        const cell = sheet.getCell(11, col);
        cell.value = label;
        cell.font = { name: FONT, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBox();
    });

    try { sheet.mergeCells(11, 6, 11, 7); } catch (_) { }
    const uvCell = sheet.getCell(11, 6);
    uvCell.value = 'UNIT VALUE';
    uvCell.font = { name: FONT, size: 11 };
    uvCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    uvCell.border = thinBox();

    const bpcCell = sheet.getCell(11, C_QTY_CARD);
    bpcCell.value = 'BALANCE PER CARD';
    bpcCell.font = { name: FONT, size: 11 };
    bpcCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    bpcCell.border = thinBox();

    const ohpcCell = sheet.getCell(11, C_QTY_COUNT);
    ohpcCell.value = 'ON HAND PER COUNT';
    ohpcCell.font = { name: FONT, size: 11 };
    ohpcCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ohpcCell.border = thinBox();

    try { sheet.mergeCells(11, 10, 11, 11); } catch (_) { }
    const soCell = sheet.getCell(11, 10);
    soCell.value = 'SHORTAGE/OVERAGE';
    soCell.font = { name: FONT, size: 11 };
    soCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    soCell.border = thinBox();

    const subHeaders: Array<[number, string]> = [
        [6, 'Unit Cost'], [7, 'Total Cost'],
        [8, '(Quantity)'], [9, '(Quantity)'],
        [10, 'Quantity'], [11, 'Value'],
    ];
    subHeaders.forEach(([col, label]) => {
        const cell = sheet.getCell(12, col);
        cell.value = label;
        cell.font = { name: FONT, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBox();
    });
}

export default exportRPCPPEToExcel;