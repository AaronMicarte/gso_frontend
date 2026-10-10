import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { AssetIssuance } from '@/types/assetIssuance';
import { compressPropertyNumbers } from '@/lib/utils/propertyNumbers';
import issuanceAPI from '@/lib/api/issuance';
import { formatAssignmentPositionForPrint } from '@/lib/deliveryReceiptAssignments';

// ── Types ────────────────────────────────────────────────────────────────────

interface GroupedIcsRow {
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
    descriptionLines: string[];
    propertyNumbers: string[];
    maxSequence: number;
}

interface ReceiverGroup {
    receiverName: string;
    receiverOffice: string;
    detailIds: number[];
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

function parseTrailingNumber(value: string): number | null {
    const match = String(value ?? '').trim().match(/^(.*?)(\d+)$/);
    return match ? Number(match[2]) : null;
}

function splitDescriptionLines(description: string, maxLen = 80): string[] {
    if (!description) return [''];
    const parts = description.split(', ');
    const lines: string[] = [];
    let current = '';
    for (const part of parts) {
        const candidate = current ? `${current}, ${part}` : part;
        if (candidate.length <= maxLen) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            if (part.length > maxLen) {
                let remaining = part;
                while (remaining.length > maxLen) {
                    lines.push(remaining.slice(0, maxLen));
                    remaining = remaining.slice(maxLen);
                }
                current = remaining;
            } else {
                current = part;
            }
        }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
}

const FONT = 'Aptos Narrow';

const DATA_START = 12;
const DATA_END = 36;
const SUPPLIER_ROW = 37;
const PO_ROW = 38;
const TOTAL_ROW = 40;

// ── Build receiver groups from assignments ────────────────────────────────────

function buildReceiverGroups(
    assignments: Array<{
        issuance_detail_id?: number;
        receiver_name?: string;
        position_office?: string;
        office_name?: string;
        is_department_head?: boolean;
    }>,
    allDetailIds: number[],
    fallbackName: string,
    fallbackOffice: string,
): ReceiverGroup[] {
    const grouped = new Map<string, { receiverName: string; receiverOffice: string; detailIds: Set<number> }>();

    assignments.forEach((a) => {
        const name = String(a.receiver_name || '').trim() || fallbackName;
        const office = formatAssignmentPositionForPrint(
            a.position_office,
            a.office_name,
            a.is_department_head
        ) || fallbackOffice;
        const key = `${name}||${office}`;
        if (!grouped.has(key)) {
            grouped.set(key, { receiverName: name, receiverOffice: office, detailIds: new Set() });
        }
        if (a.issuance_detail_id) {
            grouped.get(key)!.detailIds.add(Number(a.issuance_detail_id));
        }
    });

    if (grouped.size === 0) {
        return [{ receiverName: fallbackName, receiverOffice: fallbackOffice, detailIds: allDetailIds }];
    }

    const pages: ReceiverGroup[] = [];
    grouped.forEach((g) => {
        if (g.detailIds.size > 0) {
            pages.push({ receiverName: g.receiverName, receiverOffice: g.receiverOffice, detailIds: Array.from(g.detailIds) });
        }
    });

    return pages.length > 0
        ? pages
        : [{ receiverName: fallbackName, receiverOffice: fallbackOffice, detailIds: allDetailIds }];
}

// ── Write one sheet ───────────────────────────────────────────────────────────

async function writeReceiverSheet(
    wb: ExcelJS.Workbook,
    templateBuffer: ArrayBuffer,
    sheetName: string,
    issuance: AssetIssuance,
    group: ReceiverGroup,
    receivedFromName: string,
    receivedFromOffice: string,
    supplierName: string,
    poNumber: string,
    docDate: string,
    receivedDate: string,
    departmentName: string,
): Promise<void> {
    const allDetails = issuance.details ?? [];
    const details = allDetails.filter((d) => group.detailIds.includes(d.IssuanceDetailID));

    // ── Group & build description lines ──────────────────────────────────────
    const groupedMap = details.reduce<Map<string, GroupedIcsRow>>((map, detail, index) => {
        const inv = detail.inventoryDetail;
        const pInv = inv?.propertyInventory;

        const itemName = ensureText(pInv?.ItemDescription || pInv?.ItemName || detail.ItemDescription, 'ITEM');
        const technical = ensureText(inv?.Description, '');
        const brandModel = [pInv?.Brand, pInv?.ModelNumber].filter(Boolean).join(', ');
        const fullDescription = [itemName, technical, brandModel].filter(Boolean).join(', ');

        const qty = Math.max(1, Number(detail.QuantityIssued ?? 1));
        const unit = ensureText(inv?.unitOfMeasure?.UnitName || detail.Unit || 'unit', 'unit');

        const propertyNumber = ensureText(
            inv?.PropertyNumber || inv?.InventoryNumber || pInv?.InventoryNumber || inv?.InventoryDetailID,
            `${index + 1}`,
        );

        const unitCost = Number(inv?.UnitCost ?? 0);
        const key = [fullDescription, unit, unitCost.toFixed(2)].join('|');

        if (!map.has(key)) {
            map.set(key, {
                quantity: 0,
                unit,
                unitCost,
                totalCost: 0,
                descriptionLines: splitDescriptionLines(fullDescription),
                propertyNumbers: [],
                maxSequence: -1,
            });
        }

        const row = map.get(key)!;
        row.quantity += qty;
        row.totalCost += qty * unitCost;
        row.propertyNumbers.push(propertyNumber);

        const trailing = parseTrailingNumber(propertyNumber);
        if (trailing !== null) row.maxSequence = Math.max(row.maxSequence, trailing);

        return map;
    }, new Map());

    const rows = Array.from(groupedMap.values()).sort((a, b) => {
        if (a.maxSequence !== b.maxSequence) return b.maxSequence - a.maxSequence;
        return a.descriptionLines[0].localeCompare(b.descriptionLines[0]);
    });

    // ── Load template & copy into new sheet ──────────────────────────────────
    const sheetWb = new ExcelJS.Workbook();
    await sheetWb.xlsx.load(templateBuffer);
    const srcWs = sheetWb.getWorksheet(1);
    if (!srcWs) return;

    const ws = wb.addWorksheet(sheetName);

    // Copy images (Logo)
    if (srcWs.getImages) {
        srcWs.getImages().forEach((image) => {
            const img = sheetWb.getImage(Number(image.imageId));
            const newImageId = wb.addImage({ buffer: img.buffer, extension: img.extension });
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
            if (rowNum >= DATA_START && rowNum <= PO_ROW && colNum <= 6) return;
            if (cell.formula) {
                newCell.value = { formula: cell.formula, result: cell.result };
            } else {
                newCell.value = cell.value;
            }
        });
    });

