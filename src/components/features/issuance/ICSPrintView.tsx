import React from 'react';
import { AssetIssuance } from '@/types/assetIssuance';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Image from 'next/image';

interface ICSPrintViewProps {
    issuance: AssetIssuance;
    printSignature?: string | null;
}

export const ICSPrintView = React.forwardRef<HTMLDivElement, ICSPrintViewProps>(({ issuance, printSignature }, ref) => {
    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'MM/dd/yyyy');
    };

    const ensureText = (value: unknown, fallback: string) => {
        const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        return text.length > 0 ? text : fallback;
    };

    const [runtimePrintSignature, setRuntimePrintSignature] = React.useState<string | null>(printSignature || null);

    React.useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { signature?: string | null };
            setRuntimePrintSignature(detail?.signature || null);
        };
        const clearHandler = () => setRuntimePrintSignature(null);
        window.addEventListener('gso:print-ics-signature', handler as EventListener);
        window.addEventListener('afterprint', clearHandler);
        return () => {
            window.removeEventListener('gso:print-ics-signature', handler as EventListener);
            window.removeEventListener('afterprint', clearHandler);
        };
    }, []);

    const receivedBySignature = runtimePrintSignature || issuance.AcknowledgmentSignature || issuance.signature_url;
    const issuerSignatureUrl = issuance.IssuerSignature
        || issuance.request?.signatures?.find(s => s.role === 'issuer')?.url
        || null;

    const details = issuance.details ?? [];
    const rowsPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(details.length / rowsPerPage));

    const entityName = 'CITY GOVERNMENT OF EL SALVADOR';
    const fundCluster = 'GENERAL FUND';
    const icsNumber = ensureText(issuance.DocumentNumber, 'ICS');

    const receivedFromName = ensureText(issuance.issuer?.FullName, 'PROPERTY OFFICER');
    const receivedFromOffice = ensureText(issuance.issuer?.department?.DepartmentName, 'GENERAL SERVICES OFFICE');

    const receivedByName = ensureText(
        issuance.request?.requester?.FullName || issuance.IssuedToName || issuance.deliveryReceipt?.RequestedBy,
        'REQUESTER'
    );
    const receivedByOffice = ensureText(
        issuance.request?.department?.DepartmentName || issuance.deliveryReceipt?.DepartmentName,
        'DEPARTMENT'
    );

    const docDate = ensureText(formatDate(issuance.IssuanceDate), formatDate(new Date().toISOString()));
    const receivedDate = ensureText(
        issuance.AcknowledgedAt ? formatDate(issuance.AcknowledgedAt) : '',
        docDate
    );

    const missingSignature = !receivedBySignature;

    return (
        <div ref={ref} className="print-container gso-print-doc bg-white p-8 max-w-4xl mx-auto text-black">
            {/* Print-specific styles */}
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
                        .print-page-break {
                            page-break-after: always;
                        }
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                `
            }} />

            <>
                {missingSignature && (
                    <div className="no-print mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Recipient signature is not captured yet. Print for delivery and signing.
                    </div>
                )}

                {Array.from({ length: totalPages }).map((_, pageIndex) => {
                    const pageStart = pageIndex * rowsPerPage;
                    const pageDetails = details.slice(pageStart, pageStart + rowsPerPage);
                    const isLastPage = pageIndex === totalPages - 1;

                    return (
                        <div key={`ics-page-${pageIndex}`} className={isLastPage ? '' : 'print-page-break'}>
                            {/* Header */}
                            <div className="gso-print-title">Inventory Custodian Slip</div>

                            {/* Top Info */}
                            <div className="grid grid-cols-2 gap-6 text-xs mb-2">
                                <div className="space-y-2">
                                    <div className="flex items-end gap-2">
                                        <div className="whitespace-nowrap">Entity Name:</div>
                                        <div className="flex-1 border-b border-black pb-0.5">{entityName}</div>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="whitespace-nowrap">Fund Cluster :</div>
                                        <div className="flex-1 border-b border-black pb-0.5">{fundCluster}</div>
                                    </div>
                                </div>
                                <div className="flex items-start justify-end">
                                    <div className="flex items-end gap-2">
                                        <div className="whitespace-nowrap">ICS No :</div>
                                        <div className="w-48 border-b border-black pb-0.5 text-right">{icsNumber}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <table className="w-full border-collapse border border-black text-[11px]">
                                <thead>
                                    <tr>
                                        <th rowSpan={2} className="border border-black px-1 py-1 w-[52px] text-center align-middle">Quantity</th>
                                        <th rowSpan={2} className="border border-black px-1 py-1 w-[52px] text-center align-middle">Unit</th>
                                        <th colSpan={2} className="border border-black px-1 py-1 text-center align-middle">Amount</th>
                                        <th rowSpan={2} className="border border-black px-1 py-1 text-center align-middle">Description</th>
                                        <th rowSpan={2} className="border border-black px-1 py-1 w-[95px] text-center align-middle">Inventory Item No.</th>
                                        <th rowSpan={2} className="border border-black px-1 py-1 w-[95px] text-center align-middle">Date of Acquisition</th>
                                        <th rowSpan={2} className="border border-black px-1 py-1 w-[90px] text-center align-middle">Estimated Useful Life</th>
                                    </tr>
                                    <tr>
                                        <th className="border border-black px-1 py-1 w-[85px] text-center">Unit Cost</th>
                                        <th className="border border-black px-1 py-1 w-[90px] text-center">Total Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const rows = pageDetails.map((detail, idx) => {
                                            const inv = detail.inventoryDetail;
                                            const pInv = inv?.propertyInventory;

                                            const qty = Number(detail.QuantityIssued ?? 1);
                                            const unit = ensureText(inv?.unitOfMeasure?.UnitName || (detail.Unit ?? ''), 'unit');

                                            const itemName = ensureText(
                                                pInv?.ItemDescription || pInv?.ItemName || detail.ItemDescription,
                                                'ITEM'
                                            );
                                            const brandModel = [pInv?.Brand, pInv?.ModelNumber].filter(Boolean).join(' ');
                                            const serial = ensureText(pInv?.SerialNumber, '');
                                            const description = [itemName, brandModel, serial ? `SN: ${serial}` : ''].filter(Boolean).join(' / ');

                                            const inventoryItemNo = ensureText(
                                                pInv?.InventoryNumber || inv?.InventoryNumber || inv?.PropertyNumber || inv?.InventoryDetailID,
                                                ensureText(pageStart + idx + 1, '1')
                                            );

                                            const dateAcquired = ensureText(
                                                pInv?.DateAcquired ? formatDate(pInv.DateAcquired) : (pInv?.DateReceived ? formatDate(pInv.DateReceived) : ''),
                                                docDate
                                            );

                                            const estimatedUsefulLife = ensureText(
                                                inv?.EstimatedUsefulLife || pInv?.EstimatedUsefulLife,
                                                '1 year'
                                            );

                                            const unitCost = Number(inv?.UnitCost ?? 0);
                                            const totalCost = qty * unitCost;

                                            return (
                                                <tr key={detail.IssuanceDetailID ?? `${pageIndex}-${idx}`}>
                                                    <td className="border border-black px-1 py-1 text-center">{qty}</td>
                                                    <td className="border border-black px-1 py-1 text-center">{unit}</td>
                                                    <td className="border border-black px-1 py-1 text-right">{unitCost.toFixed(2)}</td>
                                                    <td className="border border-black px-1 py-1 text-right">{totalCost.toFixed(2)}</td>
                                                    <td className="border border-black px-1 py-1 align-top whitespace-pre-line">{description}</td>
                                                    <td className="border border-black px-1 py-1 text-center">{inventoryItemNo}</td>
                                                    <td className="border border-black px-1 py-1 text-center">{dateAcquired}</td>
                                                    <td className="border border-black px-1 py-1 text-center">{estimatedUsefulLife}</td>
                                                </tr>
                                            );
                                        });

                                        const blanks = Math.max(0, rowsPerPage - rows.length);
                                        for (let i = 0; i < blanks; i++) {
                                            rows.push(
                                                <tr key={`blank-${pageIndex}-${i}`}>
                                                    <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                                    <td className="border border-black px-1 py-1">&nbsp;</td>
                                                    <td className="border border-black px-1 py-1">&nbsp;</td>
                                                    <td className="border border-black px-1 py-1">&nbsp;</td>
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

                            {isLastPage && (
                                <div
                                    className="grid mt-0 text-xs border border-black border-t-0"
                                    style={{ gridTemplateColumns: '52px 52px 85px 90px minmax(0, 1fr) 95px 95px 90px' }}
                                >
                                    <div className="col-span-5 p-3 border-r border-black">
                                        <div className="mb-6">Received from:</div>
                                        <div className="border-b border-black h-14 flex items-end justify-center">
                                            {issuerSignatureUrl && (
                                                <Image
                                                    src={issuerSignatureUrl}
                                                    alt="Received from signature"
                                                    width={180}
                                                    height={60}
                                                    unoptimized
                                                    className="max-h-12 object-contain"
                                                />
                                            )}
                                        </div>
                                        <div className="text-[10px] text-center mt-0.5">Signature Over Printed Name of End User</div>
                                        <div className="border-b border-black mt-4 pb-1 text-center">{receivedFromName}</div>
                                        <div className="text-[10px] text-center mt-1">Position/Office</div>
                                        <div className="border-b border-black mt-2 pb-1 text-center">{receivedFromOffice}</div>
                                        <div className="text-[10px] text-center mt-1">Date</div>
                                        <div className="border-b border-black mt-2 pb-1 text-center">{docDate}</div>
                                    </div>

                                    <div className="col-span-3 p-3">
                                        <div className="mb-6">Received by:</div>
                                        <div className="border-b border-black h-14 flex items-end justify-center">
                                            {receivedBySignature && (
                                                <Image
                                                    src={receivedBySignature}
                                                    alt="Received by signature"
                                                    width={180}
                                                    height={60}
                                                    unoptimized
                                                    className="max-h-12 object-contain"
                                                />
                                            )}
                                        </div>
                                        <div className="text-[10px] text-center mt-0.5">Signature Over Printed Name</div>
                                        <div className="border-b border-black mt-4 pb-1 text-center">{receivedByName}</div>
                                        <div className="text-[10px] text-center mt-1">Position/Office</div>
                                        <div className="border-b border-black mt-2 pb-1 text-center">{receivedByOffice}</div>
                                        <div className="text-[10px] text-center mt-1">Date</div>
                                        <div className="border-b border-black mt-2 pb-1 text-center">{receivedDate}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        </div>
    );
});

ICSPrintView.displayName = 'ICSPrintView';