import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

type ExportableItem = Record<string, any>;

interface CombinedRow {
    department: string;
    propertyNumbers: string[];
    article: string;
    description: string;
    brand: string;
    model: string;
    serials: string[];
    quantity: number;
    unitCost: number;
    accountable: string;
    dateAcquired: string;
}

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

/**
 * Formats property numbers into range notation for consecutive values.
 * e.g., ["2026-00001", "2026-00002", "2026-00003", "2026-00007"] -> "2026-00001/00003, 2026-00007"
 */
function formatPropertyNumbers(propNums: string[]): string {
    if (!propNums || propNums.length === 0) return '-';

    const cleaned = propNums.map(p => p.trim()).filter(Boolean);
    if (cleaned.length === 0) return '-';

    // Sort items by prefix and numerical suffix
    cleaned.sort((a, b) => {
        const matchA = a.match(/^(.+-)(\d+)$/);
        const matchB = b.match(/^(.+-)(\d+)$/);
        if (matchA && matchB && matchA[1] === matchB[1]) {
            return parseInt(matchA[2], 10) - parseInt(matchB[2], 10);
        }
        return a.localeCompare(b);
    });

    interface ParsedPN {
        raw: string;
        prefix: string;
        num: number;
        padLen: number;
    }

    const parsedList: (ParsedPN | { raw: string })[] = cleaned.map(raw => {
        const match = raw.match(/^(.+-)(\d+)$/);
        if (match) {
            return {
                raw,
                prefix: match[1],
                num: parseInt(match[2], 10),
                padLen: match[2].length,
            };
        }
        return { raw };
    });

    const resultRanges: string[] = [];
    let i = 0;

    while (i < parsedList.length) {
        const current = parsedList[i];

        if (!('prefix' in current)) {
            resultRanges.push(current.raw);
            i++;
            continue;
        }

        let start = current;
        let end = current;
        let j = i + 1;

        // Scan ahead for consecutive numbers with identical prefix and digit padding
        while (j < parsedList.length) {
            const next = parsedList[j];
            if (
                'prefix' in next &&
                next.prefix === start.prefix &&
                next.padLen === start.padLen &&
                next.num === end.num + 1
            ) {
                end = next;
                j++;
            } else {
                break;
            }
        }

        const startStr = `${start.prefix}${String(start.num).padStart(start.padLen, '0')}`;
        if (j - i > 1) {
            const endSuffix = String(end.num).padStart(end.padLen, '0');
            resultRanges.push(`${startStr}/${endSuffix}`);
        } else {
            resultRanges.push(startStr);
        }

        i = j;
    }

    return resultRanges.join(', ');
}

function buildCombinedRows(items: ExportableItem[]): CombinedRow[] {
    const map = new Map<string, CombinedRow>();

    for (const item of items) {
        // Preserving raw database casing
        const article = (item.dr_article_name || item.PropertyName || '').trim();
        const brand = (item.Brand || '').trim();
        const model = (item.ModelNumber || '').trim();
        const dept = (item.locationDepartment || 'Unassigned').trim();

        // Case-insensitive key for reliable grouping
        const key = `${dept.toLowerCase()}||${article.toLowerCase()}||${brand.toLowerCase()}||${model.toLowerCase()}`;

        const propertyNo = (item.PropertyNumber || item.InventoryNumber || '').trim();
        const serial = (item.SerialNumber || '').trim();
        const accountable = (
            item.endUserName ||
            item.accountabilityLabel ||
            item.custodianName ||
            'Unassigned'
        ).trim();
        const dateAcq = formatPHDate(item.DateAcquired || item.lastIssuedDate || item.CreatedDate || null);
        const qty = Number(item.CombinedQuantity ?? item.Quantity ?? 1);
        const unitCost = Number(item.UnitCost ?? 0);
        const desc = (item.Description || item.dr_item_description || '').trim();

        if (!map.has(key)) {
            map.set(key, {
                department: dept,
                propertyNumbers: propertyNo ? [propertyNo] : [],
                article,
                description: desc,
                brand,
                model,
                serials: serial ? [serial] : [],
                quantity: qty,
                unitCost,
                accountable,
                dateAcquired: dateAcq,
            });
        } else {
            const row = map.get(key)!;
            row.quantity += qty;
            if (propertyNo && !row.propertyNumbers.includes(propertyNo)) row.propertyNumbers.push(propertyNo);
            if (serial && !row.serials.includes(serial)) row.serials.push(serial);
            if (!row.description && desc) row.description = desc;
            if (row.accountable === 'Unassigned' && accountable !== 'Unassigned') row.accountable = accountable;
            if (!row.dateAcquired && dateAcq) row.dateAcquired = dateAcq;
        }
    }

    return Array.from(map.values());
}

