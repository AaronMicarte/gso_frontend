import React from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { RisRecord } from '@/types/ris';

interface RISPrintViewProps {
    ris: RisRecord;
}

const formatPHDate = (dateString?: string | null) => {
    if (!dateString) return '';
    return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'MM/dd/yyyy');
};

const text = (value: unknown, fallback: string) => {
    const t = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    return t.length > 0 ? t : fallback;
};

export const RISPrintView = React.forwardRef<HTMLDivElement, RISPrintViewProps>(({ ris }, ref) => {
    const rowsNeeded = 20;

    const requestedBySig = ris.signatures.requested_by?.url ?? null;
    const approvedBySig = ris.signatures.approved_by?.url ?? null;
    const issuedBySig = ris.signatures.issued_by?.url ?? null;
    const receivedBySig = ris.signatures.received_by?.signature ?? null;

    const requestedByName = text(ris.signatures.requested_by?.user?.FullName, 'REQUESTER');
    const approvedByName = text(ris.signatures.approved_by?.user?.FullName, 'APPROVER');
    const issuedByName = text(ris.signatures.issued_by?.user?.FullName, 'PROPERTY CUSTODIAN');
    const receivedByName = text(ris.signatures.received_by?.issued_to_name ?? ris.request?.requester?.FullName, 'RECEIVER');

    const docDate = text(formatPHDate(ris.request?.RequestDate), formatPHDate(new Date().toISOString()));
    const receivedDate = text(formatPHDate(ris.signatures.received_by?.acknowledged_at ?? null), docDate);

    return (
        <div ref={ref} className="print-container bg-white p-8 max-w-5xl mx-auto text-black">
            <style dangerouslySetInnerHTML={{
                __html: `
                    @media print {
                        .print-container { padding: 0; max-width: none; margin: 0; font-size: 12px; font-family: "Times New Roman", Georgia, serif; color: #000; -webkit-print-color-adjust: exact; }
                        .no-print { display: none !important; }

                        /* Structural print styles only — visual (border) overrides moved to calling page */
                        .ris-table { border-collapse: collapse; }
                        .ris-table th, .ris-table td { padding: 4px 6px; vertical-align: middle; }

                        /* Header visual grouping */
                        .ris-table thead tr.top-group th { border-bottom-width: 1px; }
                        .ris-requisition-label { font-style: italic; font-weight: 600; text-align: center; }

                        /* Center checkmark reliably */
                        .ris-yesno { display: flex !important; align-items: center !important; justify-content: center !important; height: 28px; font-size: 14px; }

                        /* Signature tweaks */
                        .ris-sign-name { text-transform: uppercase; font-weight: 600; }

                        /* Small spacing/padding adjustments to match scanned form */
                        .ris-table td { padding-top: 6px !important; padding-bottom: 6px !important; }
                    }
                    @page { size: A4; margin: 10mm; }
                `,
            }} />

            <div className="text-center mb-2">
                <div className="text-sm font-bold">REQUISITION AND ISSUE SLIP</div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-xs mb-2">
                <div className="space-y-1">
                    <div className="flex items-end gap-2"><div className="whitespace-nowrap">Entity Name :</div><div className="flex-1 border-b border-black pb-0.5">{text(ris.entity_name, 'N/A')}</div></div>
                    <div className="flex items-end gap-2"><div className="whitespace-nowrap">Division :</div><div className="flex-1 border-b border-black pb-0.5">{text(ris.division, 'N/A')}</div></div>
                    <div className="flex items-end gap-2"><div className="whitespace-nowrap">Office :</div><div className="flex-1 border-b border-black pb-0.5">{text(ris.request?.Office ?? ris.request?.office ?? '', '')}</div></div>
                </div>
                <div className="space-y-1">
                    <div className="flex items-end gap-2 justify-end"><div className="whitespace-nowrap">Fund Cluster :</div><div className="w-52 border-b border-black pb-0.5 text-right">{text(ris.fund_cluster, 'N/A')}</div></div>
                    <div className="flex items-end gap-2 justify-end"><div className="whitespace-nowrap">Responsibility Center Code :</div><div className="w-52 border-b border-black pb-0.5 text-right">{text(ris.responsibility_center_code, 'N/A')}</div></div>
                    <div className="flex items-end gap-2 justify-end"><div className="whitespace-nowrap">RIS No. :</div><div className="w-52 border-b border-black pb-0.5 text-right">{text(ris.ris_number, '0000-00-0000')}</div></div>
                </div>
            </div>

            <table className="w-full ris-table text-[11px]">
                <thead>
                    <tr className="top-group">
                        <th className="px-1 py-1 w-[70px] text-center ris-requisition-label" colSpan={4}>Requisition</th>
                        <th className="px-1 py-1 w-[90px] text-center" colSpan={2}>Stock Available?</th>
                        <th className="px-1 py-1 w-[180px] text-center" colSpan={2}>Issue</th>
                    </tr>
                    <tr>
                        <th className="px-1 py-1 w-[70px] text-center">Stock No.</th>
                        <th className="px-1 py-1 w-[55px] text-center">Unit</th>
                        <th className="px-1 py-1 text-center">Description</th>
                        <th className="px-1 py-1 w-[60px] text-center">Quantity</th>
                        <th className="px-1 py-1 w-[45px] text-center">Yes</th>
                        <th className="px-1 py-1 w-[45px] text-center vertical-divider">No</th>
                        <th className="px-1 py-1 w-[60px] text-center">Quantity</th>
                        <th className="px-1 py-1 w-[120px] text-center">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {(() => {
                        const rows = (ris.items ?? []).slice(0, rowsNeeded).map((item) => (
                            <tr key={item.id}>
                                <td className="border border-black px-1 py-1">{text(item.stock_no, 'N/A')}</td>
                                <td className="border border-black px-1 py-1 text-center">{text(item.unit, 'unit')}</td>
                                <td className="border border-black px-1 py-1">{text(item.description, 'N/A')}</td>
                                <td className="border border-black px-1 py-1 text-center">{item.quantity_requested ?? ''}</td>
                                <td className="border border-black px-1 py-1 ris-yesno">{item.stock_available ? '✔' : ''}</td>
                                <td className="border border-black px-1 py-1 ris-yesno">{!item.stock_available ? '✔' : ''}</td>
                                <td className="border border-black border-l-2 px-1 py-1 text-center vertical-divider">{(typeof item.quantity_issued === 'number' ? String(item.quantity_issued) : (item.quantity_issued == null ? '0' : String(item.quantity_issued)))}</td>
                                <td className="border border-black px-1 py-1">{text(item.issue_remarks, '')}</td>
                            </tr>
                        ));

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
                                    <td className="border border-black border-l-2 px-1 py-1">&nbsp;</td>
                                    <td className="border border-black px-1 py-1">&nbsp;</td>
                                </tr>
                            );
                        }

                        return rows;
                    })()}
                </tbody>
            </table>

            <div className="mt-3 text-xs">
                <div className="flex items-start gap-2">
                    <div className="whitespace-nowrap font-medium">Purpose:</div>
                    <div className="flex-1 border-b border-black pb-0.5">{text(ris.purpose, 'N/A')}</div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-10 text-xs">
                {[
                    { label: 'Requested by:', sig: requestedBySig, name: requestedByName, date: docDate, designation: ris.signatures.requested_by?.designation ?? '' },
                    { label: 'Approved by:', sig: approvedBySig, name: approvedByName, date: docDate, designation: ris.signatures.approved_by?.designation ?? '' },
                    { label: 'Issued by:', sig: issuedBySig, name: issuedByName, date: docDate, designation: ris.signatures.issued_by?.designation ?? '' },
                    { label: 'Received by:', sig: receivedBySig, name: receivedByName, date: receivedDate, designation: ris.signatures.received_by?.designation ?? '' },
                ].map((col) => (
                    <div key={col.label}>
                        <div className="mb-8">{col.label}</div>
                        <div className="border-b border-black h-14 flex items-end justify-center">
                            {col.sig && (
                                <Image
                                    src={col.sig}
                                    alt={`${col.label} signature`}
                                    width={180}
                                    height={60}
                                    unoptimized
                                    className="max-h-12 object-contain"
                                />
                            )}
                        </div>
                        <div className="text-[10px] text-center mt-1">Signature</div>
                        <div className="border-b border-black mt-3 pb-1 text-center ris-sign-name">{String(col.name).toUpperCase()}</div>
                        <div className="text-[10px] text-center mt-1">Printed Name</div>
                        <div className="border-b border-black mt-2 pb-1 text-center">{col.designation}</div>
                        <div className="text-[10px] text-center mt-1">Designation</div>
                        <div className="border-b border-black mt-2 pb-1 text-center">{col.date}</div>
                        <div className="text-[10px] text-center mt-1">Date</div>
                    </div>
                ))}
            </div>
        </div>
    );
});

RISPrintView.displayName = 'RISPrintView';
