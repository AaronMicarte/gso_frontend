import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { DeliveryReceipt } from '@/types/procurement';

const formatPHDate = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
        const parsed = new Date(dateString);
        if (Number.isNaN(parsed.getTime())) return '';
        return format(toZonedTime(parsed, 'Asia/Manila'), 'MM/dd/yyyy');
    } catch {
        return dateString ?? '';
    }
};

const estimateLines = (text: string, charsPerLine: number): number => {
    if (!text || text.trim().length === 0) return 1;
    const segments = text.split('\n');
    return segments.reduce((acc, seg) => acc + Math.max(1, Math.ceil(seg.length / charsPerLine)), 0);
};

const COL_CONFIG: Record<number, { width: number; charsPerLine: number }> = {
    1: { width: 13, charsPerLine: 6 },
    2: { width: 9.11, charsPerLine: 8 },
    3: { width: 6.55, charsPerLine: 999 },
    4: { width: 39.11, charsPerLine: 37 },
    5: { width: 10.89, charsPerLine: 10 },
    6: { width: 13, charsPerLine: 12 },
    7: { width: 3, charsPerLine: 999 },
    8: { width: 12, charsPerLine: 12 },
};

// ── Exact shape XML copied from IAR.xlsx template drawing1.xml ───────────────
// All coordinates (EMU, col/row indices) are taken verbatim from the template.
// prst=flowChartProcess + solidFill FFFFFF + ln w=9525 matches the template exactly.

const SHAPE_1508 = `<xdr:twoCellAnchor>` +
    `<xdr:from><xdr:col>0</xdr:col><xdr:colOff>304800</xdr:colOff><xdr:row>48</xdr:row><xdr:rowOff>123824</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>0</xdr:col><xdr:colOff>590550</xdr:colOff><xdr:row>49</xdr:row><xdr:rowOff>123825</xdr:rowOff></xdr:to>` +
    `<xdr:sp macro="" textlink="">` +
    `<xdr:nvSpPr>` +
    `<xdr:cNvPr id="20" name="AutoShape 1508"/>` +
    `<xdr:cNvSpPr><a:spLocks noChangeArrowheads="1"/></xdr:cNvSpPr>` +
    `</xdr:nvSpPr>` +
    `<xdr:spPr>` +
    `<a:xfrm><a:off x="304800" y="9008744"/><a:ext cx="285750" cy="182881"/></a:xfrm>` +
    `<a:prstGeom prst="flowChartProcess"><a:avLst/></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>` +
    `<a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:miter lim="800000"/></a:ln>` +
    `</xdr:spPr>` +
    `</xdr:sp>` +
    `<xdr:clientData/>` +
    `</xdr:twoCellAnchor>`;

const SHAPE_1510_COMPLETE = `<xdr:twoCellAnchor>` +
    `<xdr:from><xdr:col>4</xdr:col><xdr:colOff>552450</xdr:colOff><xdr:row>48</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>4</xdr:col><xdr:colOff>714374</xdr:colOff><xdr:row>48</xdr:row><xdr:rowOff>180975</xdr:rowOff></xdr:to>` +
    `<xdr:sp macro="" textlink="">` +
    `<xdr:nvSpPr>` +
    `<xdr:cNvPr id="21" name="AutoShape 1510"/>` +
    `<xdr:cNvSpPr><a:spLocks noChangeArrowheads="1"/></xdr:cNvSpPr>` +
    `</xdr:nvSpPr>` +
    `<xdr:spPr>` +
    `<a:xfrm><a:off x="4926330" y="8923020"/><a:ext cx="161924" cy="142875"/></a:xfrm>` +
    `<a:prstGeom prst="flowChartProcess"><a:avLst/></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>` +
    `<a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:miter lim="800000"/></a:ln>` +
    `</xdr:spPr>` +
    `</xdr:sp>` +
    `<xdr:clientData/>` +
    `</xdr:twoCellAnchor>`;

