'use client';

import ExcelJS from 'exceljs';
import { compressPropertyNumbers } from '@/lib/utils/propertyNumbers';
import { DeliveryReceipt } from '@/types/procurement';

function formatManilaDate(dateString?: string | null, pattern: string = 'MMM dd, yyyy'): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    // lightweight formatting to avoid adding another dependency
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function thinBorder() {
    return { style: 'thin', color: { argb: 'FF000000' } } as any;
}

export async function exportDRToExcel(dr: DeliveryReceipt, inspectionOfficerName?: string, supplierCustodian?: string) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GSO';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('DR', {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, horizontalCentered: true },
    });

    // Columns layout roughly matching print view
    sheet.columns = [
        { header: 'Stock Property No.', key: 'prop', width: 28 },
        { header: 'Description', key: 'desc', width: 72 },
        { header: 'Unit', key: 'unit', width: 14 },
        { header: 'Quantity', key: 'qty', width: 12 },
    ];

    // Title
    sheet.mergeCells('A1:D1');
    const title = sheet.getCell('A1');
    title.value = 'INSPECTION AND ACCEPTANCE REPORT';
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.font = { bold: true, size: 14 };

    // Entity / Fund cluster
    sheet.mergeCells('A2:B2');
    sheet.mergeCells('C2:D2');
    sheet.getCell('A2').value = 'Entity Name : CITY GOVERNMENT OF EL SALVADOR';
    sheet.getCell('C2').value = 'Fund Cluster :';
    sheet.getCell('A2').font = { bold: true };

    // Supplier / IAR etc - use a block of rows to mirror the print view
    sheet.mergeCells('A3:B6');
    sheet.mergeCells('C3:D6');

    const supplier = sheet.getCell('A3');
    supplier.value = `Supplier : ${dr.SupplierName || ''}\nPO No./Date : ${dr.PONumber || ''}\nRequisitioning Office/Dept. : ${dr.requestedByUser?.department?.DepartmentName || dr.DepartmentName || ''}`;
    supplier.alignment = { vertical: 'top', wrapText: true };

    const rightBlock = sheet.getCell('C3');
    const iarNumber = typeof dr.IARNumber === 'string' ? dr.IARNumber : '';
    const receivedDate = formatManilaDate(dr.DateReceived);
    rightBlock.value = `IAR No. : ${iarNumber}\nDate : ${receivedDate}\nInvoice No. : ${dr.InvoiceNumber || ''}\nDate : ${receivedDate}`;
    rightBlock.alignment = { vertical: 'top', wrapText: true };

    // Header table header row
    const headerRow = sheet.addRow(['Stock Property No.', 'Description', 'Unit', 'Quantity']);
    headerRow.font = { italic: true };
    headerRow.eachCell((cell) => {
        cell.border = { top: thinBorder(), left: thinBorder(), bottom: thinBorder(), right: thinBorder() } as any;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    const details = dr.details ?? [];
    const rowsNeeded = 11;

    for (let i = 0; i < rowsNeeded; i++) {
        const item = details[i];
        const propertyNumbers = (item?.propertyNumbers && item.propertyNumbers.length > 0)
            ? item.propertyNumbers
            : (item?.inventoryDetails?.map((inv) => inv.PropertyNumber).filter(Boolean) ?? []);
        const compressedPropertyNumbers = Array.isArray(propertyNumbers)
            ? compressPropertyNumbers(propertyNumbers.join('/'))
            : compressPropertyNumbers(String(propertyNumbers || ''));

        const description = item
            ? [
                item.article?.ArticleName,
                item.ItemDescription,
                item.Brand ? `Brand: ${item.Brand}` : null,
                item.ModelNumber ? `Model: ${item.ModelNumber}` : null,
            ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0).join(' / ')
            : '';

        const row = sheet.addRow([compressedPropertyNumbers, description, item?.unitOfMeasure?.UnitName || '', item?.QuantityDelivered ?? '']);
        row.height = 18;
        row.eachCell((cell) => {
            cell.border = { top: thinBorder(), left: thinBorder(), bottom: thinBorder(), right: thinBorder() } as any;
            cell.alignment = { vertical: 'top', wrapText: true } as any;
            cell.font = { size: 10 } as any;
        });
    }

    // Signature area - create a two-column block
    const startRow = sheet.addRow([]);
    sheet.addRow([]);
    const sigTop = sheet.addRow([]);
    // left block merge
    const sigRowIndex = sheet.lastRow?.number ?? 1;
    const leftTop = sigRowIndex + 1;
    sheet.mergeCells(`A${leftTop}:B${leftTop + 6}`);
    sheet.mergeCells(`C${leftTop}:D${leftTop + 6}`);

    // Add labels and values in the merged cells
    sheet.getCell(`A${leftTop}`).value = `INSPECTION\nDate Inspected : ${formatManilaDate(dr.DateInspected || dr.DateReceived)}\n\nInspected, verified and found in order as to quantity and specifications\n\n${inspectionOfficerName || ''}`;
    sheet.getCell(`C${leftTop}`).value = `ACCEPTANCE\nDate Received : \n\nComplete [ ]\nPartial (pls. specify quantity) [ ]\n\n${supplierCustodian || ''}`;
    sheet.getCell(`A${leftTop}`).alignment = { vertical: 'top', wrapText: true } as any;
    sheet.getCell(`C${leftTop}`).alignment = { vertical: 'top', wrapText: true } as any;

    // Apply borders around the signature area
    const sigRange = sheet.getCell(`A${leftTop}`).address + ':' + sheet.getCell(`D${leftTop + 6}`).address;
    // draw outer border by iterating cells
    for (let r = leftTop; r <= leftTop + 6; r++) {
        for (let c = 1; c <= 4; c++) {
            const cell = sheet.getCell(r, c);
            cell.border = { top: thinBorder(), left: thinBorder(), bottom: thinBorder(), right: thinBorder() } as any;
        }
    }

    // Final formatting tweaks
    sheet.properties.defaultRowHeight = 18;

    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeIAR = (typeof dr.IARNumber === 'string' && dr.IARNumber) ? dr.IARNumber.replace(/[^a-z0-9-_]/gi, '_') : 'dr';
    a.download = `DR_${safeIAR}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export default exportDRToExcel;
