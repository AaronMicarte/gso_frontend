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

// ── Constants ─────────────────────────────────────────────────────────────────

const SIG_FONT = { name: 'Arial', size: 8 } as const;
// wrapText: false permits overflow behaviors if names or designations exceed template layouts
const SIG_ALIGN_CENTER: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: false };
const FONT = 'Aptos Narrow';

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
    const risNumber = ensureText(ris.ris_number, '');

    const requestedByName = ensureText(ris.signatures.requested_by?.user?.FullName, 'DEPARTMENT HEAD');
    const approvedByName = ensureText(ris.signatures.approved_by?.user?.FullName, 'DEPARTMENT HEAD');
    const receivedByName = ensureText(
        ris.signatures.received_by?.issued_to_name ??
        ris.signatures.received_by?.user?.FullName ??
        req?.requester?.FullName,
        'DEPARTMENT HEAD',
    );

    const requestedByDesig = ensureText(ris.signatures.requested_by?.designation ?? '', 'Department/Office');
    const approvedByDesig = ensureText(ris.signatures.approved_by?.designation ?? '', 'Department/Office');
    const receivedByDesig = ensureText(ris.signatures.received_by?.designation ?? '', 'Department/Office');

    // ── Header ────────────────────────────────────────────────────────────────

    ws.getCell('A6').value = 'CITY GOVERNMENT OF EL SALVADOR';

    ws.getCell('F8').value = risNumber;
    ws.getCell('F8').font = { name: FONT, size: 11, bold: true };
    ws.getCell('F8').alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getCell('B10').value = officeText;
    ws.getCell('B10').font = { name: FONT, size: 11 };
    ws.getCell('B10').alignment = { horizontal: 'left', vertical: 'middle' };

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

    const items = (ris.items ?? []).slice(0, DATA_END - DATA_START + 1);
    let currentRow = DATA_START;

    items.forEach((item) => {
        if (currentRow > DATA_END) return;

        const propertyNumbers = item.property_numbers?.length
            ? item.property_numbers
            : item.stock_no ? [item.stock_no] : [];
        const stockNoText = formatStockRange(propertyNumbers) || ensureText(item.stock_no, '');

        ws.getCell(currentRow, 1).value = stockNoText || null;
        ws.getCell(currentRow, 1).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        ws.getCell(currentRow, 2).value = ensureText(item.unit, '') || null;
        ws.getCell(currentRow, 2).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 2).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.getCell(currentRow, 3).value = ensureText(item.description, '') || null;
        ws.getCell(currentRow, 3).font = { name: FONT, size: 11 };
        ws.getCell(currentRow, 3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        ws.getCell(currentRow, 5).value = item.quantity_requested ?? null;
        ws.getCell(currentRow, 5).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 5).alignment = { horizontal: 'center', vertical: 'middle' };

        const qtyIssued = item.quantity_issued == null ? null : Number(item.quantity_issued);
        ws.getCell(currentRow, 6).value = qtyIssued;
        ws.getCell(currentRow, 6).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 6).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.getCell(currentRow, 7).value = ensureText(item.issue_remarks, '') || null;
        ws.getCell(currentRow, 7).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 7).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        ws.getRow(currentRow).height = 15.0;
        currentRow++;
    });

    // ── Signatures ────────────────────────────────────────────────────────────

    // Requested by (Column A / Column 1)
    ws.getCell(52, 1).value = requestedByName.toUpperCase();
    ws.getCell(52, 1).font = { ...SIG_FONT };
    ws.getCell(52, 1).alignment = { ...SIG_ALIGN_CENTER };

    ws.getCell(53, 1).value = requestedByDesig;
    ws.getCell(53, 1).font = { ...SIG_FONT };
    ws.getCell(53, 1).alignment = { ...SIG_ALIGN_CENTER };

    // Approved by (Target anchor cell is C52 based on template merge maps)
    ws.getCell('C52').value = approvedByName.toUpperCase();
    ws.getCell('C52').font = { ...SIG_FONT };
    ws.getCell('C52').alignment = { ...SIG_ALIGN_CENTER };

    ws.getCell('C53').value = approvedByDesig;
    ws.getCell('C53').font = { ...SIG_FONT };
    ws.getCell('C53').alignment = { ...SIG_ALIGN_CENTER };

    // Issued by (Target anchor cell is E52 based on template merge maps)
    ws.getCell('E52').font = { ...SIG_FONT };
    ws.getCell('E52').alignment = { ...SIG_ALIGN_CENTER };

    ws.getCell('E53').font = { ...SIG_FONT };
    ws.getCell('E53').alignment = { ...SIG_ALIGN_CENTER };

    // Received by (Column G / Column 7)
    ws.getCell(52, 7).value = receivedByName.toUpperCase();
    ws.getCell(52, 7).font = { ...SIG_FONT };
    ws.getCell(52, 7).alignment = { ...SIG_ALIGN_CENTER };

    ws.getCell(53, 7).value = receivedByDesig;
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