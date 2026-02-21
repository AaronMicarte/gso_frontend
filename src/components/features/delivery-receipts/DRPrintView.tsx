'use client';

import React from 'react';
import { DeliveryReceipt } from '@/types/procurement';
import { formatInTimeZone } from 'date-fns-tz';
import Image from 'next/image';

interface DRPrintViewProps {
    dr: DeliveryReceipt;
}

function formatManilaDate(dateString?: string | null, pattern: string = 'MMM dd, yyyy'): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return formatInTimeZone(date, 'Asia/Manila', pattern);
}

export const DRPrintView = React.forwardRef<HTMLDivElement, DRPrintViewProps>(({ dr }, ref) => {
    const details = dr.details ?? [];

    const totalAmount = details.reduce((sum, item) => {
        const total = typeof item.TotalCost === 'number' ? item.TotalCost : Number(item.TotalCost);
        return sum + (Number.isFinite(total) ? total : 0);
    }, 0);

    // compute workflow status/label similarly to ViewDRPage
    const workflowStatus = dr.workflow_status || ((dr.inspection_status || dr.InspectionStatus) === 'inspected' ? 'to_be_accepted' : 'pending_inspection');
    const workflowLabel = dr.workflow_status_label || (
        workflowStatus === 'to_be_accepted' ? 'To be accepted'
            : workflowStatus === 'to_be_issued' ? 'To be issued'
                : workflowStatus === 'issued' ? 'Issued'
                    : workflowStatus === 'acknowledged' ? 'Acknowledged'
                        : 'Pending inspection'
    );

    return (
        <div ref={ref} className="print-container bg-white p-8 max-w-4xl mx-auto text-black">
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                        @media print {
                            .print-container {
                                padding: 0;
                                max-width: none;
                                margin: 0;
                                font-size: 12px;
                                line-height: 1.35;
                            }
                            .no-print { display: none !important; }
                        }
                        @page {
                            size: A4;
                            margin: 10mm;
                        }
                    `
                }}
            />

            <div className="text-center mb-3">
                <div className="text-sm font-bold">DELIVERY RECEIPT RECORD</div>
                <div className="text-[11px]">(System-generated summary for DR traceability and reporting)</div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                <div className="space-y-1">
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Entity Name :</div>
                        <div className="flex-1 border-b border-black pb-0.5">CITY GOVERNMENT OF EL SALVADOR</div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Supplier Name :</div>
                        <div className="flex-1 border-b border-black pb-0.5">{dr.SupplierName || 'N/A'}</div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Requested By :</div>
                        <div className="flex-1 border-b border-black pb-0.5">{dr.requestedByUser?.FullName || dr.RequestedByName || 'N/A'}</div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Department :</div>
                        <div className="flex-1 border-b border-black pb-0.5">{dr.requestedByUser?.department?.DepartmentName || dr.DepartmentName || 'N/A'}</div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">PR No. :</div>
                        <div className="flex-1 border-b border-black pb-0.5">{dr.PRNumber || 'N/A'}</div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">PO No. :</div>
                        <div className="flex-1 border-b border-black pb-0.5">{dr.PONumber || 'N/A'}</div>
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex items-end gap-2 justify-end">
                        <div className="whitespace-nowrap">DR No. :</div>
                        <div className="w-52 border-b border-black pb-0.5 text-right">{dr.DRNumber}</div>
                    </div>
                    <div className="flex items-end gap-2 justify-end">
                        <div className="whitespace-nowrap">Invoice No. :</div>
                        <div className="w-52 border-b border-black pb-0.5 text-right">{dr.InvoiceNumber || 'N/A'}</div>
                    </div>
                    <div className="flex items-end gap-2 justify-end">
                        <div className="whitespace-nowrap">Date Received :</div>
                        <div className="w-52 border-b border-black pb-0.5 text-right">{formatManilaDate(dr.DateReceived)}</div>
                    </div>
                </div>
            </div>

            <table className="w-full border-collapse border border-black text-[11px]">
                <thead>
                    <tr>
                        <th className="border border-black px-1 py-1 w-[36px] text-center">#</th>
                        <th className="border border-black px-1 py-1 text-center">Item Description</th>
                        <th className="border border-black px-1 py-1 w-[60px] text-center">Unit</th>
                        <th className="border border-black px-1 py-1 w-[60px] text-center">Qty</th>
                        <th className="border border-black px-1 py-1 w-[90px] text-center">Unit Cost</th>
                        <th className="border border-black px-1 py-1 w-[95px] text-center">Total Cost</th>
                    </tr>
                </thead>
                <tbody>
                    {(() => {
                        const rowsNeeded = 18;
                        const rows = details.slice(0, rowsNeeded).map((item, idx) => {
                            const unitCost = typeof item.UnitCost === 'number' ? item.UnitCost : Number(item.UnitCost);
                            const totalCost = typeof item.TotalCost === 'number' ? item.TotalCost : Number(item.TotalCost);

                            const descriptionParts = [
                                item.ItemDescription,
                                item.Brand ? `Brand: ${item.Brand}` : null,
                                item.ModelNumber ? `Model: ${item.ModelNumber}` : null,
                                item.SerialNumber ? `SN: ${item.SerialNumber}` : null
                            ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

                            return (
                                <tr key={item.DRDetailID ?? idx}>
                                    <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                                    <td className="border border-black px-1 py-1 align-top whitespace-pre-line">{descriptionParts.join(' / ')}</td>
                                    <td className="border border-black px-1 py-1 text-center">{item.unitOfMeasure?.UnitName || 'unit'}</td>
                                    <td className="border border-black px-1 py-1 text-center">{item.QuantityDelivered}</td>
                                    <td className="border border-black px-1 py-1 text-right">{Number.isFinite(unitCost) ? unitCost.toFixed(2) : '0.00'}</td>
                                    <td className="border border-black px-1 py-1 text-right">{Number.isFinite(totalCost) ? totalCost.toFixed(2) : '0.00'}</td>
                                </tr>
                            );
                        });

                        const blanks = Math.max(0, rowsNeeded - rows.length);
                        for (let i = 0; i < blanks; i++) {
                            rows.push(
                                <tr key={`blank-${i}`}>
                                    <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                    <td className="border border-black px-1 py-1">&nbsp;</td>
                                    <td className="border border-black px-1 py-1">&nbsp;</td>
                                    <td className="border border-black px-1 py-1">&nbsp;</td>
                                    <td className="border border-black px-1 py-1">&nbsp;</td>
                                    <td className="border border-black px-1 py-1">&nbsp;</td>
                                </tr>
                            );
                        }

                        rows.push(
                            <tr key="total">
                                <td colSpan={5} className="border border-black px-1 py-1 text-right font-bold">TOTAL AMOUNT</td>
                                <td className="border border-black px-1 py-1 text-right font-bold">{totalAmount.toFixed(2)}</td>
                            </tr>
                        );

                        return rows;
                    })()}
                </tbody>
            </table>

            <div className="grid grid-cols-2 gap-10 mt-8 text-xs">
                <div>
                    <div className="mb-6">Received by:</div>
                    <div className="border-b border-black h-10" />
                    <div className="text-[10px] text-center mt-1">Signature over Printed Name</div>
                    <div className="border-b border-black mt-3 pb-1 text-center">{dr.receivedByUser?.FullName || 'RECEIVED BY'}</div>
                    <div className="text-[10px] text-center mt-1">Date</div>
                    <div className="border-b border-black mt-2 pb-1 text-center">{formatManilaDate(dr.DateReceived)}</div>
                </div>

                <div>
                    <div className="mb-6">Remarks:</div>
                    <div className="border border-black min-h-[96px] p-2 whitespace-pre-line">{dr.Remarks || ''}</div>
                    <div className="mt-3">
                        <div className="text-[10px]">Status:</div>
                        <div className="font-semibold">
                            {workflowLabel}
                        </div>
                    </div>
                </div>
            </div>

            {dr.dr_picture_url ? (
                <div className="mt-6">
                    <div className="text-xs font-semibold mb-2">Attached DR Photo (reference)</div>
                    <Image
                        src={dr.dr_picture_url}
                        alt="DR photo"
                        width={900}
                        height={600}
                        unoptimized
                        className="max-h-64 border border-black object-contain"
                    />
                </div>
            ) : null}
        </div>
    );
});

DRPrintView.displayName = 'DRPrintView';
