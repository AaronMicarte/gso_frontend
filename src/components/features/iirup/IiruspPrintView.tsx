import React from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { UnserviceableItemRow } from '@/types/propertyWaste';

interface IiruspPrintViewProps {
    rows: UnserviceableItemRow[];
    startDate?: string;
    endDate?: string;
    mode?: 'month' | 'custom';
}

const formatPHDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'M/d/yyyy');
    } catch {
        return dateString;
    }
};

const formatCurrency = (amount?: number | null) => {
    if (amount == null || Number.isNaN(amount)) return '-';
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const IiruspPrintView = React.forwardRef<HTMLDivElement, IiruspPrintViewProps>(
    ({ rows, startDate, endDate, mode = 'custom' }, ref) => {

        const displayRows = [...rows];
        for (let i = 0; i < 2; i++) {
            displayRows.push({
                id: -(i + 1),
                dateAcquired: '',
                particulars: '',
                propertyNumber: '',
                quantity: null,
                unitCost: null,
                totalCost: null,
            });
        }

        let periodLabel = '_______________';
        if (startDate && endDate) {
            try {
                const start = toZonedTime(new Date(`${startDate}T00:00:00`), 'Asia/Manila');
                const end = toZonedTime(new Date(`${endDate}T00:00:00`), 'Asia/Manila');

                if (mode === 'month') {
                    periodLabel = format(start, 'MMMM yyyy');
                } else {
                    if (startDate === endDate) {
                        periodLabel = format(start, 'MMMM d, yyyy');
                    } else if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
                        periodLabel = `${format(start, 'MMMM')} ${start.getDate()}-${end.getDate()}, ${format(start, 'yyyy')}`;
                    } else if (start.getFullYear() === end.getFullYear()) {
                        periodLabel = `${format(start, 'MMMM d')} - ${format(end, 'MMMM d, yyyy')}`;
                    } else {
                        periodLabel = `${format(start, 'MMMM d, yyyy')} - ${format(end, 'MMMM d, yyyy')}`;
                    }
                }
            } catch {
                periodLabel = `${startDate} to ${endDate}`;
            }
        }

        return (
            <div ref={ref} className="gso-print-doc bg-white p-6 max-w-[1300px] mx-auto text-black print:p-0">
                <style>{`
                    .gso-print-doc {
                        font-family: 'Times New Roman', serif;
                        font-size: 12px;
                        line-height: 1.2;
                    }
                    .iirusp-main-table th {
                        font-weight: normal;
                        border: 1px solid black;
                        padding: 4px 2px;
                        text-align: center;
                        vertical-align: middle;
                        font-size: 10px;
                    }
                    .iirusp-main-table td {
                        border: 1px solid black;
                        padding: 3px 4px;
                        vertical-align: middle;
                        font-size: 11px;
                        height: 24px;
                    }
                    .footer-block {
                        page-break-inside: avoid;
                    }
                    @media print {
                        @page {
                            size: landscape;
                            margin: 0.4in;
                        }
                    }
                `}</style>

                <div className="text-right italic font-bold text-[12px] mb-2">Appendix 74</div>

                <div className="text-center font-bold text-[15px] uppercase tracking-wide">
                    INVENTORY AND INSPECTION REPORT OF UNSERVICEABLE SEMI-EXPENDABLE PROPERTY
                </div>
                <div className="text-center text-[12px] mb-6">
                    As of <span className="px-2">{periodLabel}</span>
                </div>

                <div className="flex justify-between items-end mb-4 text-[12px] px-1">
                    <div className="flex items-end gap-1 w-[35%]">
                        <span className="font-bold whitespace-nowrap">Entity Name:</span>
                        <span className="border-b border-black flex-1 min-h-[18px]"></span>
                    </div>
                    <div className="flex items-end gap-1 w-[25%]">
                        <span className="font-bold whitespace-nowrap">Fund Cluster:</span>
                        <span className="border-b border-black flex-1 min-h-[18px]"></span>
                    </div>
                </div>

                <div className="flex justify-start gap-8 mb-4 text-[11px] px-1 text-center items-end">
                    <div className="w-[30%]">
                        <div className="font-bold pb-0.5 min-h-[20px] flex items-end justify-center underline uppercase">Nilo J. Sabayanon</div>
                        <div className="text-[10px] mt-1">(Name of Accountable Officer)</div>
                    </div>
                    <div className="w-[20%]">
                        <div className="font-bold pb-0.5 min-h-[20px] flex items-end justify-center underline">OIC-GSO</div>
                        <div className="text-[10px] mt-1">(Designation)</div>
                    </div>
                    <div className="w-[25%]">
                        <div className="font-bold pb-0.5 min-h-[20px] flex items-end justify-center underline">General Services Office</div>
                        <div className="text-[10px] mt-1">(Station)</div>
                    </div>
                </div>

                <table className="iirusp-main-table w-full border-collapse border border-black">
                    <thead>
                        <tr>
                            <th colSpan={10} className="uppercase font-bold text-[11px]">INVENTORY</th>
                            <th colSpan={8} className="uppercase font-bold text-[11px]">INSPECTION and DISPOSAL</th>
                        </tr>

                        <tr>
                            <th rowSpan={2} className="w-[6%]">Date Acquired</th>
                            <th rowSpan={2} className="w-[16%]">Particulars/<br />Articles</th>
                            <th rowSpan={2} className="w-[9%]">ICS No.</th>
                            <th rowSpan={2} className="w-[3%]">Qty</th>
                            <th rowSpan={2} className="w-[6%]">Unit<br />Cost</th>
                            <th rowSpan={2} className="w-[7%]">Total<br />Cost</th>
                            <th rowSpan={2} className="w-[6%]">Accumulated<br />Depreciation</th>
                            <th rowSpan={2} className="w-[6%]">Accumulated<br />Impairment Losses</th>
                            <th rowSpan={2} className="w-[6%]">Carrying<br />Amount</th>
                            <th rowSpan={2} className="w-[7%]">Remarks</th>

                            <th colSpan={5} className="py-0.5 font-bold text-[10px]">DISPOSAL</th>
                            <th rowSpan={2} className="w-[5%]">Appraised<br />Value</th>
                            <th colSpan={2} className="py-0.5 font-bold text-[10px]">RECORD OF SALES</th>
                        </tr>
                        <tr>
                            <th className="w-[3.2%] py-0.5 text-[9px]">Sale</th>
                            <th className="w-[3.2%] py-0.5 text-[9px]">Transfer</th>
                            <th className="w-[3.2%] py-0.5 text-[9px]">Destruction</th>
                            <th className="w-[4.5%] py-0.5 text-[9px]">Others<br />(Specify)</th>
                            <th className="w-[3.5%] py-0.5 text-[9px]">Total</th>

                            <th className="w-[5%] py-0.5 text-[9px]">OR No.</th>
                            <th className="w-[6%] py-0.5 text-[9px]">Amount</th>
                        </tr>

                        <tr>
                            {Array.from({ length: 18 }).map((_, idx) => (
                                <th key={idx} className="text-[9px] py-0.5 border border-black">
                                    ({idx + 1})
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row, idx) => {
                            const isPlaceholder = row.id < 0;
                            return (
                                <tr key={row.id ?? idx}>
                                    <td className="text-center whitespace-nowrap">{isPlaceholder ? '' : formatPHDate(row.dateAcquired)}</td>
                                    <td className="break-words max-w-[180px] leading-tight text-left">{isPlaceholder ? '' : (row.particulars || '-')}</td>
                                    <td className="text-center font-mono text-[10px] break-all">{isPlaceholder ? '' : (row.propertyNumber || '-')}</td>
                                    <td className="text-center">{isPlaceholder ? '' : (row.quantity ?? '-')}</td>
                                    <td className="text-right font-mono">{isPlaceholder ? '' : formatCurrency(row.unitCost)}</td>
                                    <td className="text-right font-mono font-medium">{isPlaceholder ? '' : formatCurrency(row.totalCost)}</td>

                                    {Array.from({ length: 12 }).map((_, colIdx) => (
                                        <td key={colIdx} />
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>

                    <tfoot className="footer-block">
                        <tr className="align-top">
                            <td colSpan={10} className="p-3 border border-black h-[240px] text-left text-[10px]">
                                <div className="flex flex-col justify-between h-full">
                                    <div className="leading-relaxed text-[11px]">
                                        I HEREBY request inspection and disposition, pursuant to Section 79 of PD 1445, of the property enumerated above.
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 text-center">
                                        <div className="flex flex-col justify-end h-[115px]">
                                            <span className="block text-left text-[10px] mb-6 pl-1">Requested by:</span>
                                            <div className="border-b border-black mx-20" />
                                            <div className="text-[9px] leading-tight pt-1 min-h-[24px] flex items-start justify-center">
                                                (Signature over Printed Name of Accountable Officer)
                                            </div>
                                            <div className="border-b border-black mx-20 mt-4" />
                                            <div className="text-[9px] leading-tight pt-1">(Designation of Accountable Officer)</div>
                                        </div>

                                        <div className="flex flex-col justify-end h-[115px]">
                                            <span className="block text-left text-[10px] mb-6 pl-1">Approved by:</span>
                                            <div className="border-b border-black mx-20" />
                                            <div className="text-[9px] leading-tight pt-1 min-h-[24px] flex items-start justify-center">
                                                (Signature over Printed Name of Authorized Official)
                                            </div>
                                            <div className="border-b border-black mx-20 mt-4" />
                                            <div className="text-[9px] leading-tight pt-1">(Designation of Authorized Official)</div>
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <td colSpan={8} className="p-3 border border-black h-[240px] text-left text-[10px]">
                                <div className="flex flex-col justify-between h-full">
                                    <div className="flex gap-4 w-full">
                                        <div className="w-[62%] leading-relaxed text-[10.5px] break-words">
                                            I CERTIFY that I have inspected each and every article enumerated in this report, and that the disposition made thereof was, in my judgment, the best for the public interest.
                                        </div>
                                        <div className="w-[38%] leading-relaxed text-[10.5px] break-words">
                                            I CERTIFY that I have witnessed the disposition of the articles enumerated on this report this _____ day of _______________________, ________.
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-[62%_38%] gap-4 text-center">
                                        <div className="flex flex-col justify-end h-[115px]">
                                            <div className="border-b border-black mx-3" />
                                            <div className="text-[9px] leading-tight pt-1 min-h-[24px] flex items-start justify-center break-words">
                                                (Signature over Printed Name of Inspection Officer)
                                            </div>
                                            <div className="border-b border-transparent mx-2 mt-4" />
                                            <div className="text-[9px] leading-tight pt-1 text-transparent select-none">(Spacing Spacer Line)</div>
                                        </div>

                                        <div className="flex flex-col justify-end h-[115px]">
                                            <div className="border-b border-black mx-3" />
                                            <div className="text-[9px] leading-tight pt-1 min-h-[24px] flex items-start justify-center break-words">
                                                (Signature over Printed Name of Witness)
                                            </div>
                                            <div className="border-b border-transparent mx-2 mt-4" />
                                            <div className="text-[9px] leading-tight pt-1 text-transparent select-none">(Spacing Spacer Line)</div>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        );
    }
);

IiruspPrintView.displayName = 'IiruspPrintView';