export async function exportDepartmentItemsToExcel(items: ExportableItem[], departmentName: string) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Department Items');

    const FONT = 'Arial';
    const thin = { style: 'thin' as const };
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    // ── Title ─────────────────────────────────────────────────────────────────
    ws.mergeCells('A1:K1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `Inventory Report – ${departmentName}`;
    titleCell.font = { size: 13, bold: true, name: FONT };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 22;

    ws.mergeCells('A2:K2');
    const dateCell = ws.getCell('A2');
    dateCell.value = `Generated on ${formatPHDate(new Date().toISOString())}`;
    dateCell.font = { italic: true, name: FONT, size: 10 };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 16;

    // ── Column widths ─────────────────────────────────────────────────────────
    ws.columns = [
        { width: 28 },  // Department
        { width: 24 },  // Property No.
        { width: 25 },  // Article
        { width: 35 },  // Description
        { width: 15 },  // Brand
        { width: 15 },  // Model
        { width: 22 },  // Serial No.
        { width: 13 },  // Quantity
        { width: 20 },  // Acquisition Cost
        { width: 32 },  // Accountable Person
        { width: 20 },  // Date Acquired
    ];

    // ── Header row ────────────────────────────────────────────────────────────
    const headerRow = ws.getRow(4);
    headerRow.values = [
        'Department', 'Property No.', 'Article', 'Description',
        'Brand', 'Model', 'Serial No.', 'Unit / Quantity',
        'Acquisition Cost', 'Accountable Person / End User', 'Date Acquired',
    ];
    headerRow.font = { bold: true, name: FONT, size: 10 };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 28;
    headerRow.eachCell({ includeEmpty: true }, cell => { cell.border = border; });

    // ── Data rows (combined) ──────────────────────────────────────────────────
    const rows = buildCombinedRows(items);

    rows.forEach((r, i) => {
        const rowNum = 5 + i;
        const dataRow = ws.getRow(rowNum);

        dataRow.values = [
            r.department,
            formatPropertyNumbers(r.propertyNumbers),
            r.article || '-',
            r.description || '-',
            r.brand || '-',
            r.model || '-',
            r.serials.join(', ') || '-',
            r.quantity,
            r.unitCost,
            r.accountable,
            r.dateAcquired || '-',
        ];

        dataRow.getCell(8).numFmt = '#,##0';
        dataRow.getCell(9).numFmt = '₱#,##0.00';
        dataRow.font = { name: FONT, size: 10 };

        dataRow.alignment = { vertical: 'middle', wrapText: true };
        dataRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        dataRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        dataRow.getCell(11).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        dataRow.eachCell({ includeEmpty: true }, cell => { cell.border = border; });
    });

    // ── Download ──────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventory_${departmentName.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function sanitizeSheetName(name: string, index: number): string {
    // Excel sheet name limits: max 31 chars, no chars like \ / ? * : [ ]
    let cleaned = name.replace(/[\\/?*:[\]]/g, '').trim();
    if (!cleaned) {
        cleaned = `Dept ${index + 1}`;
    }
    return cleaned.substring(0, 31);
}

export async function exportAllItemsToExcel(items: ExportableItem[]) {
    const wb = new ExcelJS.Workbook();
    const FONT = 'Arial';
    const thin = { style: 'thin' as const };
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    // Group items by department
    const deptMap = new Map<string, ExportableItem[]>();
    for (const item of items) {
        const dept = (item.locationDepartment || 'Unassigned').trim();
        if (!deptMap.has(dept)) {
            deptMap.set(dept, []);
        }
        deptMap.get(dept)!.push(item);
    }

    if (deptMap.size === 0) {
        // If empty, create at least one empty sheet
        deptMap.set('Unassigned', []);
    }

    let sheetIndex = 0;
    for (const [deptName, deptItems] of deptMap.entries()) {
        const sheetName = sanitizeSheetName(deptName, sheetIndex);
        const ws = wb.addWorksheet(sheetName);
        sheetIndex++;

        // ── Title ─────────────────────────────────────────────────────────────────
        ws.mergeCells('A1:K1');
        const titleCell = ws.getCell('A1');
        titleCell.value = `Inventory Report – ${deptName}`;
        titleCell.font = { size: 13, bold: true, name: FONT };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 22;

        ws.mergeCells('A2:K2');
        const dateCell = ws.getCell('A2');
        dateCell.value = `Generated on ${formatPHDate(new Date().toISOString())}`;
        dateCell.font = { italic: true, name: FONT, size: 10 };
        dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(2).height = 16;

        // ── Column widths ─────────────────────────────────────────────────────────
        ws.columns = [
            { width: 28 },  // Department
            { width: 24 },  // Property No.
            { width: 25 },  // Article
            { width: 35 },  // Description
            { width: 15 },  // Brand
            { width: 15 },  // Model
            { width: 22 },  // Serial No.
            { width: 13 },  // Quantity
            { width: 20 },  // Acquisition Cost
            { width: 32 },  // Accountable Person
            { width: 20 },  // Date Acquired
        ];

        // ── Header row ────────────────────────────────────────────────────────────
        const headerRow = ws.getRow(4);
        headerRow.values = [
            'Department', 'Property No.', 'Article', 'Description',
            'Brand', 'Model', 'Serial No.', 'Unit / Quantity',
            'Acquisition Cost', 'Accountable Person / End User', 'Date Acquired',
        ];
        headerRow.font = { bold: true, name: FONT, size: 10 };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        headerRow.height = 28;
        headerRow.eachCell({ includeEmpty: true }, cell => { cell.border = border; });

        // ── Data rows (combined) ──────────────────────────────────────────────────
        const rows = buildCombinedRows(deptItems);

        rows.forEach((r, i) => {
            const rowNum = 5 + i;
            const dataRow = ws.getRow(rowNum);

            dataRow.values = [
                r.department,
                formatPropertyNumbers(r.propertyNumbers),
                r.article || '-',
                r.description || '-',
                r.brand || '-',
                r.model || '-',
                r.serials.join(', ') || '-',
                r.quantity,
                r.unitCost,
                r.accountable,
                r.dateAcquired || '-',
            ];

            dataRow.getCell(8).numFmt = '#,##0';
            dataRow.getCell(9).numFmt = '₱#,##0.00';
            dataRow.font = { name: FONT, size: 10 };

            dataRow.alignment = { vertical: 'middle', wrapText: true };
            dataRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
            dataRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
            dataRow.getCell(11).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

            dataRow.eachCell({ includeEmpty: true }, cell => { cell.border = border; });
        });
    }

    // ── Download ──────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventory_All_Departments_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}