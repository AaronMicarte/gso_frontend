import ExcelJS from 'exceljs';
import type { UnserviceableItemRow } from '@/types/propertyWaste';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface IirupExportOptions {
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

export async function exportIirupToExcel(options: IirupExportOptions): Promise<void> {
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

    // ── 1. Load template safely via origin URL ──
    const templateUrl = `${window.location.origin}/assets/templates/Appendix_74_IIRUP.xlsx`;
    const response = await fetch(templateUrl);

    if (!response.ok) {
        throw new Error(`Failed to load IIRUP template (Status: ${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet(1);
    if (!ws) throw new Error('Worksheet not found in template');

    // ── 2. Fill Meta Header fields safely ──
    ws.getCell('B4').value = `As at  ${getPeriodLabel(startDate, endDate, mode)}`;
    ws.getCell('B6').value = `Entity Name: ${entityName || '_______________________________________'}`;
    ws.getCell('P6').value = `Fund Cluster : ${fundCluster || '_____________________'}`;

    // ── 3. Row 7 Profile Coordinates Mapping (Clean Merged Target Workaround) ──
    // Accountable Officer (B7 to E7 merged)
    const cellOfficer = ws.getCell('B7');
    cellOfficer.value = accountableOfficer;
    ws.getRow(7).getCell('B').alignment = { horizontal: 'center', vertical: 'bottom' };
    ws.getRow(7).getCell('B').font = { name: 'Calibri', size: 11, underline: 'single' };

    // Designation (G7 to J7 merged)
    const cellDesignation = ws.getCell('G7');
    cellDesignation.value = designation;
    ws.getRow(7).getCell('G').alignment = { horizontal: 'center', vertical: 'bottom' };
    ws.getRow(7).getCell('G').font = { name: 'Calibri', size: 11, underline: 'single' };

    // Station (L7 to O7 merged)
    const cellStation = ws.getCell('L7');
    cellStation.value = station;
    ws.getRow(7).getCell('L').alignment = { horizontal: 'center', vertical: 'bottom' };
    ws.getRow(7).getCell('L').font = { name: 'Calibri', size: 11, underline: 'single' };

    // ── 4. Fill data rows ──
    const DATA_START_ROW = 15;
    const MAX_ROWS = 18;

    for (let i = 0; i < Math.min(rows.length, MAX_ROWS); i++) {
        const row = rows[i];
        const r = DATA_START_ROW + i;

        ws.getCell(r, 2).value = formatPHDate(row.dateAcquired);
        ws.getCell(r, 3).value = row.particulars ?? '';
        ws.getCell(r, 4).value = row.propertyNumber ?? '';
        ws.getCell(r, 5).value = row.quantity ?? '';

        const ucCell = ws.getCell(r, 6);
        ucCell.value = row.unitCost !== null && row.unitCost !== undefined ? Number(row.unitCost) : '';
        if (typeof ucCell.value === 'number') ucCell.numFmt = '#,##0.00';

        const tcCell = ws.getCell(r, 7);
        tcCell.value = row.totalCost !== null && row.totalCost !== undefined ? Number(row.totalCost) : '';
        if (typeof tcCell.value === 'number') tcCell.numFmt = '#,##0.00';
    }

    // ── 5. Standard Appendix 74 Proportional Column Widths ──
    ws.getColumn(1).width = 3;   // Spacer column (A)
    ws.getColumn(2).width = 13;  // Date Acquired (B)
    ws.getColumn(3).width = 35;  // Particulars (C)
    ws.getColumn(4).width = 16;  // Property No (D)
    ws.getColumn(5).width = 8;   // Qty (E)
    ws.getColumn(6).width = 15;  // Unit Cost (F)
    ws.getColumn(7).width = 16;  // Total Cost (G)

    // ── 5b. Force Row Heights to expand cleanly if text wraps ──
    for (let r = DATA_START_ROW; r < DATA_START_ROW + MAX_ROWS; r++) {
        ws.getCell(r, 3).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        const particularsText = ws.getCell(r, 3).value;
        if (particularsText && String(particularsText).length > 30) {
            ws.getRow(r).height = 32;
        } else {
            ws.getRow(r).height = 20;
        }
    }

    // ── 5c. THE PRINT SCALING FIX: Force sheet onto 1 Landscape Page Wide ──
    ws.pageSetup = {
        orientation: 'landscape',
        paperSize: 5, // Legal paper size
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
            left: 0.5, right: 0.5,
            top: 0.5, bottom: 0.5,
            header: 0.3, footer: 0.3
        }
    };

    ws.views = [
        { showGridLines: true }
    ];

    // ── 6. Save and trigger automatic browser file download ──
    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const period = getPeriodLabel(startDate, endDate, mode).replace(/[/\\?%*:|"<>]/g, '-');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IIRUP_${period}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}