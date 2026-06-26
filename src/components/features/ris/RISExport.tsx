import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { RisRecord } from '@/types/ris';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const ensureText = (value: unknown, fallback: string): string => {
    const t = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    return t.length > 0 ? t : fallback;
};

const parseTrailingNumber = (value: string): { prefix: string; number: number; width: number } | null => {
    const trimmed = value.trim();
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (!match) return null;
    return { prefix: match[1], number: Number(match[2]), width: match[2].length };
};

const formatStockRange = (values: string[]): string => {
    const unique = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
    if (unique.length === 0) return '';
    if (unique.length === 1) return unique[0];

    const parsed = unique.map((value) => ({ value, parsed: parseTrailingNumber(value) }));
    const firstParsed = parsed[0].parsed;
    const canCompact =
        !!firstParsed &&
        parsed.every(
            (item) =>
                item.parsed &&
                item.parsed.prefix === firstParsed.prefix &&
                item.parsed.width === firstParsed.width,
        );

    if (!canCompact) {
        return unique.slice().sort((a, b) => a.localeCompare(b)).join(', ');
    }

    const sorted = parsed
        .map((item) => ({ parsed: item.parsed! }))
        .sort((a, b) => a.parsed.number - b.parsed.number);

    const blocks: string[] = [];
    let start = sorted[0].parsed.number;
    let previous = sorted[0].parsed.number;

    const pushBlock = (rangeStart: number, rangeEnd: number) => {
        const startFull = `${firstParsed.prefix}${String(rangeStart).padStart(firstParsed.width, '0')}`;
        if (rangeStart === rangeEnd) { blocks.push(startFull); return; }
        blocks.push(`${startFull}/${String(rangeEnd).padStart(firstParsed.width, '0')}`);
    };

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i].parsed.number;
        if (current !== previous + 1) { pushBlock(start, previous); start = current; }
        previous = current;
    }
    pushBlock(start, previous);
    return blocks.join(', ');
};

const estimateWrappedRowHeight = (text: string, colWidthChars: number, fontSize = 11): number => {
    const lineHeightPt = fontSize * 1.3;
    if (!text) return lineHeightPt;
    // Smaller fonts fit more characters per line in the same column width.
    const sizeAdjustedWidthChars = colWidthChars * (11 / fontSize);
    const charsPerLine = Math.max(Math.floor(sizeAdjustedWidthChars * 0.85), 5);
    const lines = text.split('\n').reduce((total, segment) => {
        return total + Math.max(1, Math.ceil(segment.length / charsPerLine));
    }, 0);
    return Math.max(lineHeightPt, lines * lineHeightPt);
};

const isMultiStockNo = (text: string): boolean => /[,/]/.test(text);

// Scales the description font down as text length grows, so long multi-property-number
// descriptions (e.g. "Item, Brand, Model, PROP-0001,PROP-0002,PROP-0003") shrink to fit
// instead of overflowing the row or looking oversized relative to the cell.
const scaledDescriptionFontSize = (text: string): number => {
    const len = text.length;
    if (len <= 60) return 11;
    if (len <= 90) return 10;
    if (len <= 130) return 9;
    if (len <= 180) return 8;
    return 7;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SIG_FONT = { name: 'Arial', size: 8 } as const;
const SIG_ALIGN_CENTER: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: false };
const FONT = 'Aptos Narrow';

const COL_A_WIDTH = 13;
const COL_D_WIDTH = 39;

const DATA_START = 14;
const DATA_END = 47;

// ── Main export ──────────────────────────────────────────────────────────────

