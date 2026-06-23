'use client';

import React from 'react';
import { compressPropertyNumbers } from '@/lib/utils/propertyNumbers';
import { DeliveryReceipt } from '@/types/procurement';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuth } from '@/lib/hooks/useAuth';
import exportDRToExcel from './IARExport';

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
    const { user } = useAuth();
    const details = dr.details ?? [];
    const rowsNeeded = 11;
    const inspectedDate = formatManilaDate(dr.DateInspected || dr.DateReceived);
    const receivedDate = formatManilaDate(dr.DateReceived);
    const iarNumber = typeof dr.IARNumber === 'string' ? dr.IARNumber : '';
    const inspectionOfficerName = user?.FullName || dr.receivedByUser?.FullName || '';
    const supplierCustodian = dr.requestedByUser?.FullName || dr.RequestedByName || '';

    return (
        <div>
            <div ref={ref} className="gso-print-doc bg-white p-8 max-w-4xl mx-auto text-black">

                <div className="text-[11px]">
                    <div className="gso-print-title">Inspection and Acceptance Report</div>
                    <div className="grid grid-cols-2 gap-6 mb-1 px-1">
                        <div className="flex items-end gap-1">
                            <div className="whitespace-nowrap font-semibold">Entity Name :</div>
                            <div className="flex-1 border-b border-slate-500 leading-none">CITY GOVERNMENT OF EL SALVADOR</div>
                        </div>
                        <div className="flex items-end gap-1">
                            <div className="whitespace-nowrap font-semibold">Fund Cluster :</div>
                            <div className="flex-1 border-b border-slate-500 leading-none">&nbsp;</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 border border-slate-500 border-b-0">
                        <div className="p-1.5 space-y-1">
                            <div className="flex items-end gap-1">
                                <div className="whitespace-nowrap">Supplier :</div>
                                <div className="flex-1 border-b border-slate-500 leading-none">{dr.SupplierName || ''}</div>
                            </div>
                            <div className="flex items-end gap-1">
                                <div className="whitespace-nowrap">PO No./Date :</div>
                                <div className="flex-1 border-b border-slate-500 leading-none">{dr.PONumber || ''}</div>
                            </div>
                            <div className="flex items-end gap-1">
                                <div className="whitespace-nowrap">Requisitioning Office/Dept. :</div>
                                <div className="flex-1 border-b border-black leading-none">{dr.requestedByUser?.department?.DepartmentName || dr.DepartmentName || ''}</div>
                            </div>
                            <div className="flex items-end gap-1">
                                <div className="whitespace-nowrap">Responsibility Center Code :</div>
                                <div className="flex-1 border-b border-black leading-none">&nbsp;</div>
                            </div>
                        </div>
                        <div className="p-1.5 space-y-1 border-l border-black">
                            <div className="flex items-end gap-1">
                                <div className="whitespace-nowrap">IAR No. :</div>
                                <div className="flex-1 border-b border-black leading-none">{iarNumber || '\u00A0'}</div>
                            </div>
                            <div className="flex items-end gap-1">
                                <div className="whitespace-nowrap">Date :</div>
                                <div className="flex-1 border-b border-black leading-none">{receivedDate}</div>
                            </div>
                            <div className="flex items-end gap-1">
                                <div className="whitespace-nowrap">Invoice No. :</div>
                                <div className="flex-1 border-b border-black leading-none">{dr.InvoiceNumber || ''}</div>
                            </div>
                            <div className="flex items-end gap-1">
                                <div className="whitespace-nowrap">Date :</div>
                                <div className="flex-1 border-b border-black leading-none">{receivedDate}</div>
                            </div>
                        </div>
                    </div>

                    <table className="w-full border-collapse border border-black">
                        <thead>
                            <tr>
                                <th className="border-b border-black border-r border-black px-1 py-1 text-center w-[120px] italic">Stock<br />Property No.</th>
                                <th className="border-b border-black border-r border-black px-1 py-1 text-center italic">Description</th>
                                <th className="border-b border-black border-r border-black px-1 py-1 text-center w-[100px] italic">Unit</th>
                                <th className="border-b border-black px-1 py-1 text-center w-[100px] italic">Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: rowsNeeded }).map((_, idx) => {
                                const item = details[idx];
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

                                return (
                                    <tr key={`iar-row-${idx}`}>
                                        <td className="h-8 border-b border-black border-r border-black px-1 py-1 align-top whitespace-pre-line">
                                            {compressedPropertyNumbers}
                                        </td>
                                        <td className="h-8 border-b border-black border-r border-black px-1 py-1">{description}</td>
                                        <td className="h-8 border-b border-black border-r border-black px-1 py-1 text-center">{item?.unitOfMeasure?.UnitName || ''}</td>
                                        <td className="h-8 border-b border-black px-1 py-1 text-center">{item?.QuantityDelivered ?? ''}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="grid grid-cols-2 border border-black border-t-0 min-h-[220px]">
                        <div className="border-r border-black">
                            <div className="text-center italic font-semibold py-1 border-b border-black">INSPECTION</div>
                            <div className="p-1.5 text-[11px] dr-signature-block h-full flex flex-col">
                                <div className="flex items-center h-7">
                                    <div>
                                        <span className="inline-block w-[94px]">Date Inspected :</span>
                                        <span className="inline-block border-b border-black min-w-[170px]">{inspectedDate}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col flex-1 justify-start pt-1">
                                    <div className="mb-1">Inspected, verified and found in order as to quantity and specifications</div>
                                    <div className="mb-1">
                                        <span className="inline-block w-6 h-6 border border-black align-middle" />
                                    </div>
                                    <div className="mt-auto text-center">{inspectionOfficerName || '\u00A0'}</div>
                                </div>
                                <div className="pt-0 border-t border-black text-center h-10 flex flex-col justify-start">
                                    <div>Inspection Officer/Inspection Committee</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="text-center italic font-semibold py-1 border-b border-black">ACCEPTANCE</div>
                            <div className="p-1.5 text-[11px] dr-signature-block h-full flex flex-col">
                                <div className="flex items-center h-7">
                                    <div>
                                        <span className="inline-block w-[94px]">Date Received :</span>
                                        <span className="inline-block border-b border-black min-w-[170px]">{'\u00A0'}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col flex-1 justify-start pt-1">
                                    <div className="mb-1">Complete</div>
                                    <div className="mb-0.5">
                                        <span className="inline-block w-6 h-6 border border-black align-middle" />
                                    </div>
                                    <div className="mb-1">Partial (pls. specify quantity)</div>
                                    <div className="mb-0.5">
                                        <span className="inline-block w-6 h-6 border border-black align-middle" />
                                    </div>
                                    <div className="mt-auto text-center">{supplierCustodian || '\u00A0'}</div>
                                </div>
                                <div className="pt-0 border-t border-black text-center h-10 flex flex-col justify-start">
                                    <div>Supply and/or Property Custodian</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <style jsx>{`
                        .dr-signature-block {
                            min-height: 80px;
                            display: flex;
                            flex-direction: column;
                            justify-content: flex-end;
                        }
                    `}</style>
                </div>
            </div>
        </div>
    );
});
DRPrintView.displayName = 'DRPrintView';
