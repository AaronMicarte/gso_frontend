import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { PropertyRlsddpReport } from '@/types/propertyRlsddp';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatPHDate = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
        const parsed = new Date(dateString);
        if (Number.isNaN(parsed.getTime())) return '';
        return format(toZonedTime(parsed, 'Asia/Manila'), 'MM/dd/yyyy');
    } catch {
        return '';
    }
};

const ensureText = (value: unknown, fallback: string = ''): string => {
    const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    return text.length > 0 ? text : fallback;
};

const getItemDescription = (item: any): string => {
    if (!item) return '';

    const inv = item?.inventoryDetail;
    const drd = inv?.drDetail;

    // Helper to strip any label prefixes like "Brand:", "Model:", "SN:", "Serial Number:", etc.
    const sanitize = (val: unknown): string => {
        if (!val) return '';
        return String(val)
            .replace(/^(Article Name|ArticleName|Item Description|ItemDescription|Brand|Model|Model Number|ModelNumber|SN|Serial Number|SerialNumber)\s*:\s*/i, '')
            .trim();
    };

    const articleName = sanitize(
        drd?.article?.ArticleName || drd?.article?.article_name ||
        inv?.ArticleName || inv?.article_name ||
        item?.ArticleName || item?.article_name || ''
    );

    const itemDesc = sanitize(
        drd?.ItemDescription || drd?.item_description ||
        inv?.ItemDescription || inv?.item_description ||
        item?.ItemDescription || item?.item_description || ''
    );

    const brand = sanitize(
        drd?.Brand || drd?.brand ||
        inv?.Brand || inv?.brand ||
        item?.Brand || item?.brand || ''
    );

    const model = sanitize(
        drd?.ModelNumber || drd?.model_number ||
        inv?.ModelNumber || inv?.model_number ||
        item?.ModelNumber || item?.model_number || ''
    );

    const sn = sanitize(
        drd?.SerialNumber || drd?.serial_number ||
        inv?.SerialNumber || inv?.serial_number ||
        item?.SerialNumber || item?.serial_number || ''
    );

    // Order: Article Name, Item Description, Brand, Model, Serial Number
    const parts: string[] = [];

    if (articleName) {
        parts.push(articleName);
    }

    if (itemDesc) {
        // Avoid repeating articleName if itemDesc already starts with or equals articleName
        if (articleName && itemDesc.toLowerCase().startsWith(articleName.toLowerCase())) {
            if (parts.length > 0) parts.pop();
            parts.push(itemDesc);
        } else if (articleName.toLowerCase() !== itemDesc.toLowerCase()) {
            parts.push(itemDesc);
        }
    }

    if (brand) parts.push(brand);
    if (model) parts.push(model);
    if (sn) parts.push(sn);

    // Fallback: If structured fields were empty, clean up raw item.Description string
    if (parts.length === 0 && (item?.Description || item?.description)) {
        const rawDesc = String(item.Description || item.description);
        return rawDesc
            .replace(/(Article Name|ArticleName|Item Description|ItemDescription|Brand|Model|Model Number|ModelNumber|SN|Serial Number|SerialNumber)\s*:\s*/gi, '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .join(', ');
    }

    return parts.filter(Boolean).join(', ');
};

const FONT_NAME = 'Times New Roman';
const fontBold = { name: FONT_NAME, size: 11, bold: true };
const fontNormal = { name: FONT_NAME, size: 11, bold: false };
const fontUnderlined = { name: FONT_NAME, size: 11, bold: false, underline: true };

const DATA_START = 22;
const DATA_END = 28;

// ── Drawing XML: inject ✓ into the correct Rectangle shapes ──────────────────

async function buildDrawingXml(
    templateBuffer: ArrayBuffer,
    report: PropertyRlsddpReport,
): Promise<string> {
    const zip = await JSZip.loadAsync(templateBuffer);
    let xml = await zip.file('xl/drawings/drawing1.xml')!.async('string');

    // shape id → whether it should show ✓
    const checks: Array<[string, boolean]> = [
        ['7', !!report.PoliceNotified],
        ['6', !report.PoliceNotified],
        ['4', report.Status === 'Lost'],
        ['2', report.Status === 'Damaged'],
        ['5', report.Status === 'Stolen'],
        ['3', report.Status === 'Destroyed'],
    ];

    // txBody that places a bold ✓, centered horizontally & vertically inside the rectangle
    const txBody =
        '<xdr:txBody>' +
        '<a:bodyPr anchor="ctr"/>' +
        '<a:lstStyle/>' +
        '<a:p>' +
        '<a:pPr algn="ctr"/>' +
        '<a:r>' +
        '<a:rPr lang="en-US" b="1" sz="900" dirty="0"/>' +
        '<a:t>\u2713</a:t>' +
        '</a:r>' +
        '</a:p>' +
        '</xdr:txBody>';

    // Split by anchor so each shape is processed independently
    const ANCHOR = '<xdr:twoCellAnchor>';
    const parts = xml.split(ANCHOR);

    const modified = parts.map((part, i) => {
        if (i === 0) return part; // preamble before first anchor
        for (const [id, checked] of checks) {
            if (checked && part.includes(`id="${id}" name="Rectangle 50"`)) {
                // Insert txBody just before the closing </xdr:sp>
                return part.replace('</xdr:sp>', `${txBody}</xdr:sp>`);
            }
        }
        return part;
    });

    return modified.join(ANCHOR);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportRlsddpToExcel(report: PropertyRlsddpReport): Promise<void> {
    const templateUrl = `${window.location.origin}/assets/templates/RLSDDP.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Failed to load RLSDDP template (Status: ${response.status})`);
    const templateBuffer = await response.arrayBuffer();

    // Build the modified drawing XML (✓ in the right rectangles) upfront
    const drawingXml = await buildDrawingXml(templateBuffer, report);

    // Load template into ExcelJS for cell structure / styles
    const templateWb = new ExcelJS.Workbook();
    await templateWb.xlsx.load(templateBuffer);
    const srcWs = templateWb.getWorksheet(1);
    if (!srcWs) throw new Error('Template worksheet not found');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('RLSDDP');

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
                    merge.model?.top, merge.model?.left,
                    merge.model?.bottom, merge.model?.right,
                );
            } catch { /* skip duplicates */ }
        });
    }

    // Checkbox linked cells — must never receive boolean values from the template copy
    const CHECKBOX_CELLS = new Set(['B11', 'B13', 'C17', 'C18', 'E17', 'E18']);

    // Copy all rows — skip data zone rows 22-28
    srcWs.eachRow({ includeEmpty: true }, (row, rowNum) => {
        if (rowNum >= DATA_START && rowNum <= DATA_END) {
            ws.getRow(rowNum).height = row.height ?? undefined;
            return;
        }
        const newRow = ws.getRow(rowNum);
        newRow.height = row.height ?? undefined;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
            const newCell = newRow.getCell(colNum);
            newCell.style = JSON.parse(JSON.stringify(cell.style));
            if (CHECKBOX_CELLS.has(cell.address)) {
                newCell.value = null; // cleared — ✓ lives in the drawing shape
                return;
            }
            if (cell.formula) {
                newCell.value = { formula: cell.formula, result: cell.result };
            } else {
                newCell.value = cell.value;
            }
        });
    });

    // Helper: rich-text label + underlined value with text wrapping
    const fillLabeled = (
        row: number,
        col: number,
        label: string,
        val: string,
        alignOpts: Partial<ExcelJS.Alignment> = {},
        isBoldLabel: boolean = true,
        underlineVal: boolean = true,
    ) => {
        const cell = ws.getCell(row, col);
        cell.value = {
            richText: [
                { font: isBoldLabel ? fontBold : fontNormal, text: label },
                { font: underlineVal ? fontUnderlined : fontNormal, text: val },
            ],
        };
        const existingAlign = cell.alignment ?? {};
        cell.alignment = { vertical: 'middle', wrapText: true, ...existingAlign, ...alignOpts };
    };

    // ── Rows 8–10: Header fields ───────────────────────────────────────────────
    fillLabeled(8, 2, 'Department/Office : ', ensureText(report.department?.DepartmentName, ''));
    fillLabeled(8, 7, 'RLSDDP No. : ', ensureText(report.RlsddpNumber, ''));

    fillLabeled(9, 2, 'Accountable Officer : ', ensureText(report.AccountableOfficer, ''));
    fillLabeled(9, 7, 'RLSDDP Date : ', formatPHDate(report.created_at));

    fillLabeled(10, 2, 'Designation : ', '');
    fillLabeled(10, 7, 'PAR No. : ', ensureText((report as any).PARNumber ?? '', ''));

    // ── Row 11: Police Station / Date / PAR Date ──────────────────────────────
    fillLabeled(11, 2, 'Police Notified: ', ' ', {}, false, false);

    if (report.PoliceNotified) {
        fillLabeled(11, 4, 'Police Station : ', ensureText(report.PoliceStation, ''));
        fillLabeled(12, 4, 'Date : ', formatPHDate(report.DateReported));
    }
    fillLabeled(11, 7, 'PAR Date : ', formatPHDate((report as any).PARDate ?? null));

    // ── Rows 22–28: Data zone ─────────────────────────────────────────────────
    const items = report.items ?? [];
    const thin: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } };
    const medium: ExcelJS.Border = { style: 'medium', color: { argb: 'FF000000' } };

    for (let i = 0; i < 7; i++) {
        const rowNum = DATA_START + i;
        const topB = i === 0 ? medium : thin;
        const bottomB = i === 6 ? medium : thin;
        const item = items[i];

        // Property Number (Col 2)
        const propCell = ws.getCell(rowNum, 2);
        propCell.value = item ? ensureText(item.PropertyNumber, '') : null;
        propCell.font = fontNormal;
        propCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        propCell.border = { top: topB, bottom: bottomB, left: medium, right: medium };

        // Description (Cols 3–6 Merged)
        try {
            ws.mergeCells(rowNum, 3, rowNum, 6);
        } catch { /* skip if already merged */ }

        const desc = item ? getItemDescription(item) : null;
        const descCell = ws.getCell(rowNum, 3);
        descCell.value = desc && desc.length > 0 ? desc : null;
        descCell.font = fontNormal;
        descCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; // Centered alignment

        // Outer borders for Description span
        ws.getCell(rowNum, 3).border = { top: topB, bottom: bottomB, left: medium };
        ws.getCell(rowNum, 4).border = { top: topB, bottom: bottomB };
        ws.getCell(rowNum, 5).border = { top: topB, bottom: bottomB };
        ws.getCell(rowNum, 6).border = { top: topB, bottom: bottomB, right: medium };

        // Acquisition Cost (Col 7)
        const cost = item
            ? Number(
                item.AcquisitionCost ??
                (item as any).acquisition_cost ??
                (item as any).UnitCost ??
                (item as any).unit_cost ??
                (item as any).inventoryDetail?.UnitCost ??
                (item as any).inventoryDetail?.unit_cost ??
                0,
            )
            : null;
        const costCell = ws.getCell(rowNum, 7);
        costCell.value = cost !== null && cost > 0 ? cost : null;
        costCell.numFmt = '"₱"#,##0.00'; // Added Peso symbol format
        costCell.font = fontNormal;
        costCell.alignment = { horizontal: 'right', vertical: 'middle' };
        costCell.border = { top: topB, bottom: bottomB, left: medium };

        ws.getCell(rowNum, 8).border = { top: topB, bottom: bottomB, right: medium };

        // Dynamic Row Height Calculation based on text length
        if (desc && desc.length > 80) {
            ws.getRow(rowNum).height = 36;
        } else if (desc && desc.length > 40) {
            ws.getRow(rowNum).height = 26;
        } else {
            ws.getRow(rowNum).height = 20;
        }
    }

    // ── Rows 30–33: Circumstances ─────────────────────────────────────────────
    let remarkLines: string[] = [];
    if (report.Remarks?.trim()) {
        const MAX = 85;
        const words = report.Remarks.trim().split(' ');
        let cur = '';
        words.forEach((word) => {
            const candidate = cur ? `${cur} ${word}` : word;
            if (candidate.length > MAX) { if (cur) remarkLines.push(cur); cur = word; }
            else cur = candidate;
        });
        if (cur) remarkLines.push(cur);
    }
    [30, 31, 32, 33].forEach((rowNum, i) => {
        const cell = ws.getCell(rowNum, 2);
        cell.value = remarkLines[i] ?? null;
        cell.font = fontUnderlined;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // ── Row 39: Signatures ────────────────────────────────────────────────────
    const aoSigCell = ws.getCell(39, 2);
    aoSigCell.value = report.AccountableOfficer.toUpperCase();
    aoSigCell.font = { name: FONT_NAME, size: 11, bold: true, underline: true };
    aoSigCell.alignment = { horizontal: 'center', vertical: 'bottom' };

    ws.getCell(41, 2).value = formatPHDate(report.created_at);
    ws.getCell(41, 2).font = { name: FONT_NAME, size: 11, bold: false, underline: true };
    ws.getCell(41, 2).alignment = { horizontal: 'center', vertical: 'middle' };

    const supName = ensureText((report as any).ImmediateSupervisor ?? '', '');
    if (supName) {
        const supSigCell = ws.getCell(39, 6);
        supSigCell.value = supName.toUpperCase();
        supSigCell.font = { name: FONT_NAME, size: 11, bold: true, underline: true };
        supSigCell.alignment = { horizontal: 'center', vertical: 'bottom' };

        ws.getCell(41, 6).value = formatPHDate(report.created_at);
        ws.getCell(41, 6).font = { name: FONT_NAME, size: 11, bold: false, underline: true };
        ws.getCell(41, 6).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // ── Print setup ───────────────────────────────────────────────────────────
    ws.pageSetup = {
        orientation: 'portrait',
        paperSize: 5,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };
    ws.views = [{ showGridLines: true }];

    // ── Generate ExcelJS output buffer ────────────────────────────────────────
    const excelBuffer = await wb.xlsx.writeBuffer();

    // ── Inject drawing1.xml (with ✓ marks) into the output zip ───────────────
    const outZip = await JSZip.loadAsync(excelBuffer);

    // 1. Drawing file
    outZip.file('xl/drawings/drawing1.xml', drawingXml);

    // 2. Sheet rels — copy from template (rId1 → drawing1.xml)
    const templateZip = await JSZip.loadAsync(templateBuffer);
    const templateRels = await templateZip
        .file('xl/worksheets/_rels/sheet1.xml.rels')!
        .async('string');
    outZip.file('xl/worksheets/_rels/sheet1.xml.rels', templateRels);

    // 3. Sheet XML — add <drawing r:id="rId1"/> before </worksheet> if missing
    let sheetXml = await outZip.file('xl/worksheets/sheet1.xml')!.async('string');
    if (!sheetXml.includes('<drawing ')) {
        sheetXml = sheetXml.replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>');
        outZip.file('xl/worksheets/sheet1.xml', sheetXml);
    }

    // 4. Content-Types — add drawing override if missing
    let contentTypes = await outZip.file('[Content_Types].xml')!.async('string');
    if (!contentTypes.includes('drawing+xml')) {
        contentTypes = contentTypes.replace(
            '</Types>',
            '<Override PartName="/xl/drawings/drawing1.xml" ' +
            'ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' +
            '</Types>',
        );
        outZip.file('[Content_Types].xml', contentTypes);
    }

    const finalBuffer = await outZip.generateAsync({
        type: 'arraybuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });

    // ── Download ──────────────────────────────────────────────────────────────
    const blob = new Blob([finalBuffer], {
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