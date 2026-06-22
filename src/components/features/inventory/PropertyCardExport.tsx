import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { PropertyCardResponse } from '@/lib/api/inventory';

const formatPHDate = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
        const parsed = new Date(dateString);
        if (Number.isNaN(parsed.getTime())) return '';
        return format(toZonedTime(parsed, 'Asia/Manila'), 'MM/dd/yyyy');
    } catch {
        return dateString ?? '';
    }
};

const estimateLines = (text: string, charsPerLine: number): number => {
    if (!text || text.trim().length === 0) return 1;
    const segments = text.split('\n');
    return segments.reduce((acc, seg) => acc + Math.max(1, Math.ceil(seg.length / charsPerLine)), 0);
};

// Col index → chars per line for wrap estimation (based on template col widths)
const COL_CHARS: Record<number, number> = {
    2: 12,  // B  Date
    3: 16,  // C  Reference/PAR No.
    4: 8,   // D  Receipt Qty
    5: 8,   // E  Issue/Transfer Qty
    6: 18,  // F  Office/Officer (merged F:G)
    8: 8,   // H  Balance Qty
    9: 16,  // I  Amount
    10: 20, // J  Remarks
};

export async function exportPropertyCardToExcel(data: PropertyCardResponse): Promise<void> {
    // ── 1. Load template ──
    const templateUrl = `${window.location.origin}/assets/templates/Appendix_69_PC.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) {
        throw new Error(`Failed to load Property Card template (Status: ${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet(1);
    if (!ws) throw new Error('Worksheet not found in template');

    // ── 2. Fill header fields ──
    // Row 6: Entity Name (B6) | Fund Cluster (I6)
    ws.getCell('B6').value = `Entity Name : ${data.header.entity_name || '________________________________________'}`;
    ws.getCell('I6').value = `Fund Cluster: ${data.header.fund_cluster || '______________________'}`;

    // Row 8-9: Property, Plant and Equipment (B8) | Property Number (I9)
    ws.getCell('B8').value = `Property, Plant and Equipment : ${data.header.property_plant_equipment || ''}`;
    ws.getCell('I9').value = `Property Number: ${data.header.property_number || '_____________________'}`;

    // Row 10: Description (B10)
    ws.getCell('B10').value = `Description : ${data.header.description || ''}`;

    // ── 3. Fill data rows ──
    const DATA_START_ROW = 13;
    const LINE_HEIGHT = 16;
    const MIN_HEIGHT = 20;
    const PADDING = 6;

    for (let i = 0; i < data.rows.length; i++) {
        const row = data.rows[i];
        const r = DATA_START_ROW + i;

        const dateText = formatPHDate(row.date);
        const refText = row.reference ?? '';
        const receiptQty = row.receipt_qty !== null && row.receipt_qty !== undefined ? String(row.receipt_qty) : '';
        const issueQty = row.issue_qty !== null && row.issue_qty !== undefined ? String(row.issue_qty) : '';
        const officeText = row.office_officer ?? '';
        const balanceQty = row.balance_qty !== null && row.balance_qty !== undefined ? String(row.balance_qty) : '';
        const amountVal = row.amount !== null && row.amount !== undefined ? Number(row.amount) : '';
        const remarksText = row.remarks ?? '';

        // Set values
        ws.getCell(r, 2).value = dateText;
        ws.getCell(r, 3).value = refText;
        ws.getCell(r, 4).value = receiptQty;
        ws.getCell(r, 5).value = issueQty;
        ws.getCell(r, 6).value = officeText;   // merged F:G in template
        ws.getCell(r, 8).value = balanceQty;

        const amountCell = ws.getCell(r, 9);
        amountCell.value = amountVal;
        if (typeof amountVal === 'number') amountCell.numFmt = '#,##0.00';

        ws.getCell(r, 10).value = remarksText;

        // Alignment — all centered except office/officer and remarks (left)
        const alignCenter: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
        const alignLeft: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left', wrapText: true };
        const alignRight: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'right', wrapText: true };

        ws.getCell(r, 2).alignment = alignCenter;
        ws.getCell(r, 3).alignment = alignCenter;
        ws.getCell(r, 4).alignment = alignCenter;
        ws.getCell(r, 5).alignment = alignCenter;
        ws.getCell(r, 6).alignment = alignLeft;
        ws.getCell(r, 8).alignment = alignCenter;
        ws.getCell(r, 9).alignment = alignRight;
        ws.getCell(r, 10).alignment = alignLeft;

        // ── 2b. Force column widths wider to prevent cut-off ──
        ws.getColumn(2).width = 13;   // B  Date
        ws.getColumn(3).width = 18;   // C  Reference/PAR No.
        ws.getColumn(4).width = 9;    // D  Receipt Qty
        ws.getColumn(5).width = 9;    // E  Issue Qty
        ws.getColumn(6).width = 20;   // F  Office/Officer
        ws.getColumn(7).width = 20;   // G  Office/Officer (merged pair)
        ws.getColumn(8).width = 9;    // H  Balance Qty
        ws.getColumn(9).width = 16;   // I  Amount
        ws.getColumn(10).width = 20;   // J  Remarks

        // Estimate row height from longest wrapped column
        const cellTexts = [
            { col: 2, text: dateText },
            { col: 3, text: refText },
            { col: 4, text: receiptQty },
            { col: 5, text: issueQty },
            { col: 6, text: officeText },
            { col: 8, text: balanceQty },
            { col: 9, text: typeof amountVal === 'number' ? amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '' },
            { col: 10, text: remarksText },
        ];

        const maxLines = cellTexts.reduce((max, { col, text }) => {
            const chars = COL_CHARS[col] ?? 15;
            return Math.max(max, estimateLines(text, chars));
        }, 1);

        ws.getRow(r).height = Math.max(MIN_HEIGHT, maxLines * LINE_HEIGHT + PADDING);
    }

    // ── 4. Print setup ──
    ws.pageSetup = {
        orientation: 'portrait',
        paperSize: 5, // Legal
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
            left: 0.5, right: 0.5,
            top: 0.5, bottom: 0.5,
            header: 0.3, footer: 0.3,
        },
    };

    ws.views = [{ showGridLines: true }];

    // ── 5. Download ──
    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const propNum = (data.header.property_number ?? 'PC').replace(/[/\\?%*:|"<>]/g, '-');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PropertyCard_${propNum}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}