export async function exportRISToExcel(ris: RisRecord): Promise<void> {
    const templateUrl = `${window.location.origin}/assets/templates/RIS.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Failed to load RIS template (Status: ${response.status})`);
    const buffer = await response.arrayBuffer();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet(1);
    if (!ws) throw new Error('Worksheet not found in RIS template');

    // ── Resolve data ──────────────────────────────────────────────────────────

    const req = ris.request ?? ris.asset_request ?? null;

    const docDate = ensureText(
        formatPHDate(req?.RequestDate),
        formatPHDate(new Date().toISOString()),
    );
    const officeText = ensureText(
        req?.Office ?? req?.office ?? req?.department?.DepartmentName ?? '',
        '',
    );
    const supplierText = ensureText(req?.supplier_name ?? '', '');
    const risNumber = ensureText(ris.ris_number, '');

    // Baseline system fallback references
    const requesterFallbackName = ensureText(
        ris.signatures.received_by?.issued_to_name ||
        ris.signatures.received_by?.user?.FullName ||
        req?.requester?.FullName || '',
        'DEPARTMENT HEAD'
    );
    const requesterFallbackDesig = ensureText(req?.Office ?? req?.office ?? req?.department?.DepartmentName ?? '', '');

    // 1. Received by fallback chains
    const receivedByName = ensureText(
        ris.signatures.received_by?.issued_to_name ||
        ris.signatures.received_by?.user?.FullName ||
        requesterFallbackName,
        requesterFallbackName,
    );
    const receivedByDesig = ensureText(ris.signatures.received_by?.designation || '', requesterFallbackDesig);

    // 2. Requested by structural properties
    const requestedByName = ensureText(requesterFallbackName, requesterFallbackName);
    const requestedByDesig = ensureText(ris.signatures.received_by?.designation || '', requesterFallbackDesig);

    // 3. Approved by — checking approved_by first, falling back onto active Received By properties if null
    const approvedByName = ensureText(
        ris.signatures.approved_by?.user?.FullName || receivedByName,
        receivedByName
    );
    const approvedByDesig = ensureText(
        ris.signatures.approved_by?.designation || receivedByDesig,
        ''
    );

    // ── Header ────────────────────────────────────────────────────────────────

    ws.getCell('A6').value = 'LGU - EL SALVADOR';

    ws.getCell('F8').value = risNumber;
    ws.getCell('F8').font = { name: FONT, size: 11, bold: true };
    ws.getCell('F8').alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getCell('B10').value = officeText;
    ws.getCell('B10').font = { name: FONT, size: 11 };
    ws.getCell('B10').alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getCell('B9').value = supplierText;
    ws.getCell('B9').font = { name: FONT, size: 11, bold: true };
    ws.getCell('B9').alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getCell('F10').value = docDate;
    ws.getCell('F10').font = { name: FONT, size: 11, bold: true };
    ws.getCell('F10').alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Clear data rows 14–47 ─────────────────────────────────────────────────

    for (let r = DATA_START; r <= DATA_END; r++) {
        for (let c = 1; c <= 8; c++) {
            ws.getCell(r, c).value = null;
        }
    }

    // ── Item rows ─────────────────────────────────────────────────────────────

    // Row DATA_END (47) is reserved for the grand total, so items can only fill up to DATA_END - 1.
    const items = (ris.items ?? []).slice(0, (DATA_END - 1) - DATA_START + 1);
    let currentRow = DATA_START;

    items.forEach((item) => {
        if (currentRow > DATA_END) return;

        const propertyNumbers = item.property_numbers?.length
            ? item.property_numbers
            : item.stock_no ? [item.stock_no] : [];
        const stockNoText = formatStockRange(propertyNumbers) || ensureText(item.stock_no, '');

        const stockIsMulti = isMultiStockNo(stockNoText);
        ws.getCell(currentRow, 1).value = stockNoText || null;
        ws.getCell(currentRow, 1).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 1).alignment = stockIsMulti
            ? { horizontal: 'center', vertical: 'middle', wrapText: true }
            : { horizontal: 'center', vertical: 'middle', wrapText: false, shrinkToFit: true };

        ws.getCell(currentRow, 2).value = ensureText(item.unit, '') || null;
        ws.getCell(currentRow, 2).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 2).alignment = { horizontal: 'center', vertical: 'middle' };

        const descriptionText =
            [item.description, item.brand, item.model, item.serial]
                .map((v) => ensureText(v ?? '', ''))
                .filter(Boolean)
                .join(', ') || null;

        const descFontSize = scaledDescriptionFontSize(descriptionText ?? '');

        ws.getCell(currentRow, 4).value = descriptionText;
        ws.getCell(currentRow, 4).font = { name: FONT, size: descFontSize };
        ws.getCell(currentRow, 4).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        ws.getCell(currentRow, 3).font = { name: FONT, size: descFontSize };
        ws.getCell(currentRow, 3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        ws.getCell(currentRow, 5).value = item.quantity_requested ?? null;
        ws.getCell(currentRow, 5).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 5).alignment = { horizontal: 'center', vertical: 'middle' };

        // Real per-unit cost from the delivery receipt (drDetail.UnitCost), NOT quantity_issued.
        const unitCost = item.unit_cost == null ? null : Number(item.unit_cost);
        ws.getCell(currentRow, 6).value = unitCost;
        ws.getCell(currentRow, 6).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 6).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getCell(currentRow, 6).numFmt = '#,##0.00';

        ws.getCell(currentRow, 7).value = { formula: `E${currentRow}*F${currentRow}` };
        ws.getCell(currentRow, 7).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 7).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getCell(currentRow, 7).numFmt = '#,##0.00';

        const descHeight = estimateWrappedRowHeight(descriptionText ?? '', COL_D_WIDTH, descFontSize);
        const stockHeight = stockIsMulti ? estimateWrappedRowHeight(stockNoText, COL_A_WIDTH, 10) : 14.4;
        ws.getRow(currentRow).height = Math.max(14.4, stockHeight, descHeight);

        currentRow++;
    });

    // ── Grand total (G47 — last row of the data block) ──────────────────────────
    // Row DATA_END is reserved (items stop one row earlier), so this never self-references.
    // Sums every per-row Total that actually got filled, regardless of item count.
    const lastFilledRow = currentRow - 1;
    if (lastFilledRow >= DATA_START) {
        ws.getCell(DATA_END, 7).value = { formula: `SUM(G${DATA_START}:G${lastFilledRow})` };
    } else {
        ws.getCell(DATA_END, 7).value = 0;
    }
    ws.getCell(DATA_END, 7).font = { name: FONT, size: 10 };
    ws.getCell(DATA_END, 7).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(DATA_END, 7).numFmt = '#,##0.00';

    ws.getCell(DATA_END, 4).alignment = { horizontal: 'right', vertical: 'middle' };

    // ── Signatures ────────────────────────────────────────────────────────────

    // Enforcing text style configuration with single underline decoration only
    const SIG_FONT_NAME = { ...SIG_FONT, underline: 'single' } as const;

    // Requested by (A52:C52 merged)
    ws.getCell(52, 1).value = requestedByName.toUpperCase();
    ws.getCell(52, 1).font = { ...SIG_FONT_NAME };
    ws.getCell(52, 1).alignment = { ...SIG_ALIGN_CENTER };

    ws.getCell(53, 1).value = requestedByDesig || null;
    ws.getCell(53, 1).font = { ...SIG_FONT };
    ws.getCell(53, 1).alignment = { ...SIG_ALIGN_CENTER };

    // Approved by (C52 anchor) — Redirected check
    ws.getCell('C52').value = approvedByName.toUpperCase();
    ws.getCell('C52').font = { ...SIG_FONT_NAME };
    ws.getCell('C52').alignment = { ...SIG_ALIGN_CENTER };

    ws.getCell('C53').value = approvedByDesig || null;
    ws.getCell('C53').font = { ...SIG_FONT };
    ws.getCell('C53').alignment = { ...SIG_ALIGN_CENTER };

    // Issued by (E52 anchor)
    ws.getCell('E52').font = { ...SIG_FONT };
    ws.getCell('E52').alignment = { ...SIG_ALIGN_CENTER };

    ws.getCell('E53').font = { ...SIG_FONT };
    ws.getCell('E53').alignment = { ...SIG_ALIGN_CENTER };

    // Received by (F52:H52 merged)
    ws.getCell(52, 7).value = receivedByName.toUpperCase();
    ws.getCell(52, 7).font = { ...SIG_FONT_NAME };
    ws.getCell(52, 7).alignment = { ...SIG_ALIGN_CENTER };

    ws.getCell(53, 7).value = receivedByDesig || null;
    ws.getCell(53, 7).font = { ...SIG_FONT };
    ws.getCell(53, 7).alignment = { ...SIG_ALIGN_CENTER };

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

    // ── Download ──────────────────────────────────────────────────────────────

    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const safeRIS =
        typeof ris.ris_number === 'string' && ris.ris_number
            ? ris.ris_number.replace(/[/\\?%*:|"<>]/g, '-')
            : 'RIS';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RIS_${safeRIS}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

export default exportRISToExcel;