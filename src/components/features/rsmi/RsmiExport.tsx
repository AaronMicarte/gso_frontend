import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { RsmiReport, RsmiReportItem } from '@/types/rsmi';

// ---------------------------------------------------------------------------
// Helper functions for safe text extraction
// ---------------------------------------------------------------------------
function text(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

const parseTrailingNumber = (value: string): { prefix: string; number: number; width: number } | null => {
    const trimmed = value.trim();
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (!match) return null;
    const numberText = match[2];
    return {
        prefix: match[1],
        number: Number(numberText),
        width: numberText.length,
    };
};

const formatStockRange = (values: string[]): string => {
    const unique = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
    if (unique.length === 0) return '';
    if (unique.length === 1) return unique[0];

    const parsed = unique.map((value) => ({ value, parsed: parseTrailingNumber(value) }));
    const firstParsed = parsed[0].parsed;
    const canCompact = !!firstParsed && parsed.every((item) => (
        item.parsed &&
        item.parsed.prefix === firstParsed.prefix &&
        item.parsed.width === firstParsed.width
    ));

    if (canCompact) {
        const sorted = parsed
            .map((item) => ({ parsed: item.parsed! }))
            .sort((a, b) => a.parsed.number - b.parsed.number);

        const blocks: string[] = [];
        let start = sorted[0].parsed.number;
        let previous = sorted[0].parsed.number;

        const pushBlock = (rangeStart: number, rangeEnd: number) => {
            const startFull = `${firstParsed.prefix}${String(rangeStart).padStart(firstParsed.width, '0')}`;
            if (rangeStart === rangeEnd) {
                blocks.push(startFull);
                return;
            }
            const endSuffix = String(rangeEnd).padStart(firstParsed.width, '0');
            blocks.push(`${startFull}/${endSuffix}`);
        };

        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i].parsed.number;
            if (current !== previous + 1) {
                pushBlock(start, previous);
                start = current;
            }
            previous = current;
        }
        pushBlock(start, previous);
        return blocks.join(', ');
    }

    return unique.slice().sort((a, b) => a.localeCompare(b)).join(', ');
};

// ---------------------------------------------------------------------------
// Border style factories
// ---------------------------------------------------------------------------
const thn = (): Partial<ExcelJS.Border> => ({ style: 'thin', color: { argb: 'FF000000' } });
const none = (): Partial<ExcelJS.Border> => ({ style: undefined });

function dataRowBorder(col: number, isLastRow = false): Partial<ExcelJS.Borders> {
    const left = thn();
    const right = thn();
    const bottom = isLastRow && col !== 1 && col !== 4 && col !== 5 ? thn() : none();

    return { top: none(), left, bottom, right };
}

