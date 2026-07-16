import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { PropertyTransfer, PropertyTransferItem } from '@/types/propertyTransfer';
import transferAPI from '@/lib/api/transfer';

// ── Types ────────────────────────────────────────────────────────────────────

interface ReceiverAssignment {
    inventory_detail_id: number;
    receiver_name: string;
    position_office?: string;
    quantity: number;
}

interface ReceiverGroup {
    receiverName: string;
    receiverOffice: string;
    items: Array<{ item: PropertyTransferItem; assignedQty: number }>;
}

interface CompressedItem {
    description: string;
    unitName: string;
    propertyNumbers: string[];
    unitCost: number;
    totalQty: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const ensureText = (value: unknown, fallback: string): string => {
    const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    return text.length > 0 ? text : fallback;
};

const FONT = 'Aptos Narrow';

// Template fixed rows
const DATA_START = 11;
const DATA_END = 26;
const TOTAL_ROW = 27;

// Signature block rows
const RELEASING_NAME_ROW = 39;
const RELEASING_POSITION_ROW = 41;
const RELEASING_DATE_ROW = 43;
const RECEIVING_NAME_ROW = 39;
const RECEIVING_POSITION_ROW = 41;
const RECEIVING_DATE_ROW = 43;
const WITNESSED_NAME_ROW = 48;
const WITNESSED_POSITION_ROW = 50;
const WITNESSED_DATE_ROW = 52;

// ── Property number compression ───────────────────────────────────────────────

function compressPropertyNumbers(items: Array<{ item: PropertyTransferItem; assignedQty: number }>): CompressedItem[] {
    const grouped = new Map<string, CompressedItem>();

    items.forEach((row) => {
        const inv = row.item.inventoryDetail as any;
        const articleName = inv?.drDetail?.article?.ArticleName;
        const itemDescription = inv?.drDetail?.ItemDescription;
        const description = ensureText(
            articleName
                ? `${articleName}${itemDescription ? `, ${itemDescription}` : ''}`
                : inv?.Description || itemDescription,
            'Item description',
        );
        const unitName = ensureText(inv?.unitOfMeasure?.UnitName, 'unit');
        const propertyNo = ensureText(inv?.PropertyNumber, '');
        const unitCost = Number(inv?.UnitCost ?? 0);
        const qty = Math.max(1, Number(row.assignedQty ?? 1));
        const key = `${description}||${unitName}||${unitCost}`;

        const existing = grouped.get(key);
        if (existing) {
            existing.propertyNumbers.push(propertyNo);
            existing.totalQty += qty;
        } else {
            grouped.set(key, { description, unitName, propertyNumbers: [propertyNo], unitCost, totalQty: qty });
        }
    });

    return Array.from(grouped.values());
}

function formatPropertyRange(numbers: string[]): string {
    if (numbers.length === 0) return '';
    if (numbers.length === 1) return numbers[0];

    const first = numbers[0];
    const match = first.match(/^(.*?)(\d+)$/);
    if (!match) return numbers.join(', ');

    const prefix = match[1];
    const suffixLen = match[2].length;

    const allMatch = numbers.every((n) => {
        const m = n.match(/^(.*?)(\d+)$/);
        return m && m[1] === prefix && m[2].length === suffixLen;
    });

    if (!allMatch) return numbers.join(', ');

    const suffixes = numbers
        .map((n) => parseInt(n.match(/(\d+)$/)![1], 10))
        .sort((a, b) => a - b);

    const ranges: string[] = [];
    let start = suffixes[0];
    let end = suffixes[0];

    for (let i = 1; i < suffixes.length; i++) {
        if (suffixes[i] === end + 1) {
            end = suffixes[i];
        } else {
            ranges.push(
                start === end
                    ? `${String(start).padStart(suffixLen, '0')}`
                    : `${String(start).padStart(suffixLen, '0')}/${String(end).padStart(suffixLen, '0')}`,
            );
            start = suffixes[i];
            end = suffixes[i];
        }
    }
    ranges.push(
        start === end
            ? `${String(start).padStart(suffixLen, '0')}`
            : `${String(start).padStart(suffixLen, '0')}/${String(end).padStart(suffixLen, '0')}`,
    );

    return `${prefix}${ranges.join(', ')}`;
}

// ── Resolve receiver groups ───────────────────────────────────────────────────

function buildReceiverGroups(
    assignments: ReceiverAssignment[],
    transfer: PropertyTransfer,
    fallbackReceivingName: string,
    fallbackReceivingOffice: string,
): ReceiverGroup[] {
    const grouped = new Map<string, {
        receiverName: string;
        receiverOffice: string;
        assignments: Array<{ inventory_detail_id: number; quantity: number }>;
    }>();

    assignments.forEach((a) => {
        const receiverName = String(a.receiver_name || '').trim() || fallbackReceivingName;
        const receiverOffice = String(a.position_office ?? '').trim();
        const key = `${receiverName}||${receiverOffice}`;
        const qty = Math.max(1, Number(a.quantity ?? 1));
        const page = grouped.get(key);
        if (page) {
            page.assignments.push({ inventory_detail_id: a.inventory_detail_id, quantity: qty });
        } else {
            grouped.set(key, {
                receiverName,
                receiverOffice,
                assignments: [{ inventory_detail_id: a.inventory_detail_id, quantity: qty }],
            });
        }
    });

    const approvedItems = (transfer.items ?? []).filter(
        (item) => Number(item.ApprovedQuantity ?? item.Quantity ?? 0) > 0,
    );

    const fallbackItems = approvedItems.map((item) => ({
        item,
        assignedQty: Math.max(1, Number(item.ApprovedQuantity ?? item.Quantity ?? 1)),
    }));

    if (grouped.size === 0) {
        return [{ receiverName: fallbackReceivingName, receiverOffice: fallbackReceivingOffice, items: fallbackItems }];
    }

    const pages: ReceiverGroup[] = [];

    grouped.forEach((group) => {
        const pageItems = new Map<number, { item: PropertyTransferItem; assignedQty: number }>();
        group.assignments.forEach((a) => {
            const sourceItem = approvedItems.find(
                (item) => Number(item.InventoryDetailID) === Number(a.inventory_detail_id),
            );
            if (!sourceItem) return;
            const existing = pageItems.get(sourceItem.InventoryDetailID);
            if (existing) {
                existing.assignedQty += a.quantity;
            } else {
                pageItems.set(sourceItem.InventoryDetailID, { item: sourceItem, assignedQty: a.quantity });
            }
        });
        if (pageItems.size > 0) {
            pages.push({
                receiverName: group.receiverName,
                receiverOffice: group.receiverOffice,
                items: Array.from(pageItems.values()),
            });
        }
    });

    return pages.length > 0
        ? pages
        : [{ receiverName: fallbackReceivingName, receiverOffice: fallbackReceivingOffice, items: fallbackItems }];
}

// ── Write one sheet per receiver group ───────────────────────────────────────

async function writeReceiverSheet(
    wb: ExcelJS.Workbook,
    templateBuffer: ArrayBuffer,
    group: ReceiverGroup,
    transfer: PropertyTransfer,
    sheetName: string,
    releasingName: string,
    releasingOffice: string,
    witnessedName: string,
    witnessedOffice: string,
    docDate: string,
): Promise<void> {
    const sheetWb = new ExcelJS.Workbook();
    await sheetWb.xlsx.load(templateBuffer);
    const srcWs = sheetWb.getWorksheet(1);
    if (!srcWs) return;

    const ws = wb.addWorksheet(sheetName);

    // ── Copy images (Logo) from template to the new sheet ────────────────────
    if (srcWs.getImages) {
        srcWs.getImages().forEach((image) => {
            const img = sheetWb.getImage(Number(image.imageId));
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

    // Copy merges, row heights, cell values and styles
    const merges = (srcWs as any)._merges as Record<string, any>;
    if (merges) {
        Object.values(merges).forEach((merge: any) => {
            try {
                ws.mergeCells(merge.model?.top, merge.model?.left, merge.model?.bottom, merge.model?.right);
            } catch { /* skip */ }
        });
    }

    srcWs.eachRow({ includeEmpty: true }, (row, rowNum) => {
        const newRow = ws.getRow(rowNum);
        newRow.height = row.height ?? undefined;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
            const newCell = newRow.getCell(colNum);
            newCell.style = JSON.parse(JSON.stringify(cell.style));
            if (rowNum >= DATA_START && rowNum <= DATA_END && colNum <= 6) return;
            if (cell.formula) {
                newCell.value = { formula: cell.formula, result: cell.result };
            } else {
                newCell.value = cell.value;
            }
        });
    });

    // ── Clear data zone ────────────────────────────────────────────────────────
    for (let r = DATA_START; r <= DATA_END; r++) {
        for (let c = 1; c <= 6; c++) {
            ws.getCell(r, c).value = null;
        }
    }

    // ── Write compressed items ─────────────────────────────────────────────────
    let currentRow = DATA_START;
    const MAX_ROW = DATA_END;

    const compressedItems = compressPropertyNumbers(group.items);

    compressedItems.forEach((row) => {
        if (currentRow > MAX_ROW) return;

        const propertyDisplay = formatPropertyRange(row.propertyNumbers);
        const total = row.totalQty * row.unitCost;

        ws.getCell(currentRow, 1).value = row.totalQty;
        ws.getCell(currentRow, 1).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 1).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.getCell(currentRow, 2).value = row.unitName;
        ws.getCell(currentRow, 2).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 2).alignment = { horizontal: 'center', vertical: 'middle' };

        // ── Item Description (Centered) ──────────────────────────────────────
        ws.getCell(currentRow, 3).value = row.description;
        ws.getCell(currentRow, 3).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        ws.getCell(currentRow, 4).value = propertyDisplay;
        ws.getCell(currentRow, 4).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        if (row.unitCost > 0) {
            ws.getCell(currentRow, 5).value = row.unitCost;
            ws.getCell(currentRow, 5).numFmt = '#,##0.00';
            ws.getCell(currentRow, 5).font = { name: FONT, size: 10 };
            ws.getCell(currentRow, 5).alignment = { horizontal: 'right', vertical: 'middle' };

            ws.getCell(currentRow, 6).value = {
                formula: `E${currentRow}*A${currentRow}`,
                result: total,
            };
            ws.getCell(currentRow, 6).numFmt = '#,##0.00;;';
            ws.getCell(currentRow, 6).font = { name: FONT, size: 10 };
            ws.getCell(currentRow, 6).alignment = { horizontal: 'right', vertical: 'middle' };
        }

        ws.getRow(currentRow).height = 15;
        currentRow++;
    });

