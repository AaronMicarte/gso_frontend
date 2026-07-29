import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { PropertyRlsddpReport } from '@/types/propertyRlsddp';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatPHDate = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
        const parsed = new Date(dateString);
        if (Number.isNaN(parsed.getTime())) return '';
        return format(toZonedTime(parsed, 'Asia/Manila'), 'MMMM dd, yyyy');
    } catch {
        return '';
    }
};

const ensureText = (value: unknown, fallback: string = ''): string => {
    const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    return text.length > 0 ? text : fallback;
};

const getItemDescription = (item: any): string => {
    if (item?.Description && String(item.Description).trim().length > 0) {
        return String(item.Description).trim();
    }
    const inv = item?.inventoryDetail;
    const drd = inv?.drDetail;
    const articleName = drd?.article?.ArticleName || inv?.ArticleName || '';
    const itemDesc = drd?.ItemDescription || inv?.ItemDescription || '';
    const brand = drd?.Brand || inv?.Brand || '';
    const model = drd?.ModelNumber || inv?.ModelNumber || '';
    const sn = drd?.SerialNumber || inv?.SerialNumber || '';

    const parts = [
        articleName,
        itemDesc,
        brand ? `Brand: ${brand}` : null,
        model ? `Model: ${model}` : null,
        sn ? `SN: ${sn}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'N/A';
};

const FONT_NAME = 'Aptos Narrow';
const fontBold = { name: FONT_NAME, size: 10, bold: true };
const fontNormal = { name: FONT_NAME, size: 10, bold: false };

const DATA_START = 22;
const DATA_END = 28;

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportRlsddpToExcel(report: PropertyRlsddpReport): Promise<void> {
    const templateUrl = `${window.location.origin}/assets/templates/RLSDDP.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Failed to load RLSDDP template (Status: ${response.status})`);
    const templateBuffer = await response.arrayBuffer();

    const templateWb = new ExcelJS.Workbook();
    await templateWb.xlsx.load(templateBuffer);
    const srcWs = templateWb.getWorksheet(1);
    if (!srcWs) throw new Error('Template worksheet not found');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('RLSDDP');

    // ── Copy images from template ─────────────────────────────────────────────
    if (srcWs.getImages) {
        srcWs.getImages().forEach((image) => {
            const img = templateWb.getImage(Number(image.imageId));
            const newImageId = wb.addImage({
                buffer: img.buffer,
                extension: img.extension,
            });
            ws.addImage(newImageId, image.range);
        });
    }

    // Copy column widths
    srcWs.columns.forEach((col, idx) => {
        ws.getColumn(idx + 1).width = col.width ?? 15;
    });

    // Copy merges
    const merges = (srcWs as any)._merges as Record<string, any>;
    if (merges) {
        Object.values(merges).forEach((merge: any) => {
            try {
                ws.mergeCells(
                    merge.model?.top,
                    merge.model?.left,
                    merge.model?.bottom,
                    merge.model?.right,
                );
            } catch { /* skip duplicate merges */ }
        });
    }

    // Copy all rows with styles and static values — skip data zone (rows 22–28)
    srcWs.eachRow({ includeEmpty: true }, (row, rowNum) => {
        const newRow = ws.getRow(rowNum);
        newRow.height = row.height ?? undefined;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
            const newCell = newRow.getCell(colNum);
            newCell.style = JSON.parse(JSON.stringify(cell.style));
            if (rowNum >= DATA_START && rowNum <= DATA_END) {
                newCell.value = null;
                return;
            }
            if (cell.formula) {
                newCell.value = { formula: cell.formula, result: cell.result };
            } else {
                newCell.value = cell.value;
            }
        });
    });

    // Helper for rich text fields (Bold label, Normal value)
    const fillLabeled = (
        row: number,
        col: number,
        label: string,
        val: string,
        alignOpts: Partial<ExcelJS.Alignment> = {}
    ) => {
        const cell = ws.getCell(row, col);
        cell.value = {
            richText: [
                { font: fontBold, text: label },
                { font: fontNormal, text: val },
            ],
        };
        const existingAlign = cell.alignment ?? {};
        cell.alignment = { vertical: 'middle', ...existingAlign, ...alignOpts };
    };

    // ── Row 6: Entity Name (B6) and Fund Cluster (G6) ────────────────────────
    fillLabeled(6, 2, 'Entity Name : ', ensureText(report.department?.DepartmentName, '_________________________________'));
    fillLabeled(6, 7, 'Fund Cluster: ', 'General Fund');

    // ── Row 8: Department (B8) and RLSDDP No. (G8) ───────────────────────────
    fillLabeled(8, 2, 'Department/Office : ', ensureText(report.department?.DepartmentName, ''));
    fillLabeled(8, 7, 'RLSDDP No. : ', ensureText(report.RlsddpNumber, ''));

    // ── Row 9: Accountable Officer (B9) and RLSDDP Date (G9) ─────────────────
    fillLabeled(9, 2, 'Accountable Officer : ', ensureText(report.AccountableOfficer, ''));
    fillLabeled(9, 7, 'RLSDDP Date : ', formatPHDate(report.created_at));

    // ── Row 10: Designation (B10) and PAR No. (G10) ──────────────────────────
    fillLabeled(10, 2, 'Designation : ', '');
    fillLabeled(10, 7, 'PAR No. : ', '');

    // ── Row 11: Police Notified section ──────────────────────────────────────
    if (report.PoliceNotified) {
        fillLabeled(11, 3, '☑ Yes', '', { horizontal: 'left' });
        fillLabeled(13, 3, '☐ No', '', { horizontal: 'left' });
        fillLabeled(11, 4, 'Police Station : ', ensureText(report.PoliceStation, ''));
        fillLabeled(12, 4, 'Date : ', formatPHDate(report.DateReported));
    } else {
        fillLabeled(11, 3, '☐ Yes', '', { horizontal: 'left' });
        fillLabeled(13, 3, '☑ No', '', { horizontal: 'left' });
        fillLabeled(11, 4, 'Police Station : ', '____________________');
        fillLabeled(12, 4, 'Date : ', '___________________________');
    }

    fillLabeled(11, 7, 'PAR Date : ', '');

    // ── Row 17–18: Status checkboxes ─────────────────────────────────────────
    const statusChecks: Record<string, [number, number]> = {
        Lost:      [17, 3],
        Damaged:   [17, 5],
        Stolen:    [18, 3],
        Destroyed: [18, 5],
    };

    Object.entries(statusChecks).forEach(([statusName, [r, c]]) => {
        const cell = ws.getCell(r, c);
        cell.value = report.Status === statusName ? '☑' : '☐';
        cell.font = fontBold;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // ── Rows 22–28: Data zone ─────────────────────────────────────────────────
    const items = report.items ?? [];
    const thin: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } };
    const medium: ExcelJS.Border = { style: 'medium', color: { argb: 'FF000000' } };

    for (let i = 0; i < 7; i++) {
        const rowNum = DATA_START + i;
        const isFirst = i === 0;
        const isLast = i === 6;

        const topB = isFirst ? medium : thin;
        const bottomB = isLast ? medium : thin;

        const item = items[i];

        // B column (Property No.)
        const propCell = ws.getCell(rowNum, 2);
        propCell.value = item ? ensureText(item.PropertyNumber, '') : null;
        propCell.font = fontNormal;
        propCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        propCell.border = { top: topB, bottom: bottomB, left: medium, right: medium };

        // C column (Description — merged C:F in this row per template merges)
        const descCell = ws.getCell(rowNum, 3);
        descCell.value = item ? getItemDescription(item) : null;
        descCell.font = fontNormal;
        descCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        descCell.border = { top: topB, bottom: bottomB, left: medium, right: thin };

        // D, E, F columns (part of description merge — keep borders only)
        [4, 5].forEach((c) => {
            const cell = ws.getCell(rowNum, c);
            cell.value = null;
            cell.border = { top: topB, bottom: bottomB };
        });
        const fCell = ws.getCell(rowNum, 6);
        fCell.value = null;
        fCell.border = { top: topB, bottom: bottomB, right: medium };

        // G column (Acquisition Cost — merged G:H per template)
        const cost = item ? Number(item.AcquisitionCost ?? (item as any).inventoryDetail?.UnitCost ?? 0) : null;
        const costCell = ws.getCell(rowNum, 7);
        costCell.value = cost && cost > 0 ? cost : null;
        costCell.numFmt = '#,##0.00';
        costCell.font = fontNormal;
        costCell.alignment = { horizontal: 'right', vertical: 'middle' };
        costCell.border = { top: topB, bottom: bottomB, left: medium, right: thin };

        // H column (part of cost merge)
        const hCell = ws.getCell(rowNum, 8);
        hCell.value = null;
        hCell.border = { top: topB, bottom: bottomB, right: medium };

        ws.getRow(rowNum).height = 15;
    }

    // ── Rows 30–33: Circumstances ─────────────────────────────────────────────
    const circumstanceRows = [30, 31, 32, 33];
    let remarkLines: string[] = [];

    if (report.Remarks && report.Remarks.trim()) {
        const MAX_CHARS = 85;
        const words = report.Remarks.trim().split(' ');
        let current = '';
        words.forEach((word) => {
            const candidate = current ? `${current} ${word}` : word;
            if (candidate.length > MAX_CHARS) {
                if (current) remarkLines.push(current);
                current = word;
            } else {
                current = candidate;
            }
        });
        if (current) remarkLines.push(current);
    }

    circumstanceRows.forEach((rowNum, i) => {
        const cell = ws.getCell(rowNum, 2);
        cell.value = remarkLines[i] ?? null;
        cell.font = fontNormal;
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // ── Row 39: Signature lines ───────────────────────────────────────────────
    const aoSigCell = ws.getCell(39, 2);
    aoSigCell.value = report.AccountableOfficer.toUpperCase();
    aoSigCell.font = { name: FONT_NAME, size: 11, bold: true };
    aoSigCell.alignment = { horizontal: 'center', vertical: 'bottom' };

    const aoDateCell = ws.getCell(41, 2);
    aoDateCell.value = formatPHDate(report.created_at);
    aoDateCell.font = fontNormal;
    aoDateCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const supName = ensureText((report as any).ImmediateSupervisor ?? '', '');
    if (supName) {
        const supSigCell = ws.getCell(39, 6);
        supSigCell.value = supName.toUpperCase();
        supSigCell.font = { name: FONT_NAME, size: 11, bold: true };
        supSigCell.alignment = { horizontal: 'center', vertical: 'bottom' };

        const supDateCell = ws.getCell(41, 6);
        supDateCell.value = formatPHDate(report.created_at);
        supDateCell.font = fontNormal;
        supDateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // ── Print setup ───────────────────────────────────────────────────────────
    ws.pageSetup = {
        orientation: 'portrait',
        paperSize: 5, // Legal
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };
    ws.views = [{ showGridLines: true }];

    // ── Output ────────────────────────────────────────────────────────────────
    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const safeNo = (typeof report.RlsddpNumber === 'string' && report.RlsddpNumber)
        ? report.RlsddpNumber.replace(/[/\\?%*:|"<>]/g, '-')
        : 'RLSDDP';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RLSDDP_${safeNo}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

export default exportRlsddpToExcel;
