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

const asImageSrc = (value: string | null | undefined) => {
    const v = (value ?? '').trim();
    if (!v) return null;
    if (v.startsWith('data:image/')) return v;
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/')) return v;
    // Likely raw base64 (backend acknowledgment signature)
    return `data:image/png;base64,${v}`;
};

export const RISPrintView = React.forwardRef<HTMLDivElement, RISPrintViewProps>(({ ris }, ref) => {
    const rowsNeeded = 20;

    const req = ris.request ?? ris.asset_request ?? null;

    const requestedBySig = asImageSrc(ris.signatures.requested_by?.url ?? null);
    const approvedBySig = asImageSrc(ris.signatures.approved_by?.url ?? null);
    const issuedBySig = asImageSrc(ris.signatures.issued_by?.url ?? null);
    const receivedBySig = asImageSrc(ris.signatures.received_by?.signature ?? null);

    const requestedByName = text(ris.signatures.requested_by?.user?.FullName, 'REQUESTER');
    const approvedByName = text(ris.signatures.approved_by?.user?.FullName, 'APPROVER');
    const issuedByName = text(ris.signatures.issued_by?.user?.FullName, 'PROPERTY CUSTODIAN');
    const receivedByName = text(ris.signatures.received_by?.issued_to_name ?? req?.requester?.FullName, 'RECEIVER');

    const docDate = text(formatPHDate(req?.RequestDate), formatPHDate(new Date().toISOString()));
    const receivedDate = text(formatPHDate(ris.signatures.received_by?.acknowledged_at ?? null), docDate);

    const officeText = text(req?.Office ?? req?.office ?? req?.department?.DepartmentName ?? '', '');

    return (
        <div ref={ref} className="print-container bg-white p-8 max-w-5xl mx-auto text-black">
            <style dangerouslySetInnerHTML={{
                __html: `
                    /* Base styles (screen + print) */
                    .ris-table, .ris-sign-table { width: 100%; border-collapse: collapse; }
                    .ris-table th, .ris-table td, .ris-sign-table th, .ris-sign-table td { border: 1px solid #000; }
                    .ris-table th { font-weight: 700; }
                    .ris-requisition-label { font-style: italic; font-weight: 600; text-align: center; }
                    .ris-yesno { text-align: center; }
                    .ris-sign-name { text-transform: uppercase; font-weight: 600; }
                    .ris-sign-img { height: 44px; display: flex; align-items: flex-end; justify-content: center; }
                    .ris-label-col { width: 90px; font-weight: 600; }

                    @media print {
                        .print-container { padding: 0; max-width: none; margin: 0; font-size: 12px; font-family: "Times New Roman", Georgia, serif; color: #000; -webkit-print-color-adjust: exact; }
                        .no-print { display: none !important; }

                        .ris-table th, .ris-table td, .ris-sign-table th, .ris-sign-table td { padding: 6px 6px; vertical-align: middle; }
                        .ris-yesno { font-size: 14px; }
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
                    <div className="flex items-end gap-2"><div className="whitespace-nowrap">Office :</div><div className="flex-1 border-b border-black pb-0.5">{officeText}</div></div>
                </div>
                <div className="space-y-1">
                    <div className="flex items-end gap-2 justify-end"><div className="whitespace-nowrap">Fund Cluster :</div><div className="w-52 border-b border-black pb-0.5 text-right">{text(ris.fund_cluster, 'N/A')}</div></div>
                    <div className="flex items-end gap-2 justify-end"><div className="whitespace-nowrap">Responsibility Center Code :</div><div className="w-52 border-b border-black pb-0.5 text-right">{text(ris.responsibility_center_code, 'N/A')}</div></div>
                    <div className="flex items-end gap-2 justify-end"><div className="whitespace-nowrap">RIS No. :</div><div className="w-52 border-b border-black pb-0.5 text-right">{text(ris.ris_number, '0000-00-0000')}</div></div>
                </div>
            </div>

            <table className="w-full ris-table text-[11px]">
                <colgroup>
                    <col style={{ width: 80 }} />
                    <col style={{ width: 60 }} />
                    <col />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 50 }} />
                    <col style={{ width: 50 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 140 }} />
                </colgroup>
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
                        <th className="px-1 py-1 w-[45px] text-center">No</th>
                        <th className="px-1 py-1 w-[60px] text-center">Quantity</th>
                        <th className="px-1 py-1 w-[120px] text-center">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {(() => {
                        const rows = (ris.items ?? []).slice(0, rowsNeeded).map((item) => (
                            <tr key={item.id}>
                                <td className="px-1 py-1">{text(item.stock_no, '')}</td>
                                <td className="px-1 py-1 text-center">{text(item.unit, '')}</td>
                                <td className="px-1 py-1">{text(item.description, '')}</td>
                                <td className="px-1 py-1 text-center">{item.quantity_requested ?? ''}</td>
                                <td className="px-1 py-1 ris-yesno">{item.stock_available ? '✔' : ''}</td>
                                <td className="px-1 py-1 ris-yesno">{!item.stock_available ? '✔' : ''}</td>
                                <td className="px-1 py-1 text-center">{(typeof item.quantity_issued === 'number' ? String(item.quantity_issued) : (item.quantity_issued == null ? '0' : String(item.quantity_issued)))}</td>
                                <td className="px-1 py-1">{text(item.issue_remarks, '')}</td>
                            </tr>
                        ));

                        const blanks = Math.max(0, rowsNeeded - rows.length);
                        for (let i = 0; i < blanks; i++) {
                            rows.push(
                                <tr key={`blank-${i}`}>
                                    <td className="px-1 py-1 h-6">&nbsp;</td>
                                    <td className="px-1 py-1">&nbsp;</td>
                                    <td className="px-1 py-1">&nbsp;</td>
                                    <td className="px-1 py-1">&nbsp;</td>
                                    <td className="px-1 py-1">&nbsp;</td>
                                    <td className="px-1 py-1">&nbsp;</td>
                                    <td className="px-1 py-1">&nbsp;</td>
                                    <td className="px-1 py-1">&nbsp;</td>
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

            <table className="ris-sign-table text-xs mt-8">
                <thead>
                    <tr>
                        <th className="ris-label-col">&nbsp;</th>
                        <th className="text-center">Requested by:</th>
                        <th className="text-center">Approved by:</th>
                        <th className="text-center">Issued by:</th>
                        <th className="text-center">Received by:</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="px-2 py-2 font-medium">Signature :</td>
                        {[requestedBySig, approvedBySig, issuedBySig, receivedBySig].map((sig, idx) => (
                            <td key={idx} className="px-2 py-2">
                                <div className="ris-sign-img">
                                    {sig && (
                                        <Image
                                            src={sig}
                                            alt="signature"
                                            width={180}
                                            height={60}
                                            unoptimized
                                            className="max-h-10 object-contain"
                                        />
                                    )}
                                </div>
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td className="px-2 py-2 font-medium">Printed Name :</td>
                        <td className="px-2 py-2 text-center ris-sign-name">{String(requestedByName).toUpperCase()}</td>
                        <td className="px-2 py-2 text-center ris-sign-name">{String(approvedByName).toUpperCase()}</td>
                        <td className="px-2 py-2 text-center ris-sign-name">{String(issuedByName).toUpperCase()}</td>
                        <td className="px-2 py-2 text-center ris-sign-name">{String(receivedByName).toUpperCase()}</td>
                    </tr>
                    <tr>
                        <td className="px-2 py-2 font-medium">Designation :</td>
                        <td className="px-2 py-2 text-center">{ris.signatures.requested_by?.designation ?? ''}</td>
                        <td className="px-2 py-2 text-center">{ris.signatures.approved_by?.designation ?? ''}</td>
                        <td className="px-2 py-2 text-center">{ris.signatures.issued_by?.designation ?? ''}</td>
                        <td className="px-2 py-2 text-center">{ris.signatures.received_by?.designation ?? ''}</td>
                    </tr>
                    <tr>
                        <td className="px-2 py-2 font-medium">Date :</td>
                        <td className="px-2 py-2 text-center">{docDate}</td>
                        <td className="px-2 py-2 text-center">{docDate}</td>
                        <td className="px-2 py-2 text-center">{docDate}</td>
                        <td className="px-2 py-2 text-center">{receivedDate}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
});

RISPrintView.displayName = 'RISPrintView';
