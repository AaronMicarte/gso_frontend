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
const TOTAL_ROW = 27; // row 27 col F holds =SUM(F11:F26) effectively via formula zone

// Signature block rows (template layout)
const RELEASING_NAME_ROW = 39;
const RELEASING_POSITION_ROW = 41;
const RELEASING_DATE_ROW = 43;
const RECEIVING_NAME_ROW = 39;
const RECEIVING_POSITION_ROW = 41;
const RECEIVING_DATE_ROW = 43;
const WITNESSED_NAME_ROW = 48;
const WITNESSED_POSITION_ROW = 50;
const WITNESSED_DATE_ROW = 52;

// ── Resolve receiver groups (mirrors PTRPrintView logic) ─────────────────────

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
    // Load a fresh workbook from template for each sheet
    const sheetWb = new ExcelJS.Workbook();
    await sheetWb.xlsx.load(templateBuffer);
    const srcWs = sheetWb.getWorksheet(1);
    if (!srcWs) return;

    // Add a new sheet to main workbook by copying
    const ws = wb.addWorksheet(sheetName);

    // Copy column widths
    srcWs.columns.forEach((col, idx) => {
        ws.getColumn(idx + 1).width = col.width ?? 15;
    });

    // Copy row heights, cell values, styles, merges
    const merges = (srcWs as any)._merges as Record<string, any>;
    if (merges) {
        Object.values(merges).forEach((merge: any) => {
            try { ws.mergeCells(merge.model?.top, merge.model?.left, merge.model?.bottom, merge.model?.right); } catch { /* skip */ }
        });
    }

    srcWs.eachRow({ includeEmpty: true }, (row, rowNum) => {
        const newRow = ws.getRow(rowNum);
        newRow.height = row.height ?? undefined;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
            const newCell = newRow.getCell(colNum);
            newCell.style = JSON.parse(JSON.stringify(cell.style));
            // Don't copy existing data-zone formulas/values — we'll overwrite them
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

    // ── Write items ────────────────────────────────────────────────────────────
    let currentRow = DATA_START;
    const MAX_ROW = DATA_END;

    group.items.forEach((row, index) => {
        if (currentRow > MAX_ROW) return;

        const inv = row.item.inventoryDetail as any;
        const description = ensureText(
            inv?.Description || inv?.drDetail?.ItemDescription,
            'Item description',
        );
        const unitName = ensureText(inv?.unitOfMeasure?.UnitName, 'unit');
        const propertyNo = ensureText(inv?.PropertyNumber, `${index + 1}`);
        const unitCost = Number(inv?.UnitCost ?? 0);
        const qty = Math.max(1, Number(row.assignedQty ?? 1));
        const total = qty * unitCost;

        ws.getCell(currentRow, 1).value = qty;
        ws.getCell(currentRow, 1).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 1).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.getCell(currentRow, 2).value = unitName;
        ws.getCell(currentRow, 2).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 2).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.getCell(currentRow, 3).value = description;
        ws.getCell(currentRow, 3).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        ws.getCell(currentRow, 4).value = propertyNo;
        ws.getCell(currentRow, 4).font = { name: FONT, size: 10 };
        ws.getCell(currentRow, 4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        if (unitCost > 0) {
            ws.getCell(currentRow, 5).value = unitCost;
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

    // ── Total row (row 27 in template) ─────────────────────────────────────────
    const grandTotal = group.items.reduce((sum, row) => {
        const inv = row.item.inventoryDetail as any;
        const unitCost = Number(inv?.UnitCost ?? 0);
        return sum + Math.max(1, Number(row.assignedQty ?? 1)) * unitCost;
    }, 0);

    ws.getCell(TOTAL_ROW, 6).value = {
        formula: `SUM(F${DATA_START}:F${DATA_END})`,
        result: grandTotal,
    };
    ws.getCell(TOTAL_ROW, 6).numFmt = '#,##0.00;;';

    // ── Releasing custodian (left column, rows 39–43) ─────────────────────────
    ws.getCell(RELEASING_NAME_ROW, 1).value = releasingName;
    ws.getCell(RELEASING_NAME_ROW, 1).font = { name: FONT, size: 11, bold: true };
    ws.getCell(RELEASING_NAME_ROW, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(RELEASING_POSITION_ROW, 1).value = releasingOffice;
    ws.getCell(RELEASING_POSITION_ROW, 1).font = { name: FONT, size: 10 };
    ws.getCell(RELEASING_POSITION_ROW, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(RELEASING_DATE_ROW, 1).value = formatPHDate(transfer.BorrowerSignedAt) || docDate;
    ws.getCell(RELEASING_DATE_ROW, 1).font = { name: FONT, size: 10 };
    ws.getCell(RELEASING_DATE_ROW, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Receiving custodian (right column, rows 39–43) ────────────────────────
    ws.getCell(RECEIVING_NAME_ROW, 4).value = group.receiverName;
    ws.getCell(RECEIVING_NAME_ROW, 4).font = { name: FONT, size: 11, bold: true };
    ws.getCell(RECEIVING_NAME_ROW, 4).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(RECEIVING_POSITION_ROW, 4).value = group.receiverOffice;
    ws.getCell(RECEIVING_POSITION_ROW, 4).font = { name: FONT, size: 10 };
    ws.getCell(RECEIVING_POSITION_ROW, 4).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(RECEIVING_DATE_ROW, 4).value = formatPHDate(transfer.BorrowingSignedAt) || docDate;
    ws.getCell(RECEIVING_DATE_ROW, 4).font = { name: FONT, size: 10 };
    ws.getCell(RECEIVING_DATE_ROW, 4).alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Witnessed-by block (center, rows 48–52) ───────────────────────────────
    ws.getCell(WITNESSED_NAME_ROW, 3).value = witnessedName;
    ws.getCell(WITNESSED_NAME_ROW, 3).font = { name: FONT, size: 11, bold: true };
    ws.getCell(WITNESSED_NAME_ROW, 3).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(WITNESSED_POSITION_ROW, 3).value = witnessedOffice;
    ws.getCell(WITNESSED_POSITION_ROW, 3).font = { name: FONT, size: 10 };
    ws.getCell(WITNESSED_POSITION_ROW, 3).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell(WITNESSED_DATE_ROW, 3).value = docDate;
    ws.getCell(WITNESSED_DATE_ROW, 3).font = { name: FONT, size: 10 };
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

// ── Main export ──────────────────────────────────────────────────────────────

export async function exportPTRToExcel(transfer: PropertyTransfer): Promise<void> {
    const templateUrl = `${window.location.origin}/assets/templates/PTR.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Failed to load PTR template (Status: ${response.status})`);
    const templateBuffer = await response.arrayBuffer();

    // ── Resolve assignments ────────────────────────────────────────────────────
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

    // Witnessed-by defaults to issuer / supply officer placeholder
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

    // ── Build workbook (one sheet per receiver group) ─────────────────────────
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

    // ── Download ───────────────────────────────────────────────────────────────
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