import ExcelJS from 'exceljs';
import type { UnserviceableItemRow } from '@/types/propertyWaste';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface IiruspExportOptions {
    rows: UnserviceableItemRow[];
    startDate?: string;
    endDate?: string;
    mode?: 'month' | 'custom';
    entityName?: string;
    fundCluster?: string;
    accountableOfficer?: string;
    designation?: string;
    station?: string;
}

const formatPHDate = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'M/d/yyyy');
    } catch {
        return dateString;
    }
};

const getPeriodLabel = (startDate?: string, endDate?: string, mode: 'month' | 'custom' = 'custom'): string => {
    if (!startDate || !endDate) return '_________________________________';
    try {
        const start = toZonedTime(new Date(`${startDate}T00:00:00`), 'Asia/Manila');
        const end = toZonedTime(new Date(`${endDate}T00:00:00`), 'Asia/Manila');
        if (mode === 'month') return format(start, 'MMMM yyyy');
        if (startDate === endDate) return format(start, 'MMMM d, yyyy');
        if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth())
            return `${format(start, 'MMMM')} ${start.getDate()}-${end.getDate()}, ${format(start, 'yyyy')}`;
        if (start.getFullYear() === end.getFullYear())
            return `${format(start, 'MMMM d')} - ${format(end, 'MMMM d, yyyy')}`;
        return `${format(start, 'MMMM d, yyyy')} - ${format(end, 'MMMM d, yyyy')}`;
    } catch {
        return `${startDate} to ${endDate}`;
    }
};

const estimateLines = (text: string, charsPerLine: number): number => {
    if (!text || text.trim().length === 0) return 1;
    const segments = text.split('\n');
    return segments.reduce((acc, seg) => acc + Math.max(1, Math.ceil(seg.length / charsPerLine)), 0);
};

export async function exportIiruspToExcel(options: IiruspExportOptions): Promise<void> {
    const {
        rows,
        startDate,
        endDate,
        mode = 'custom',
        entityName = '',
        fundCluster = '',
        accountableOfficer = 'Nilo J. Sabayanon',
        designation = 'OIC-GSO',
        station = 'General Services Office',
    } = options;

    const templateUrl = `${window.location.origin}/assets/templates/Appendix_74_IIRUP.xlsx`;
    const response = await fetch(templateUrl);

    if (!response.ok) {
        throw new Error(`Failed to load template (Status: ${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet(1);
    if (!ws) throw new Error('Worksheet not found in template');

    // ── Update Header Title for Semi-Expendable ──
    const cellTitle = ws.getCell('B3');
    cellTitle.value = 'INVENTORY AND INSPECTION REPORT OF UNSERVICEABLE SEMI-EXPENDABLE PROPERTY';

    // ── Meta Header fields ──
    ws.getCell('B4').value = `As at  ${getPeriodLabel(startDate, endDate, mode)}`;
    ws.getCell('B6').value = `Entity Name: ${entityName || '_______________________________________'}`;
    ws.getCell('P6').value = `Fund Cluster : ${fundCluster || '_____________________'}`;

    // ── Row 7 Profile Coordinates Mapping ──
    const cellOfficer = ws.getCell('B7');
    cellOfficer.value = accountableOfficer;
    ws.getRow(7).getCell('B').alignment = { horizontal: 'center', vertical: 'bottom' };
    ws.getRow(7).getCell('B').font = { name: 'Calibri', size: 11, underline: 'single' };

    const cellDesignation = ws.getCell('G7');
    cellDesignation.value = designation;
    ws.getRow(7).getCell('G').alignment = { horizontal: 'center', vertical: 'bottom' };
    ws.getRow(7).getCell('G').font = { name: 'Calibri', size: 11, underline: 'single' };

    const cellStation = ws.getCell('L7');
    cellStation.value = station;
    ws.getRow(7).getCell('L').alignment = { horizontal: 'center', vertical: 'bottom' };
    ws.getRow(7).getCell('L').font = { name: 'Calibri', size: 11, underline: 'single' };

    // ── Column config ──
    const COL_CONFIG: Record<number, { width: number; charsPerLine: number }> = {
        1: { width: 3, charsPerLine: 999 },
        2: { width: 13, charsPerLine: 12 },
        3: { width: 35, charsPerLine: 38 },
        4: { width: 16, charsPerLine: 17 },
        5: { width: 8, charsPerLine: 7 },
        6: { width: 15, charsPerLine: 14 },
        7: { width: 16, charsPerLine: 15 },
    };

    for (const [colNum, config] of Object.entries(COL_CONFIG)) {
        ws.getColumn(Number(colNum)).width = config.width;
    }

    // ── Fill data rows ──
    const DATA_START_ROW = 15;
    const MAX_ROWS = 18;
    const LINE_HEIGHT = 15;
    const MIN_HEIGHT = 20;
    const PADDING = 6;

    for (let i = 0; i < Math.min(rows.length, MAX_ROWS); i++) {
        const row = rows[i];
        const r = DATA_START_ROW + i;

        const dateText = formatPHDate(row.dateAcquired);
        const partText = row.particulars ?? '';
        const propText = `ICS NO. ${row.propertyNumber ?? ''}`;
        const qtyText = String(row.quantity ?? '');
        const unitCost = row.unitCost !== null && row.unitCost !== undefined ? Number(row.unitCost) : '';
        const totalCost = row.totalCost !== null && row.totalCost !== undefined ? Number(row.totalCost) : '';

        ws.getCell(r, 2).value = dateText;
        ws.getCell(r, 3).value = partText;
        ws.getCell(r, 4).value = propText;
        ws.getCell(r, 5).value = qtyText;

        const ucCell = ws.getCell(r, 6);
        ucCell.value = unitCost;
        if (typeof ucCell.value === 'number') ucCell.numFmt = '#,##0.00';

        const tcCell = ws.getCell(r, 7);
        tcCell.value = totalCost;
        if (typeof tcCell.value === 'number') tcCell.numFmt = '#,##0.00';

        for (let c = 2; c <= 7; c++) {
            ws.getCell(r, c).alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true,
            };
        }

        const cellTexts: { col: number; text: string }[] = [
            { col: 2, text: dateText },
            { col: 3, text: partText },
            { col: 4, text: propText },
            { col: 5, text: qtyText },
            { col: 6, text: typeof unitCost === 'number' ? unitCost.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '' },
            { col: 7, text: typeof totalCost === 'number' ? totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '' },
        ];

        const maxLines = cellTexts.reduce((max, { col, text }) => {
            const chars = COL_CONFIG[col]?.charsPerLine ?? 20;
            return Math.max(max, estimateLines(text, chars));
        }, 1);

        ws.getRow(r).height = Math.max(MIN_HEIGHT, maxLines * LINE_HEIGHT + PADDING);
    }

    ws.pageSetup = {
        orientation: 'landscape',
        paperSize: 5,
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

    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const period = getPeriodLabel(startDate, endDate, mode).replace(/[/\\?%*:|"<>]/g, '-');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IIRUSP_${period}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}