// ---------------------------------------------------------------------------
// Core Export Functionality
// ---------------------------------------------------------------------------
export async function exportRsmiToExcel(
    report: RsmiReport,
    custodianName?: string,
): Promise<void> {

    const details = [...(report.items ?? [])];
    const itemMap = new Map<string, { item: RsmiReportItem; stockNos: string[] }>();

    for (const item of details) {
        const brand = (item as unknown as { brand?: string }).brand;
        const model = (item as unknown as { model?: string }).model;
        const desc = [item.item_description, brand, model].filter(Boolean).join(', ');
        const key = [item.ris_no, item.responsibility_center_code, desc, item.unit].join('||');
        const existing = itemMap.get(key);
        if (existing) {
            existing.item.quantity_issued += Number(item.quantity_issued ?? 0);
            if (item.stock_no) existing.stockNos.push(item.stock_no);
        } else {
            itemMap.set(key, {
                item: { ...item, item_description: desc, quantity_issued: Number(item.quantity_issued ?? 0) },
                stockNos: item.stock_no ? [item.stock_no] : [],
            });
        }
    }

    const baseDetails = [...itemMap.values()]
        .map(({ item, stockNos }) => {
            const brand = (item as unknown as { brand?: string }).brand;
            const model = (item as unknown as { model?: string }).model;
            return {
                ...item,
                // combine description, brand, model into a single display string
                item_description: [item.item_description, brand, model].filter(Boolean).join(', '),
                stock_no: formatStockRange(stockNos)
            };
        })
        .sort((a, b) => {
            const r = String(a.ris_no ?? '').localeCompare(String(b.ris_no ?? ''));
            return r !== 0 ? r : String(a.stock_no ?? '').localeCompare(String(b.stock_no ?? ''));
        });

    const totalActualItems = baseDetails.length;
    const targetRowCount = Math.max(8, totalActualItems + 2);
    const displayDetails = [...baseDetails];

    while (displayDetails.length < targetRowCount) {
        displayDetails.push({
            id: -(displayDetails.length + 1),
            ris_no: '', responsibility_center_code: '', stock_no: '',
            item_description: '', unit: '', quantity_issued: 0,
        } as unknown as RsmiReportItem & { stock_no: string });
    }

    const recapMap = new Map<string, { stockNos: string[]; quantity: number }>();
    for (const item of details) {
        const brand = (item as unknown as { brand?: string }).brand;
        const model = (item as unknown as { model?: string }).model;
        const desc = [item.item_description, brand, model].filter(Boolean).join(', ');
        const key = [desc, item.unit].join('||');
        const existing = recapMap.get(key);
        if (existing) {
            existing.quantity += Number(item.quantity_issued ?? 0);
            if (item.stock_no) existing.stockNos.push(item.stock_no);
        } else {
            recapMap.set(key, { stockNos: item.stock_no ? [item.stock_no] : [], quantity: Number(item.quantity_issued ?? 0) });
        }
    }

    const baseRecap = [...recapMap.values()]
        .map(({ stockNos, quantity }) => ({ stock_no: formatStockRange(stockNos), quantity }))
        .sort((a, b) => a.stock_no.localeCompare(b.stock_no));

    const totalActualRecap = baseRecap.length;
    const targetRecapRowCount = totalActualRecap + 10;
    const recapitulation = [...baseRecap];

    while (recapitulation.length < targetRecapRowCount) {
        recapitulation.push({ stock_no: '', quantity: 0 });
    }

    const reportDateLabel = (report.report_date_label && String(report.report_date_label).trim().length > 0)
        ? String(report.report_date_label).toUpperCase()
        : format(toZonedTime(new Date(report.report_date || new Date()), 'Asia/Manila'), 'MMMM d, yyyy').toUpperCase();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GSO';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('RSMI', {
        pageSetup: {
            paperSize: 9,
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            verticalCentered: false
        },
    });

    ws.pageSetup.margins = { left: 0.65, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };

    ws.getColumn('A').width = 12.0;
    ws.getColumn('B').width = 16.63;
    ws.getColumn('C').width = 14.63;
    ws.getColumn('D').width = 14.0;
    ws.getColumn('E').width = 13.88;
    ws.getColumn('F').width = 13.25;
    ws.getColumn('G').width = 18.88;
    ws.getColumn('H').width = 24.38;

    const tnr = (size = 11, bold = false, italic = false) =>
        ({ name: 'Times New Roman', size, bold, italic } as Partial<ExcelJS.Font>);

    function fill(
        coord: string,
        value: ExcelJS.CellValue,
        fontOpts?: Partial<ExcelJS.Font>,
        align?: Partial<ExcelJS.Alignment>,
        border?: Partial<ExcelJS.Borders>,
    ) {
        const cell = ws.getCell(coord);
        cell.value = value;
        if (fontOpts) cell.font = fontOpts;
        if (align) cell.alignment = align;
        if (border) cell.border = border;
    }

    // Header Blocks
    ws.getRow(1).height = 23.25; ws.getRow(2).height = 18.75; ws.getRow(3).height = 18.75; ws.getRow(4).height = 20.25;
    ws.getRow(5).height = 15.75; ws.getRow(6).height = 20.25; ws.getRow(7).height = 9.75; ws.getRow(8).height = 22.5;
    ws.getRow(9).height = 17.25; ws.getRow(10).height = 19.5;

    fill('H1', 'Appendix 64', tnr(11), { horizontal: 'right', vertical: 'bottom' });
    ws.mergeCells('A3:H3');
    fill('A3', 'REPORT OF SUPPLIES AND MATERIALS ISSUED', tnr(14, true), { horizontal: 'center', vertical: 'bottom' });

    fill('A5', `Entity Name: ${text(report.entity_name)}`, tnr(11), { horizontal: 'left', vertical: 'bottom' });
    fill('A6', `Fund Cluster: ${text(report.fund_cluster)}`, tnr(11), { horizontal: 'left', vertical: 'bottom' });
    fill('G5', `Serial No. : ${text(report.serial_no)}`, tnr(11), { horizontal: 'left', vertical: 'bottom' });
    fill('G6', `Date : ${reportDateLabel}`, tnr(11), { horizontal: 'left', vertical: 'bottom' });

    // ── 2. TO BE FILLED AREA SECTION (Row 8) ───────────────────────────
    ws.mergeCells('A8:F8');
    ws.mergeCells('G8:H8');

    fill('A8', 'To be filled up by the Supply and/or Property Division/Unit', tnr(11, false, true), { horizontal: 'center', vertical: 'middle' });
    fill('G8', 'To be filled up by the Accounting Division/Unit', tnr(11, false, true), { horizontal: 'center', vertical: 'middle' });

    // FIX 1: Explicitly re-apply left/right borders to ALL underlying cells in Row 8 after merging
    for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(8, c);
        cell.border = {
            top: thn(),
            bottom: thn(),
            left: (c === 1 || c === 7) ? thn() : none(),
            right: (c === 6 || c === 8) ? thn() : none()
        };
    }

    // Ensure the merged A8:F8 has a visible left border (fixes missing left edge)
    const a8Cell = ws.getCell(8, 1);
    a8Cell.border = { ...(a8Cell.border || {}), left: thn() };

    const colHeaders: [string, string][] = [
        ['A9:A10', 'RIS No.'], ['B9:B10', 'Responsibility Center Code'], ['C9:C10', 'Stock No.'],
        ['D9:D10', 'Item'], ['E9:E10', 'Unit'], ['F9:F10', 'Quantity\nIssued'],
        ['G9:G10', 'Unit Cost'], ['H9:H10', 'Amount'],
    ];

    for (const [range, label] of colHeaders) {
        ws.mergeCells(range);
        const cell = ws.getCell(range.split(':')[0]);
        cell.value = label;
        cell.font = tnr(11, true);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    for (let r = 9; r <= 10; r++) {
        for (let c = 1; c <= 8; c++) {
            const cell = ws.getCell(r, c);
            cell.border = {
                top: r === 9 ? thn() : none(),
                bottom: r === 10 ? thn() : none(),
                left: thn(),
                right: thn()
            };
        }
    }

    // ── 3. WRITE MAIN STOCKS RECORDS GRID (Starts row 11) ────────────────────
    let currentRow = 11;
    const totalLinesToRender = displayDetails.length;
    type CombinedReportItem = RsmiReportItem & { stock_no?: string };

    for (let i = 0; i < totalLinesToRender; i++) {
        ws.getRow(currentRow).height = 18;
        const item = displayDetails[i] as CombinedReportItem;
        const isLastRow = i === totalLinesToRender - 1;

        const values: (string | number)[] = [
            item.ris_no === 'N/A' ? '' : text(item.ris_no),
            text(item.responsibility_center_code),
            text(item.stock_no),
            text(item.item_description),
            text(item.unit),
            item.quantity_issued > 0 ? item.quantity_issued : '',
            '', '',
        ];

        const hAligns: ExcelJS.Alignment['horizontal'][] = [
            'left', 'left', 'left', 'left', 'left', 'right', 'right', 'right',
        ];

        for (let c = 1; c <= 8; c++) {
            const cell = ws.getCell(currentRow, c);
            cell.value = values[c - 1];
            cell.font = tnr(11);
            cell.alignment = { horizontal: hAligns[c - 1], vertical: 'middle' };
            cell.border = dataRowBorder(c, isLastRow);
        }
        currentRow++;
    }

    // ── 4. WRITE RECAPITULATION BLOCK WITH CLOSED BOXES ──────────────────────
    ws.getRow(currentRow).height = 18;

    ws.mergeCells(`B${currentRow}:C${currentRow}`);
    ws.mergeCells(`F${currentRow}:H${currentRow}`);

    ws.getCell(currentRow, 1).border = { left: thn(), right: thn(), top: none(), bottom: none() };
    ws.getCell(currentRow, 2).border = { left: thn(), right: thn(), top: thn(), bottom: thn() };
    ws.getCell(currentRow, 3).border = { left: thn(), right: thn(), top: thn(), bottom: thn() };
    ws.getCell(currentRow, 4).border = { left: thn(), right: thn(), top: none(), bottom: none() };
    ws.getCell(currentRow, 5).border = { left: thn(), right: thn(), top: none(), bottom: none() };
    ws.getCell(currentRow, 6).border = { left: thn(), right: thn(), top: thn(), bottom: thn() };
    ws.getCell(currentRow, 7).border = { left: thn(), right: thn(), top: thn(), bottom: thn() };
    ws.getCell(currentRow, 8).border = { left: thn(), right: thn(), top: thn(), bottom: thn() };

    ws.getCell(currentRow, 2).value = 'Recapitulation:';
    ws.getCell(currentRow, 2).font = tnr(11, true);
    ws.getCell(currentRow, 2).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(currentRow, 6).value = 'Recapitulation:';
    ws.getCell(currentRow, 6).font = tnr(11, true);
    ws.getCell(currentRow, 6).alignment = { horizontal: 'center', vertical: 'middle' };

    currentRow++;

    ws.getRow(currentRow).height = 18;
    ws.mergeCells(`B${currentRow}:B${currentRow + 1}`);
    ws.mergeCells(`C${currentRow}:C${currentRow + 1}`);
    ws.mergeCells(`F${currentRow}:F${currentRow + 1}`);
    ws.mergeCells(`G${currentRow}:G${currentRow + 1}`);
    ws.mergeCells(`H${currentRow}:H${currentRow + 1}`);

    ws.getCell(currentRow, 1).border = { left: thn(), right: thn(), top: none(), bottom: none() };
    ws.getCell(currentRow, 2).border = { left: thn(), right: thn(), top: thn(), bottom: none() };
    ws.getCell(currentRow, 3).border = { left: thn(), right: thn(), top: thn(), bottom: none() };
    ws.getCell(currentRow, 4).border = { left: thn(), right: thn(), top: none(), bottom: none() };
    ws.getCell(currentRow, 5).border = { left: thn(), right: thn(), top: none(), bottom: none() };
    ws.getCell(currentRow, 6).border = { left: thn(), right: thn(), top: thn(), bottom: none() };
    ws.getCell(currentRow, 7).border = { left: thn(), right: thn(), top: thn(), bottom: none() };
    ws.getCell(currentRow, 8).border = { left: thn(), right: thn(), top: thn(), bottom: none() };

    ws.getCell(currentRow, 2).value = 'Stock No.';
    ws.getCell(currentRow, 2).font = tnr(11, true);
    ws.getCell(currentRow, 2).alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getCell(currentRow, 3).value = 'Quantity';
    ws.getCell(currentRow, 3).font = tnr(11, true);
    ws.getCell(currentRow, 3).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(currentRow, 6).value = 'Unit Cost';
    ws.getCell(currentRow, 6).font = tnr(11, true);
    ws.getCell(currentRow, 6).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(currentRow, 7).value = 'Total Cost';
    ws.getCell(currentRow, 7).font = tnr(11, true);
    ws.getCell(currentRow, 7).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(currentRow, 8).value = 'UACS Object Code';
    ws.getCell(currentRow, 8).font = tnr(11, true);
    ws.getCell(currentRow, 8).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    currentRow++;

    ws.getRow(currentRow).height = 18;
    ws.getCell(currentRow, 1).border = { left: thn(), right: thn(), top: none(), bottom: none() };
    ws.getCell(currentRow, 2).border = { left: thn(), right: thn(), top: none(), bottom: thn() };
    ws.getCell(currentRow, 3).border = { left: thn(), right: thn(), top: none(), bottom: thn() };
    ws.getCell(currentRow, 4).border = { left: thn(), right: thn(), top: none(), bottom: none() };
    ws.getCell(currentRow, 5).border = { left: thn(), right: thn(), top: none(), bottom: none() };
    ws.getCell(currentRow, 6).border = { left: thn(), right: thn(), top: none(), bottom: thn() };
    ws.getCell(currentRow, 7).border = { left: thn(), right: thn(), top: none(), bottom: thn() };
    ws.getCell(currentRow, 8).border = { left: thn(), right: thn(), top: none(), bottom: thn() };

    currentRow++;

    for (let i = 0; i < recapitulation.length; i++) {
        ws.getRow(currentRow).height = 18;
        const recap = recapitulation[i];
        const isLast = i === recapitulation.length - 1;
        const bStyle = thn();

        ws.getCell(currentRow, 1).border = { left: thn(), right: thn(), top: none(), bottom: isLast ? thn() : none() };
        ws.getCell(currentRow, 2).border = { left: thn(), right: thn(), top: none(), bottom: bStyle };
        ws.getCell(currentRow, 3).border = { left: thn(), right: thn(), top: none(), bottom: bStyle };
        ws.getCell(currentRow, 4).border = { left: thn(), right: thn(), top: none(), bottom: isLast ? thn() : none() };
        ws.getCell(currentRow, 5).border = { left: thn(), right: thn(), top: none(), bottom: isLast ? thn() : none() };
        ws.getCell(currentRow, 6).border = { left: thn(), right: thn(), top: none(), bottom: bStyle };
        ws.getCell(currentRow, 7).border = { left: thn(), right: thn(), top: none(), bottom: bStyle };
        ws.getCell(currentRow, 8).border = { left: thn(), right: thn(), top: none(), bottom: bStyle };

        ws.getCell(currentRow, 2).value = recap.stock_no;
        ws.getCell(currentRow, 2).font = tnr(11);
        ws.getCell(currentRow, 2).alignment = { horizontal: 'left', vertical: 'middle' };

        ws.getCell(currentRow, 3).value = recap.quantity > 0 ? recap.quantity : '';
        ws.getCell(currentRow, 3).font = tnr(11);
        ws.getCell(currentRow, 3).alignment = { horizontal: 'right', vertical: 'middle' };

        currentRow++;
    }

    // ── 5. OUTPUT SIGNATURE CERTIFICATIONS BLOCK ─────────────────────────────
    ws.getRow(currentRow).height = 18;
    for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(currentRow, c);
        const b: Partial<ExcelJS.Borders> = { top: thn() };
        if (c === 1) b.left = thn();
        if (c === 5) b.right = thn();
        if (c === 6) b.left = thn();
        if (c === 8) b.right = thn();
        cell.border = b;
    }
    fill(`F${currentRow}`, 'Posted by:', tnr(12), { horizontal: 'left', vertical: 'bottom' });
    currentRow++;

    // FIX 2: Added structural border assignments for all columns on merged fields across the footer block
    ws.getRow(currentRow).height = 18;
    ws.mergeCells(`A${currentRow}:E${currentRow}`);
    ws.mergeCells(`F${currentRow}:G${currentRow}`);
    fill(`A${currentRow}`, '       I hereby certify to the correctness of the above information.', tnr(12), { horizontal: 'left', vertical: 'bottom' });

    for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(currentRow, c);
        cell.border = {
            left: (c === 1 || c === 6) ? thn() : cell.border?.left || none(),
            right: (c === 5 || c === 8) ? thn() : cell.border?.right || none(),
            top: cell.border?.top || none(),
            bottom: cell.border?.bottom || none()
        };
    }
    currentRow++;

    ws.getRow(currentRow).height = 18;
    ws.mergeCells(`A${currentRow}:E${currentRow}`);
    ws.mergeCells(`F${currentRow}:G${currentRow}`);
    const custLine = custodianName ? custodianName : '';
    fill(`A${currentRow}`, custLine, tnr(12), { horizontal: 'center', vertical: 'bottom' });

    for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(currentRow, c);
        cell.border = {
            left: (c === 1 || c === 6) ? thn() : cell.border?.left || none(),
            right: (c === 5 || c === 8) ? thn() : cell.border?.right || none(),
            top: cell.border?.top || none(),
            bottom: cell.border?.bottom || none()
        };
    }
    currentRow++;

    ws.getRow(currentRow).height = 33.75;
    ws.mergeCells(`B${currentRow}:D${currentRow}`);
    ws.mergeCells(`F${currentRow}:G${currentRow}`);

    fill(`B${currentRow}`, 'Signature over Printed Name of Supply and/or Property Custodian', tnr(12), { horizontal: 'center', vertical: 'bottom', wrapText: true });
    fill(`F${currentRow}`, 'Signature over Printed Name of Designated Accounting Staff', tnr(12), { horizontal: 'center', vertical: 'bottom', wrapText: true });
    fill(`H${currentRow}`, 'Date', tnr(12), { horizontal: 'center', vertical: 'bottom' });

    for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(currentRow, c);
        cell.border = {
            left: (c === 1 || c === 6) ? thn() : cell.border?.left || none(),
            right: (c === 5 || c === 8) ? thn() : cell.border?.right || none(),
            top: cell.border?.top || none(),
            bottom: cell.border?.bottom || none()
        };
    }
    currentRow++;

    ws.getRow(currentRow).height = 13.5;
    ws.mergeCells(`G${currentRow}:H${currentRow}`);
    for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(currentRow, c);
        cell.border = {
            bottom: thn(),
            left: (c === 1 || c === 6) ? thn() : none(),
            right: (c === 5 || c === 8) ? thn() : none()
        };
    }

    // ── 6. CONVERT WORKBOOK DATA AND DOWNLOAD FILE ───────────────────────────
    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const safeSerial = (typeof report.serial_no === 'string' && report.serial_no)
        ? report.serial_no.replace(/[^a-z0-9-_]/gi, '_')
        : 'rsmi';

    a.download = `RSMI_${safeSerial}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}