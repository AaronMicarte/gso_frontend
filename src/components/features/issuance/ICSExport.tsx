import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { AssetIssuance } from '@/types/assetIssuance';
import { compressPropertyNumbers } from '@/lib/utils/propertyNumbers';
import issuanceAPI from '@/lib/api/issuance';

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

// ── Template layout (verified from ICS.xlsx) ─────────────────────────────────
// Col A=Qty | B=Unit | C=Item Description | D=Property No. | E=Unit Cost | F=Amount
// E10  = ICS NO.
// Rows 12-36 = item data rows
// Row 37     = supplier name (C37)
// Row 38     = PO number (C38)
// E40        = total SUM(F12:F37)
// A46/D46    = received by / received from names
// A47/D47    = offices
// A50/D50    = dates

const DATA_START = 12;
const DATA_END = 36;
const SUPPLIER_ROW = 37;
const PO_ROW = 38;
const TOTAL_ROW = 40;

// ── Main export ──────────────────────────────────────────────────────────────

export async function exportICSToExcel(
    issuance: AssetIssuance,
    selectedDetailIds?: number[],
): Promise<void> {
    const templateUrl = `${window.location.origin}/assets/templates/ICS.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Failed to load ICS template (Status: ${response.status})`);
    const buffer = await response.arrayBuffer();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet(1);
    if (!ws) throw new Error('Worksheet not found in ICS template');

    // ── Resolve data ──────────────────────────────────────────────────────────

    const allDetails = issuance.details ?? [];
    const details = selectedDetailIds?.length
        ? allDetails.filter((d) => selectedDetailIds.includes(d.IssuanceDetailID))
        : allDetails;

    const docDate = ensureText(
        formatPHDate(issuance.IssuanceDate),
        formatPHDate(new Date().toISOString()),
    );
    const receivedDate = ensureText(
        issuance.AcknowledgedAt ? formatPHDate(issuance.AcknowledgedAt) : '',
        docDate,
    );

    let receivedByName = ensureText(
        issuance.IssuedToName || issuance.deliveryReceipt?.RequestedBy,
        'END USER',
    );
    let receivedByOffice = ensureText(
        issuance.request?.department?.DepartmentName || issuance.deliveryReceipt?.DepartmentName,
        'DEPARTMENT',
    );

    try {
        const id = issuance.IssuanceID;
        if (id) {
            const res = await issuanceAPI.getAssignments(id);
            const rows = res?.data ?? [];
            const filtered = rows
                .filter((row: { issuance_detail_id?: number }) => {
                    if (!selectedDetailIds?.length) return true;
                    return selectedDetailIds.includes(Number(row.issuance_detail_id));
                })
                .map((row: { receiver_name?: string; position_office?: string }) => ({
                    receiver_name: String(row.receiver_name || '').trim(),
                    position_office: String(row.position_office || '').trim(),
                }))
                .filter((row: { receiver_name: string }) => row.receiver_name.length > 0);

            if (filtered.length > 0) {
                const seen = new Set<string>();
                const unique: Array<{ receiver_name: string; position_office: string }> = [];
                filtered.forEach((item: { receiver_name: string; position_office: string }) => {
                    const key = `${item.receiver_name}||${item.position_office}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        unique.push({
                            receiver_name: item.receiver_name,
                            position_office: item.position_office || receivedByOffice
                        });
                    }
                });

                receivedByName = unique.map(u => u.receiver_name).join('\n');
                receivedByOffice = unique.map(u => u.position_office).join('\n');
            }
        }
    } catch (e) {
        console.error('Failed to load assignments for Excel export', e);
    }

    const receivedFromName = ensureText(issuance.issuer?.FullName, 'PROPERTY CUSTODIAN');
    const receivedFromOffice = ensureText(
        issuance.issuer?.department?.DepartmentName,
        'GENERAL SERVICES OFFICE',
    );

    const dr = issuance.deliveryReceipt as any;
    const supplierName = ensureText(dr?.SupplierName, '');
    const poNumber = ensureText(dr?.PONumber, '');

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

    // ── ICS Number ───────────────────────────────────────────────────────────
    ws.getCell('E10').value = `ICS NO. ${ensureText(issuance.DocumentNumber, 'ICS')}`;

    // ── Clear data zone rows 12-38 ────────────────────────────────────────────
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
                // A: Quantity
                ws.getCell(currentRow, 1).value = item.quantity;
                ws.getCell(currentRow, 1).font = { name: FONT, size: 10 };
                ws.getCell(currentRow, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

                // B: Unit
                ws.getCell(currentRow, 2).value = item.unit;
                ws.getCell(currentRow, 2).font = { name: FONT, size: 10 };
                ws.getCell(currentRow, 2).alignment = { horizontal: 'center', vertical: 'middle' };

                // D: Property No.
                ws.getCell(currentRow, 4).value = propertyNoText;
                ws.getCell(currentRow, 4).font = { name: FONT, size: 10 };
                ws.getCell(currentRow, 4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

                // E: Unit Cost
                ws.getCell(currentRow, 5).value = item.unitCost;
                ws.getCell(currentRow, 5).numFmt = '#,##0.00';
                ws.getCell(currentRow, 5).font = { name: FONT, size: 10 };
                ws.getCell(currentRow, 5).alignment = { horizontal: 'center', vertical: 'middle' };

                // F: Amount = E * A
                ws.getCell(currentRow, 6).value = { formula: `E${currentRow}*A${currentRow}`, result: item.totalCost };
                ws.getCell(currentRow, 6).numFmt = '#,##0.00;;';
                ws.getCell(currentRow, 6).font = { name: FONT, size: 10 };
                ws.getCell(currentRow, 6).alignment = { horizontal: 'right', vertical: 'middle' };
            }

            // C: Description (every line)
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

    // ── Total (E40 = SUM(F12:F37)) ────────────────────────────────────────────
    ws.getCell(TOTAL_ROW, 5).value = {
        formula: `SUM(F${DATA_START}:F${SUPPLIER_ROW})`,
        result: rows.reduce((s, r) => s + r.totalCost, 0),
    };
    ws.getCell(TOTAL_ROW, 5).numFmt = '#,##0.00;;';
    ws.getCell(TOTAL_ROW, 5).font = { name: FONT, size: 11, bold: true };

    // ── Signatures ────────────────────────────────────────────────────────────
    // Template: A = Received by | D = Received from
    ws.getCell(46, 1).value = receivedByName;
    ws.getCell(46, 1).font = { name: FONT, size: 11, bold: true };
    ws.getCell(46, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    ws.getCell(46, 4).value = receivedFromName;

    ws.getCell(47, 1).value = receivedByOffice;
    ws.getCell(47, 1).font = { name: FONT, size: 11 };
    ws.getCell(47, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    ws.getCell(47, 4).value = receivedFromOffice;

    const nameLines = receivedByName.split('\n').length;
    if (nameLines > 1) {
        ws.getRow(46).height = 15 * nameLines;
    }
    const officeLines = receivedByOffice.split('\n').length;
    if (officeLines > 1) {
        ws.getRow(47).height = 15 * officeLines;
    }

    ws.getCell(50, 1).value = 'Date';
    ws.getCell(50, 1).font = { name: FONT, size: 11 };
    ws.getCell(50, 1).alignment = { horizontal: 'center' };
    ws.getCell(50, 4).value = 'Date';
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