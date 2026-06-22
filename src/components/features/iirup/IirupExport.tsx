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
        accountableOfficer = '',
        designation = '',
        station = '',
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

    // ── 3. Row 7 Profile Coordinates Mapping ──
    ws.getCell('B7').value = accountableOfficer;
    ws.getCell('G7').value = designation;
    ws.getCell('L7').value = station;

    // ── 4. Fill data rows ──
    const DATA_START_ROW = 15;
    const MAX_ROWS = 18;

    for (let i = 0; i < Math.min(rows.length, MAX_ROWS); i++) {
        const row = rows[i];
        const r = DATA_START_ROW + i;

        // Set cell text values securely
        ws.getCell(r, 2).value = formatPHDate(row.dateAcquired);
        ws.getCell(r, 3).value = row.particulars ?? '';
        ws.getCell(r, 4).value = row.propertyNumber ?? '';
        ws.getCell(r, 5).value = row.quantity ?? '';

        // Force numeric formats to ensure calculations don't drop as strings
        const ucCell = ws.getCell(r, 6);
        ucCell.value = row.unitCost !== null && row.unitCost !== undefined ? Number(row.unitCost) : '';
        if (typeof ucCell.value === 'number') ucCell.numFmt = '#,##0.00';

        const tcCell = ws.getCell(r, 7);
        tcCell.value = row.totalCost !== null && row.totalCost !== undefined ? Number(row.totalCost) : '';
        if (typeof tcCell.value === 'number') tcCell.numFmt = '#,##0.00';
    }

    // ── 5. THE FIX: Smart Auto-Fit Data Columns (Columns 2 to 19) ──
    // This looks ONLY at your data rows (15 to 32) so header cards do not stretch columns
    for (let colNum = 2; colNum <= 19; colNum++) {
        const column = ws.getColumn(colNum);
        let maxLen = 11; // Good base baseline padding for dates and short cells

        // Loop through the data rows specifically to measure string sizes
        for (let r = DATA_START_ROW; r < DATA_START_ROW + MAX_ROWS; r++) {
            const cell = ws.getCell(r, colNum);
            if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                let textValue = String(cell.value);

                // If cell is a number and formatted with money strings, give it extra padding length
                if (cell.numFmt && typeof cell.value === 'number') {
                    textValue = cell.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }

                if (textValue.length > maxLen) {
                    maxLen = textValue.length;
                }
            }
        }
        // Set the calculated auto width plus extra safety padding cells
        column.width = maxLen + 3;
    }

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