    // ── Clear the grand total cell (prevents values rendering next to supplier name) ──
    ws.getCell(TOTAL_ROW, 6).value = null;

    const getSupplierNameFromTransfer = (transfer: PropertyTransfer): string => {
        if (transfer.SupplierName) return transfer.SupplierName;
        for (const item of transfer.items ?? []) {
            const inv: any = item.inventoryDetail;
            const receipt = inv?.drDetail?.deliveryReceipt ?? inv?.inventory?.deliveryReceipt;
            const supplier = receipt?.supplier?.SupplierName ?? receipt?.SupplierName;
            if (supplier) return supplier;
        }
        return '';
    };

    const getPONumberFromTransfer = (transfer: PropertyTransfer): string => {
        if (transfer.PONumber) return transfer.PONumber;
        for (const item of transfer.items ?? []) {
            const inv: any = item.inventoryDetail;
            const receipt = inv?.drDetail?.deliveryReceipt ?? inv?.inventory?.deliveryReceipt;
            const po = receipt?.PONumber;
            if (po) return po;
        }
        return '';
    };

    const supplierName = ensureText(getSupplierNameFromTransfer(transfer), '');
    const poNumber = getPONumberFromTransfer(transfer);

    // ── Supplier / PO / Supplier department ────────────────────────────────────
    ws.getCell(27, 3).value = supplierName;
    ws.getCell(28, 3).value = poNumber ? `PO NO: ${poNumber}` : '';
    ws.getCell(29, 3).value = ensureText(transfer.fromDepartment?.DepartmentName, '');

