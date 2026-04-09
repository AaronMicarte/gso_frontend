'use client';

import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { PropertyCardResponse } from '@/lib/api/inventory';

type PropertyCardPrintViewProps = {
    data: PropertyCardResponse;
};

const formatManilaDate = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return format(toZonedTime(parsed, 'Asia/Manila'), 'MM/dd/yyyy');
};

export function PropertyCardPrintView({ data }: PropertyCardPrintViewProps) {
    return (
        <div className="print-container gso-print-doc bg-white p-8 max-w-6xl mx-auto text-black" style={{ fontFamily: 'Times New Roman, serif' }}>
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                        @media print {
                            .print-container {
                                padding: 0;
                                max-width: none;
                                margin: 0;
                                font-size: 12px;
                                line-height: 1.25;
                                font-family: 'Times New Roman', serif;
                            }
                            .no-print { display: none !important; }
                        }
                        @page {
                            size: A4 landscape;
                            margin: 8mm;
                        }
                    `,
                }}
            />

            <div className="text-center text-2xl font-bold mb-2">PROPERTY CARD</div>

            <table className="w-full border-collapse table-fixed text-xs">
                <tbody>
                    <tr>
                        <td colSpan={7} className="border border-black px-2 py-1 text-[13px] font-semibold">
                            Entity Name: <span className="font-normal">{data.header.entity_name || 'Unassigned'}</span>
                        </td>
                        <td colSpan={2} className="border border-black px-2 py-1 text-[13px] font-semibold">
                            Fund Cluster: <span className="font-normal">{data.header.fund_cluster || '\u00A0'}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={7} className="border border-black px-2 py-1 text-[13px] font-semibold">
                            Property, Plant and Equipment: <span className="font-normal">{data.header.property_plant_equipment || '-'}</span>
                        </td>
                        <td colSpan={2} className="border border-black px-2 py-1 text-[13px] font-semibold">
                            Property Number: <span className="font-normal">{data.header.property_number || '-'}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={9} className="border border-black px-2 py-1 text-[13px] font-semibold">
                            Description: <span className="font-normal">{data.header.description || '-'}</span>
                        </td>
                    </tr>
                    <tr>
                        <th className="border border-black px-2 py-1">Date</th>
                        <th className="border border-black px-2 py-1">Reference/PAR No.</th>
                        <th className="border border-black px-2 py-1">Receipt Qty.</th>
                        <th className="border border-black px-2 py-1">Issue/Transfer/Disposal Qty.</th>
                        <th className="border border-black px-2 py-1">Office/Officer</th>
                        <th className="border border-black px-2 py-1">Balance Qty.</th>
                        <th className="border border-black px-2 py-1">Amount</th>
                        <th colSpan={2} className="border border-black px-2 py-1">Remarks</th>
                    </tr>

                    {(data.rows.length > 0 ? data.rows : []).map((row, idx) => (
                        <tr key={`${row.date}-${row.reference}-${idx}`}>
                            <td className="border border-black px-2 py-1 text-center">{formatManilaDate(row.date)}</td>
                            <td className="border border-black px-2 py-1">{row.reference || ''}</td>
                            <td className="border border-black px-2 py-1 text-center">{row.receipt_qty ?? ''}</td>
                            <td className="border border-black px-2 py-1 text-center">{row.issue_qty ?? ''}</td>
                            <td className="border border-black px-2 py-1">{row.office_officer || ''}</td>
                            <td className="border border-black px-2 py-1 text-center">{row.balance_qty}</td>
                            <td className="border border-black px-2 py-1 text-right">
                                {row.amount !== null
                                    ? row.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : ''}
                            </td>
                            <td colSpan={2} className="border border-black px-2 py-1">{row.remarks || ''}</td>
                        </tr>
                    ))}

                    {data.rows.length === 0 && (
                        <tr>
                            <td colSpan={9} className="border border-black px-2 py-2 text-center">No transactions found for this item.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
