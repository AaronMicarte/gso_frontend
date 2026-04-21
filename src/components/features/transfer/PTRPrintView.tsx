import React from 'react';
import { PropertyTransfer } from '@/types/propertyTransfer';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface PTRPrintViewProps {
    transfer: PropertyTransfer;
}

export const PTRPrintView = React.forwardRef<HTMLDivElement, PTRPrintViewProps>(({ transfer }, ref) => {
    const formatDate = (dateString?: string | null) => {
        if (!dateString) return '';
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'MM/dd/yyyy');
    };

    const ensureText = (value: unknown, fallback: string) => {
        const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        return text.length > 0 ? text : fallback;
    };

    const entityName = 'CITY GOVERNMENT OF EL SALVADOR';

    const items = transfer.items ?? [];
    const docDate = ensureText(formatDate(transfer.ApprovedAt || transfer.created_at || ''), 'Missing date');

    const borrowerName = ensureText(transfer.fromEndUser?.FullName, 'Missing releasing custodian');
    const borrowerOffice = ensureText(
        transfer.fromEndUser?.DepartmentName || transfer.fromDepartment?.DepartmentName,
        'Missing department'
    );

    const borrowingName = ensureText(transfer.toEndUser?.FullName, 'Missing receiving custodian');
    const borrowingOffice = ensureText(
        transfer.toEndUser?.DepartmentName || transfer.toDepartment?.DepartmentName,
        'Missing department'
    );

    return (
        <div ref={ref} className="print-container gso-print-doc bg-white p-6 max-w-4xl mx-auto text-black">
            <style dangerouslySetInnerHTML={{
                __html: `
                    @media print {
                        .print-container {
                            padding: 0;
                            max-width: none;
                            margin: 0;
                            font-size: 12px;
                            line-height: 1.3;
                            font-family: Arial, Helvetica, sans-serif;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                `
            }} />

            <div className="gso-print-title mb-1">Property Transfer Report</div>

            <div className="grid grid-cols-2 gap-4 mb-1 text-xs leading-tight">
                <div className="space-y-1">
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Entity Name :</div>
                        <div className="flex-1 border-b border-black pb-0.5">{entityName}</div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Fund Cluster :</div>
                        <div className="flex-1 border-b border-black pb-0.5"></div>
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex items-end gap-2 justify-end">
                        <div className="whitespace-nowrap">PTR No. :</div>
                        <div className="w-48 border-b border-black pb-0.5 text-right">{transfer.TransferNumber}</div>
                    </div>
                    <div className="flex items-end gap-2 justify-end">
                        <div className="whitespace-nowrap">Date :</div>
                        <div className="w-48 border-b border-black pb-0.5 text-right">{docDate}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-2 leading-tight">
                <div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Releasing Custodian:</div>
                        <div className="flex-1 border-b border-black pb-0.5">{borrowerName}</div>
                    </div>
                    <div className="flex items-end gap-2 mt-1">
                        <div className="whitespace-nowrap">Department:</div>
                        <div className="flex-1 border-b border-black pb-0.5">{borrowerOffice}</div>
                    </div>
                </div>
                <div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Receiving Custodian:</div>
                        <div className="flex-1 border-b border-black pb-0.5">{borrowingName}</div>
                    </div>
                    <div className="flex items-end gap-2 mt-1">
                        <div className="whitespace-nowrap">Department:</div>
                        <div className="flex-1 border-b border-black pb-0.5">{borrowingOffice}</div>
                    </div>
                </div>
            </div>

            <table className="w-full border-collapse border border-black text-[11px] leading-tight">
                <thead>
                    <tr>
                        <th className="border border-black px-1 py-[2px] w-[50px] text-center">Qty</th>
                        <th className="border border-black px-1 py-[2px] w-[70px] text-center">Unit</th>
                        <th className="border border-black px-1 py-[2px] text-center">Description</th>
                        <th className="border border-black px-1 py-[2px] w-[110px] text-center">Property No.</th>
                        <th className="border border-black px-1 py-[2px] w-[110px] text-center">Serial No.</th>
                    </tr>
                </thead>
                <tbody>
                    {(() => {
                        const rowsNeeded = 18;
                        const rows = items.slice(0, rowsNeeded).map((item, idx) => {
                            const inv = item.inventoryDetail;
                            const description = ensureText(inv?.Description, 'Missing description');
                            const unitName = ensureText(inv?.unitOfMeasure?.UnitName, 'Missing unit');
                            const propertyNo = ensureText(inv?.PropertyNumber, 'Missing property number');
                            const serial = ensureText(inv?.SerialNumber || inv?.drDetail?.SerialNumber, 'Missing serial');

                            return (
                                <tr key={item.TransferItemID ?? idx}>
                                    <td className="border border-black px-1 py-[2px] text-center">{item.Quantity ?? 1}</td>
                                    <td className="border border-black px-1 py-[2px] text-center">{unitName}</td>
                                    <td className="border border-black px-1 py-[2px]">{description}</td>
                                    <td className="border border-black px-1 py-[2px] text-center">{propertyNo}</td>
                                    <td className="border border-black px-1 py-[2px] text-center">{serial}</td>
                                </tr>
                            );
                        });

                        const blanks = Math.max(0, rowsNeeded - rows.length);
                        for (let i = 0; i < blanks; i++) {
                            rows.push(
                                <tr key={`blank-${i}`}>
                                    <td className="border border-black px-1 py-[2px] h-[23px]">&nbsp;</td>
                                    <td className="border border-black px-1 py-[2px]">&nbsp;</td>
                                    <td className="border border-black px-1 py-[2px]">&nbsp;</td>
                                    <td className="border border-black px-1 py-[2px]">&nbsp;</td>
                                    <td className="border border-black px-1 py-[2px]">&nbsp;</td>
                                </tr>
                            );
                        }

                        return rows;
                    })()}
                </tbody>
            </table>

            <div className="grid grid-cols-2 gap-10 mt-8 text-xs">
                <div>
                    <div className="mb-6">Released by (Releasing Custodian):</div>
                    <div className="border-b border-black h-12"></div>
                    <div className="text-[10px] text-center mt-1">Signature over Printed Name</div>
                    <div className="border-b border-black mt-3 pb-1 text-center">{borrowerName}</div>
                    <div className="text-[10px] text-center mt-1">Position/Office</div>
                    <div className="border-b border-black mt-2 pb-1 text-center">{borrowerOffice}</div>
                    <div className="text-[10px] text-center mt-1">Date</div>
                    <div className="border-b border-black mt-2 pb-1 text-center">{formatDate(transfer.BorrowerSignedAt) || docDate}</div>
                </div>

                <div>
                    <div className="mb-6">Received by (Receiving Custodian):</div>
                    <div className="border-b border-black h-12"></div>
                    <div className="text-[10px] text-center mt-1">Signature over Printed Name</div>
                    <div className="border-b border-black mt-3 pb-1 text-center">{borrowingName}</div>
                    <div className="text-[10px] text-center mt-1">Position/Office</div>
                    <div className="border-b border-black mt-2 pb-1 text-center">{borrowingOffice}</div>
                    <div className="text-[10px] text-center mt-1">Date</div>
                    <div className="border-b border-black mt-2 pb-1 text-center">{formatDate(transfer.BorrowingSignedAt) || docDate}</div>
                </div>
            </div>

        </div>
    );
});

PTRPrintView.displayName = 'PTRPrintView';