    // ── Releasing custodian (Received From) ───────────────────────────────────
    ws.getCell(RELEASING_NAME_ROW, 1).value = releasingName.toUpperCase();
    ws.getCell(RELEASING_NAME_ROW, 1).font = { name: FONT, size: 11, bold: false, underline: true };
    ws.getCell(RELEASING_NAME_ROW, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(RELEASING_POSITION_ROW, 1).value = releasingOffice;
    ws.getCell(RELEASING_POSITION_ROW, 1).font = { name: FONT, size: 10, underline: true };
    ws.getCell(RELEASING_POSITION_ROW, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(RELEASING_DATE_ROW, 1).value = formatPHDate(transfer.BorrowerSignedAt) || docDate;
    ws.getCell(RELEASING_DATE_ROW, 1).font = { name: FONT, size: 10, underline: true };
    ws.getCell(RELEASING_DATE_ROW, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Receiving custodian (Received By) ─────────────────────────────────────
    ws.getCell(RECEIVING_NAME_ROW, 4).value = group.receiverName.toUpperCase();
    ws.getCell(RECEIVING_NAME_ROW, 4).font = { name: FONT, size: 11, bold: false, underline: true };
    ws.getCell(RECEIVING_NAME_ROW, 4).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(RECEIVING_POSITION_ROW, 4).value = group.receiverOffice;
    ws.getCell(RECEIVING_POSITION_ROW, 4).font = { name: FONT, size: 10, underline: true };
    ws.getCell(RECEIVING_POSITION_ROW, 4).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(RECEIVING_DATE_ROW, 4).value = formatPHDate(transfer.BorrowingSignedAt) || docDate;
    ws.getCell(RECEIVING_DATE_ROW, 4).font = { name: FONT, size: 10, underline: true };
    ws.getCell(RECEIVING_DATE_ROW, 4).alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Witnessed-by (Property Custodian) ─────────────────────────────────────
    ws.getCell(WITNESSED_NAME_ROW, 3).value = 'NILO SABAYANON';
    ws.getCell(WITNESSED_NAME_ROW, 3).font = { name: FONT, size: 11, bold: false, underline: true };
    ws.getCell(WITNESSED_NAME_ROW, 3).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(WITNESSED_POSITION_ROW, 3).value = 'Supply Officer III';
    ws.getCell(WITNESSED_POSITION_ROW, 3).font = { name: FONT, size: 10, underline: true };
    ws.getCell(WITNESSED_POSITION_ROW, 3).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(WITNESSED_DATE_ROW, 3).value = formatPHDate(transfer.BorrowerSignedAt) || docDate;
    ws.getCell(WITNESSED_DATE_ROW, 3).font = { name: FONT, size: 10, underline: true };
    ws.getCell(WITNESSED_DATE_ROW, 3).alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Print setup ────────────────────────────────────────────────────────────
    ws.pageSetup = {
        orientation: 'portrait',
        paperSize: 5,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };
    ws.views = [{ showGridLines: true }];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportPTRToExcel(transfer: PropertyTransfer): Promise<void> {
    const templateUrl = `${window.location.origin}/assets/templates/PTR.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Failed to load PTR template (Status: ${response.status})`);
    const templateBuffer = await response.arrayBuffer();

    let assignments: ReceiverAssignment[] = [];
    try {
        const res = await transferAPI.getReceiverAssignments(transfer.TransferID);
        assignments = res?.data ?? [];
    } catch {
        // fall through — use fallback receiver
    }

    const releasingName = ensureText(transfer.fromEndUser?.FullName, 'RELEASING CUSTODIAN');
    const releasingOffice = ensureText(
        transfer.fromEndUser?.DepartmentName || transfer.fromDepartment?.DepartmentName,
        'DEPARTMENT',
    );
    const receivingName = ensureText(transfer.toEndUser?.FullName, 'RECEIVING CUSTODIAN');
    const receivingOffice = ensureText(
        transfer.toEndUser?.DepartmentName || transfer.toDepartment?.DepartmentName,
        'DEPARTMENT',
    );

    const witnessedName = ensureText((transfer as any).issuer?.FullName, 'PROPERTY CUSTODIAN');
    const witnessedOffice = ensureText(
        (transfer as any).issuer?.department?.DepartmentName,
        'GENERAL SERVICES OFFICE',
    );

    const docDate = ensureText(
        formatPHDate(transfer.ApprovedAt || transfer.created_at || ''),
        formatPHDate(new Date().toISOString()),
    );

    const groups = buildReceiverGroups(assignments, transfer, receivingName, receivingOffice);

    const wb = new ExcelJS.Workbook();

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const sheetName = groups.length === 1
            ? 'PTR'
            : `PTR - ${group.receiverName}`.slice(0, 31);

        await writeReceiverSheet(
            wb,
            templateBuffer,
            group,
            transfer,
            sheetName,
            releasingName,
            releasingOffice,
            witnessedName,
            witnessedOffice,
            docDate,
        );
    }

    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const safePTR = (typeof transfer.TransferNumber === 'string' && transfer.TransferNumber)
        ? transfer.TransferNumber.replace(/[/\\?%*:|"<>]/g, '-')
        : 'PTR';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PTR_${safePTR}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

export default exportPTRToExcel;