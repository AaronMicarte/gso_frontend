import React from 'react';
import { PropertyBorrow } from '@/types/propertyBorrow';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface BorrowPrintViewProps {
    borrow: PropertyBorrow;
}

export const BorrowPrintView = React.forwardRef<HTMLDivElement, BorrowPrintViewProps>(({ borrow }, ref) => {
    const formatDate = (dateString?: string | null) => {
        if (!dateString) return '';
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'MM/dd/yyyy');
    };

    const ensureText = (value: unknown, fallback: string) => {
        const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        return text.length > 0 ? text : fallback;
    };

    const entityName = 'CITY GOVERNMENT OF EL SALVADOR';
    const fundCluster = 'GENERAL FUND';

    const items = borrow.items ?? [];
    const docDate = ensureText(formatDate(borrow.ApprovedAt || borrow.created_at || ''), 'Missing date');
    const dueDate = ensureText(formatDate(borrow.DueDate), 'Missing due date');

    const releasingName = ensureText(borrow.fromEndUser?.FullName, 'Missing releasing custodian');
    const releasingOffice = ensureText(
        borrow.fromEndUser?.DepartmentName || borrow.fromDepartment?.DepartmentName,
        'Missing department'
    );

    const borrowingName = ensureText(borrow.toEndUser?.FullName, 'Missing borrowing custodian');
    const borrowingOffice = ensureText(
        borrow.toEndUser?.DepartmentName || borrow.toDepartment?.DepartmentName,
        'Missing department'
    );

    return (
        <div ref={ref} className="print-container gso-print-doc bg-white p-8 max-w-4xl mx-auto text-black">
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

            <div className="gso-print-title">Property Borrow Report</div>
            <div className="text-center text-xs mb-2">(PBR) - 4 Copies</div>

            <div className="grid grid-cols-2 gap-4 mb-2 text-xs">
                <div className="space-y-1">
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Entity Name :</div>
                        <div className="flex-1 border-b border-black pb-0.5">{entityName}</div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Fund Cluster :</div>
                        <div className="flex-1 border-b border-black pb-0.5">{fundCluster}</div>
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex items-end gap-2 justify-end">
                        <div className="whitespace-nowrap">PBR No. :</div>
                        <div className="w-48 border-b border-black pb-0.5 text-right">{borrow.BorrowNumber}</div>
                    </div>
                    <div className="flex items-end gap-2 justify-end">
                        <div className="whitespace-nowrap">Date :</div>
                        <div className="w-48 border-b border-black pb-0.5 text-right">{docDate}</div>
                    </div>
                    <div className="flex items-end gap-2 justify-end">
                        <div className="whitespace-nowrap">Due Date :</div>
                        <div className="w-48 border-b border-black pb-0.5 text-right">{dueDate}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                <div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Releasing Custodian:</div>
                        <div className="flex-1 border-b border-black pb-0.5">{releasingName}</div>
                    </div>
                    <div className="flex items-end gap-2 mt-1">
                        <div className="whitespace-nowrap">Department:</div>
                        <div className="flex-1 border-b border-black pb-0.5">{releasingOffice}</div>
                    </div>
                </div>
                <div>
                    <div className="flex items-end gap-2">
                        <div className="whitespace-nowrap">Borrowing Custodian:</div>
                        <div className="flex-1 border-b border-black pb-0.5">{borrowingName}</div>
                    </div>
                    <div className="flex items-end gap-2 mt-1">
                        <div className="whitespace-nowrap">Department:</div>
                        <div className="flex-1 border-b border-black pb-0.5">{borrowingOffice}</div>
                    </div>
                </div>
            </div>

            <table className="w-full border-collapse border border-black text-[11px]">
                <thead>
                    <tr>
                        <th className="border border-black px-1 py-1 w-[50px] text-center">Qty</th>
                        <th className="border border-black px-1 py-1 w-[70px] text-center">Unit</th>
                        <th className="border border-black px-1 py-1 text-center">Description</th>
                        <th className="border border-black px-1 py-1 w-[110px] text-center">Property No.</th>
                        <th className="border border-black px-1 py-1 w-[110px] text-center">Serial No.</th>
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
                            const serial = ensureText(inv?.SerialNumber, 'Missing serial');

                            return (
                                <tr key={item.BorrowItemID ?? idx}>
                                    <td className="border border-black px-1 py-1 text-center">{item.Quantity ?? 1}</td>
                                    <td className="border border-black px-1 py-1 text-center">{unitName}</td>
                                    <td className="border border-black px-1 py-1">{description}</td>
                                    <td className="border border-black px-1 py-1 text-center">{propertyNo}</td>
                                    <td className="border border-black px-1 py-1 text-center">{serial}</td>
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
                                </tr>
                            );
                        }

                        return rows;
                    })()}
                </tbody>
            </table>

            <div className="grid grid-cols-2 gap-10 mt-10 text-xs">
                <div className="space-y-2">
                    <div className="font-semibold">Released by (Releasing Custodian)</div>
                    <div className="border-b border-black pb-1">{releasingName}</div>
                    <div className="border-b border-black pb-1">{releasingOffice}</div>
                </div>

                <div className="space-y-2">
                    <div className="font-semibold">Received by (Borrowing Custodian)</div>
                    <div className="border-b border-black pb-1">{borrowingName}</div>
                    <div className="border-b border-black pb-1">{borrowingOffice}</div>
                </div>
            </div>

            <div className="mt-6 text-[10px] text-slate-700">
                <div>Copy distribution: Original (GSO), Duplicate (Releasing), Triplicate (Borrowing), Quadruplicate (Accounting/Archive).</div>
            </div>
        </div>
    );
});

BorrowPrintView.displayName = 'BorrowPrintView';