const SHAPE_1510_PARTIAL = `<xdr:twoCellAnchor>` +
    `<xdr:from><xdr:col>4</xdr:col><xdr:colOff>571501</xdr:colOff><xdr:row>49</xdr:row><xdr:rowOff>28575</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>5</xdr:col><xdr:colOff>1</xdr:colOff><xdr:row>49</xdr:row><xdr:rowOff>171450</xdr:rowOff></xdr:to>` +
    `<xdr:sp macro="" textlink="">` +
    `<xdr:nvSpPr>` +
    `<xdr:cNvPr id="22" name="AutoShape 1510"/>` +
    `<xdr:cNvSpPr><a:spLocks noChangeArrowheads="1"/></xdr:cNvSpPr>` +
    `</xdr:nvSpPr>` +
    `<xdr:spPr>` +
    `<a:xfrm><a:off x="4945381" y="9096375"/><a:ext cx="175260" cy="142875"/></a:xfrm>` +
    `<a:prstGeom prst="flowChartProcess"><a:avLst/></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>` +
    `<a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:miter lim="800000"/></a:ln>` +
    `</xdr:spPr>` +
    `</xdr:sp>` +
    `<xdr:clientData/>` +
    `</xdr:twoCellAnchor>`;

async function injectCheckboxShapes(zipBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    const zip = await JSZip.loadAsync(zipBuffer);
    const drawingPath = 'xl/drawings/drawing1.xml';
    const drawingFile = zip.file(drawingPath);
    if (!drawingFile) return zipBuffer;

    let xml = await drawingFile.async('string');
    xml = xml.replace('</xdr:wsDr>', SHAPE_1508 + SHAPE_1510_COMPLETE + SHAPE_1510_PARTIAL + '</xdr:wsDr>');
    zip.file(drawingPath, xml);

    return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

export async function exportIARToExcel(
    dr: DeliveryReceipt,
    inspectionOfficerName?: string,
): Promise<void> {
    const templateUrl = `${window.location.origin}/assets/templates/IAR.xlsx`;
    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error(`Failed to load IAR template (Status: ${response.status})`);
    const buffer = await response.arrayBuffer();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet(1);
    if (!ws) throw new Error('Worksheet not found in IAR template');

    const resolvedInspectionOfficer = inspectionOfficerName || '';
    const supplierCustodian = dr.requestedByUser?.FullName || dr.RequestedByName || '';

    // ── Header ──
    ws.getCell('A8').value = 'Supplier: ';
    ws.getCell('B8').value = dr.SupplierName || '';
    ws.getCell('B8').font = { bold: true };
    ws.getCell('F8').value = `A.R. No. ${dr.IARNumber || ''}`;
    ws.getCell('A9').value = 'PS APR No. :';
    ws.getCell('B9').value = dr.PONumber || '';
    ws.getCell('D9').value = 'Date:';
    ws.getCell('E9').value = formatPHDate(dr.DateReceived);
    ws.getCell('G9').value = dr.InvoiceNumber || '';
    ws.getCell('A10').value = 'Requisitioning Office/Department';
    ws.getCell('D10').value = dr.requestedByUser?.department?.DepartmentName || dr.DepartmentName || '';

    // ── Column widths ──
    for (const [colNum, config] of Object.entries(COL_CONFIG)) {
        ws.getColumn(Number(colNum)).width = config.width;
    }

    // ── Data rows ──
    const DATA_START_ROW = 13;
    const MAX_ROWS = 33;
    const LINE_HEIGHT = 16;
    const MIN_HEIGHT = 20;
    const PADDING = 6;
    const details = dr.details ?? [];

    for (let i = 0; i < Math.min(details.length, MAX_ROWS); i++) {
        const item = details[i];
        const r = DATA_START_ROW + i;

        const description = [
            item?.article?.ArticleName,
            item?.ItemDescription,
            item?.Brand,
            item?.ModelNumber,
            item?.SerialNumber,
        ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0).join(', ');

        const unitName = item?.unitOfMeasure?.UnitName ?? '';
        const qty = item?.QuantityDelivered != null ? Number(item.QuantityDelivered) : '';
        const unitCost = item?.UnitCost != null ? Number(item.UnitCost) : '';
        const totalCost = typeof qty === 'number' && typeof unitCost === 'number' ? qty * unitCost : '';

        ws.getCell(r, 1).value = i + 1;
        ws.getCell(r, 2).value = unitName;
        ws.getCell(r, 3).value = description;
        ws.getCell(r, 5).value = qty;

        const ucCell = ws.getCell(r, 6);
        ucCell.value = unitCost;
        if (typeof unitCost === 'number') ucCell.numFmt = '#,##0.00';

        const tcCell = ws.getCell(r, 8);
        tcCell.value = totalCost;
        if (typeof totalCost === 'number') tcCell.numFmt = '#,##0.00';

        ws.getCell(r, 1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        ws.getCell(r, 2).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        ws.getCell(r, 3).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        ws.getCell(r, 5).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        ws.getCell(r, 6).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        ws.getCell(r, 8).alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };

        const cellTexts = [
            { col: 1, text: String(i + 1) },
            { col: 2, text: unitName },
            { col: 3, text: description },
            { col: 5, text: typeof qty === 'number' ? String(qty) : '' },
            { col: 6, text: typeof unitCost === 'number' ? unitCost.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '' },
            { col: 8, text: typeof totalCost === 'number' ? totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '' },
        ];

        const maxLines = cellTexts.reduce((max, { col, text }) => {
            const chars = COL_CONFIG[col]?.charsPerLine ?? 15;
            return Math.max(max, estimateLines(text, chars));
        }, 1);

        ws.getRow(r).height = Math.max(MIN_HEIGHT, maxLines * LINE_HEIGHT + PADDING);
    }

    // ── Signature section ──
    ws.getRow(47).height = 18;
    ws.getRow(48).height = 18;
    // rows 49/50: leave height alone — shapes are anchored there with template-exact EMU coords
    ws.getRow(51).height = 18;
    ws.getRow(52).height = 18;
    ws.getRow(53).height = 20;
    ws.getRow(54).height = 18;

    ws.getCell('A47').value = 'INSPECTION';
    ws.getCell('A47').alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell('A47').font = { bold: true };

    ws.getCell('A48').value = 'Date Inspected:';
    ws.getCell('C48').value = formatPHDate(dr.DateInspected || dr.DateReceived);

    ws.getCell('B49').value = 'Inspected, verified and found OK';
    ws.getCell('B49').alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
    ws.getCell('B50').value = 'as to quantity and specifications';
    ws.getCell('B50').alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };

    ws.getCell('B53').value = resolvedInspectionOfficer;
    ws.getCell('B53').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    ws.getCell('B53').font = { bold: true };
    ws.getCell('B54').value = 'Inspection Officer';
    ws.getCell('B54').alignment = { vertical: 'middle', horizontal: 'center' };

    ws.getCell('E47').value = 'ACCEPTANCE';
    ws.getCell('E47').alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getCell('E47').font = { bold: true };

    ws.getCell('E48').value = 'Date Received:';

    ws.getCell('F49').value = 'Complete';
    ws.getCell('F49').alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
    ws.getCell('F50').value = 'Partial';
    ws.getCell('F50').alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };

    ws.getCell('E53').value = supplierCustodian;
    ws.getCell('E53').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    ws.getCell('E53').font = { bold: true };
    ws.getCell('E54').value = 'Supply and/or Property Custodian';
    ws.getCell('E54').alignment = { vertical: 'middle', horizontal: 'center' };

    // ── Print setup ──
    ws.pageSetup = {
        orientation: 'portrait',
        paperSize: 5,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };
    ws.views = [{ showGridLines: true }];

    // ── Write via ExcelJS then inject shapes via JSZip ──
    const excelBuffer = await wb.xlsx.writeBuffer();
    const finalBuffer = await injectCheckboxShapes(excelBuffer as ArrayBuffer);

    const blob = new Blob([finalBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const safeIAR = (typeof dr.IARNumber === 'string' && dr.IARNumber)
        ? dr.IARNumber.replace(/[/\\?%*:|"<>]/g, '-')
        : 'IAR';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IAR_${safeIAR}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

export default exportIARToExcel;