    // ── ICS Number & department header ────────────────────────────────────────
    ws.getCell('E10').value = `ICS NO. ${ensureText(issuance.DocumentNumber, 'ICS')}`;
    // If template has an office/department header cell, set department name here
    // (mirrors PAR B11 fix — position_office stays only in signature block)

    // ── Clear data zone ───────────────────────────────────────────────────────
    for (let r = DATA_START; r <= PO_ROW; r++) {
        for (let c = 1; c <= 6; c++) {
            ws.getCell(r, c).value = null;
        }
    }

    // ── Write item rows ───────────────────────────────────────────────────────
    let currentRow = DATA_START;

    rows.forEach((item) => {
        const propertyNoText = compressPropertyNumbers(item.propertyNumbers.join('/'));

        item.descriptionLines.forEach((line, lineIndex) => {
            if (currentRow > DATA_END) return;
            const isFirstLine = lineIndex === 0;

            if (isFirstLine) {
                ws.getCell(currentRow, 1).value = item.quantity;
                ws.getCell(currentRow, 1).font = { name: FONT, size: 10 };
                ws.getCell(currentRow, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

                ws.getCell(currentRow, 2).value = item.unit;
                ws.getCell(currentRow, 2).font = { name: FONT, size: 10 };
                ws.getCell(currentRow, 2).alignment = { horizontal: 'center', vertical: 'middle' };

                ws.getCell(currentRow, 4).value = propertyNoText;
                ws.getCell(currentRow, 4).font = { name: FONT, size: 10 };
                ws.getCell(currentRow, 4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

                ws.getCell(currentRow, 5).value = item.unitCost;
                ws.getCell(currentRow, 5).numFmt = '#,##0.00';
                ws.getCell(currentRow, 5).font = { name: FONT, size: 10 };
                ws.getCell(currentRow, 5).alignment = { horizontal: 'center', vertical: 'middle' };

                ws.getCell(currentRow, 6).value = { formula: `E${currentRow}*A${currentRow}`, result: item.totalCost };
                ws.getCell(currentRow, 6).numFmt = '#,##0.00;;';
                ws.getCell(currentRow, 6).font = { name: FONT, size: 10 };
                ws.getCell(currentRow, 6).alignment = { horizontal: 'right', vertical: 'middle' };
            }

            ws.getCell(currentRow, 3).value = line;
            ws.getCell(currentRow, 3).font = { name: FONT, size: 11 };
            ws.getCell(currentRow, 3).alignment = { horizontal: 'left', vertical: 'middle' };

            ws.getRow(currentRow).height = 15.0;
            currentRow++;
        });
    });

    // ── Supplier & PO ────────────────────────────────────────────────────────
    if (supplierName) {
        ws.getCell(SUPPLIER_ROW, 3).value = supplierName;
        ws.getCell(SUPPLIER_ROW, 3).font = { name: FONT, size: 11, bold: true };
        ws.getCell(SUPPLIER_ROW, 3).alignment = { horizontal: 'left', vertical: 'middle' };
    }
    if (poNumber) {
        ws.getCell(PO_ROW, 3).value = `PO NO: ${poNumber}`;
        ws.getCell(PO_ROW, 3).font = { name: FONT, size: 11, bold: true };
        ws.getCell(PO_ROW, 3).alignment = { horizontal: 'left', vertical: 'middle' };
    }

    // ── Total ─────────────────────────────────────────────────────────────────
    ws.getCell(TOTAL_ROW, 5).value = {
        formula: `SUM(F${DATA_START}:F${SUPPLIER_ROW})`,
        result: rows.reduce((s, r) => s + r.totalCost, 0),
    };
    ws.getCell(TOTAL_ROW, 5).numFmt = '#,##0.00;;';
    ws.getCell(TOTAL_ROW, 5).font = { name: FONT, size: 11, bold: true };

    // ── Signatures ────────────────────────────────────────────────────────────
    ws.getCell(46, 1).value = group.receiverName.toUpperCase();
    ws.getCell(46, 1).font = { name: FONT, size: 11, bold: true, underline: true };
    ws.getCell(46, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    ws.getCell(46, 4).value = receivedFromName;
    ws.getCell(46, 4).font = { name: FONT, size: 11, bold: true, underline: true };

    ws.getCell(47, 1).value = (group.receiverOffice || departmentName).toUpperCase();
    ws.getCell(47, 1).font = { name: FONT, size: 11, bold: false };
    ws.getCell(47, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    ws.getCell(47, 4).value = receivedFromOffice;
    ws.getCell(47, 4).font = { name: FONT, size: 11, bold: false };

    ws.getCell(50, 1).value = receivedDate;
    ws.getCell(50, 1).font = { name: FONT, size: 11 };
    ws.getCell(50, 1).alignment = { horizontal: 'center' };

    ws.getCell(50, 4).value = docDate;
    ws.getCell(50, 4).font = { name: FONT, size: 11 };
    ws.getCell(50, 4).alignment = { horizontal: 'center' };

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
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function exportICSToExcel(
    issuance: AssetIssuance,
    selectedDetailIds?: number[],
    receiverKey?: string,
): Promise<void> {
    const templateUrl = `${window.location.origin}/assets/templates/ICS.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Failed to load ICS template (Status: ${response.status})`);
    const templateBuffer = await response.arrayBuffer();

    // ── Resolve detail scope ──────────────────────────────────────────────────
    const allDetails = issuance.details ?? [];
    const scopedDetails = selectedDetailIds?.length
        ? allDetails.filter((d) => selectedDetailIds.includes(d.IssuanceDetailID))
        : allDetails;
    const scopedDetailIds = scopedDetails.map((d) => d.IssuanceDetailID);

    // ── Resolve common header values ──────────────────────────────────────────
    const docDate = ensureText(
        formatPHDate(issuance.IssuanceDate),
        formatPHDate(new Date().toISOString()),
    );
    const receivedDate = ensureText(
        issuance.AcknowledgedAt ? formatPHDate(issuance.AcknowledgedAt) : '',
        docDate,
    );

    const fallbackReceiverName = ensureText(
        issuance.IssuedToName || issuance.deliveryReceipt?.RequestedBy,
        'END USER',
    ).toUpperCase();
    const fallbackReceiverOffice = ensureText(
        issuance.request?.department?.DepartmentName || issuance.deliveryReceipt?.DepartmentName,
        'DEPARTMENT',
    ).toUpperCase();

    // Used for the OFFICE header — always the department, not the person's position
    const departmentName = ensureText(
        issuance.request?.department?.DepartmentName || issuance.deliveryReceipt?.DepartmentName,
        'DEPARTMENT',
    ).toUpperCase();

    const receivedFromName = ensureText(issuance.issuer?.FullName, 'PROPERTY CUSTODIAN').toUpperCase();
    const receivedFromOffice = ensureText(
        issuance.issuer?.department?.DepartmentName,
        'GENERAL SERVICES OFFICE',
    ).toUpperCase();

    const dr = issuance.deliveryReceipt as any;
    const supplierName = ensureText(dr?.SupplierName, '');
    const poNumber = ensureText(dr?.PONumber, '');

    // ── Load assignments & build receiver groups ──────────────────────────────
    let rawAssignments: Array<{
        issuance_detail_id?: number;
        receiver_name?: string;
        position_office?: string;
        office_name?: string;
        is_department_head?: boolean;
    }> = [];
    try {
        const id = issuance.IssuanceID;
        if (id) {
            const res = await issuanceAPI.getAssignments(id);
            rawAssignments = (res?.data ?? []).filter((row: { issuance_detail_id?: number }) =>
                scopedDetailIds.includes(Number(row.issuance_detail_id)),
            );
        }
    } catch (e) {
        console.error('Failed to load assignments for Excel export', e);
    }

    let groups = buildReceiverGroups(rawAssignments, scopedDetailIds, fallbackReceiverName, fallbackReceiverOffice);

    // Filter to single receiver if receiver_key is provided
    if (receiverKey) {
        try {
            const [filterName, filterOffice] = JSON.parse(decodeURIComponent(receiverKey));
            groups = groups.filter((g) => g.receiverName === filterName && g.receiverOffice === filterOffice);
        } catch { /* use all groups */ }
    }

    // ── Write one sheet per receiver group ───────────────────────────────────
    const wb = new ExcelJS.Workbook();

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const sheetName = groups.length === 1
            ? 'ICS'
            : `ICS - ${group.receiverName}`.slice(0, 31);

        await writeReceiverSheet(
            wb,
            templateBuffer,
            sheetName,
            issuance,
            group,
            receivedFromName,
            receivedFromOffice,
            supplierName,
            poNumber,
            docDate,
            receivedDate,
            departmentName,
        );
    }

    // ── Download ──────────────────────────────────────────────────────────────
    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const safeICS = (typeof issuance.DocumentNumber === 'string' && issuance.DocumentNumber)
        ? issuance.DocumentNumber.replace(/[/\\?%*:|"<>]/g, '-')
        : 'ICS';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ICS_${safeICS}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

export default exportICSToExcel;