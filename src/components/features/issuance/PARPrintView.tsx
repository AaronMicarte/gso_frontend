import React from 'react';
import { AssetIssuance } from '@/types/assetIssuance';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Image from 'next/image';

interface PARPrintViewProps {
    issuance: AssetIssuance;
    printSignature?: string | null;
}

export const PARPrintView = React.forwardRef<HTMLDivElement, PARPrintViewProps>(({ issuance, printSignature }, ref) => {
    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'MM/dd/yyyy');
    };

    const [runtimePrintSignature, setRuntimePrintSignature] = React.useState<string | null>(printSignature || null);

    React.useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { signature?: string | null };
            setRuntimePrintSignature(detail?.signature || null);
        };
        const clearHandler = () => setRuntimePrintSignature(null);
        window.addEventListener('gso:print-par-signature', handler as EventListener);
        window.addEventListener('afterprint', clearHandler);
        return () => {
            window.removeEventListener('gso:print-par-signature', handler as EventListener);
            window.removeEventListener('afterprint', clearHandler);
        };
    }, []);

    const ensureText = (value: unknown, fallback: string) => {
        const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        return text.length > 0 ? text : fallback;
    };

    const details = issuance.details ?? [];

    // Signatures
    const receivedBySignature = runtimePrintSignature || issuance.AcknowledgmentSignature;
    const issuerSignatureUrl = issuance.request?.signatures?.find(s => s.role === 'issuer')?.url || null;

    // Names / departments
    const entityName = 'CITY GOVERNMENT OF EL SALVADOR';
    const fundCluster = 'GENERAL FUND';

    const receivedByName = ensureText(
        issuance.issuedToUser?.FullName || issuance.IssuedToName,
        'PROPERTY RECIPIENT'
    );
    const receivedByOffice = ensureText(
        issuance.issuedToUser?.department?.DepartmentName,
        ensureText(issuance.request?.department?.DepartmentName, 'DEPARTMENT')
    );

    const issuedByName = ensureText(issuance.issuer?.FullName, 'PROPERTY OFFICER');
    const issuedByOffice = ensureText(issuance.issuer?.department?.DepartmentName, 'GENERAL SERVICES OFFICE');

    // Dates
    const docDate = ensureText(formatDate(issuance.IssuanceDate), formatDate(new Date().toISOString()));
    const receivedDate = ensureText(
        issuance.AcknowledgedAt ? formatDate(issuance.AcknowledgedAt) : '',
        docDate
    );

    // Guard: PAR print should never have missing received-by signature because printing is blocked pre-acknowledgment.
    // If it is still missing, show a printable message instead of rendering blank fields.
    const missingCritical = issuance.DocumentType === 'PAR' && !receivedBySignature;

    return (
        <div ref={ref} className="print-container bg-white p-8 max-w-4xl mx-auto text-black">
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

            {missingCritical ? (
                <div className="border border-black p-6">
                    <div className="text-lg font-bold">PAR cannot be printed</div>
                    <div className="text-sm mt-2">
                        Missing recipient acknowledgment signature. Please acknowledge receipt first.
                    </div>
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className="text-center mb-2">
                        <div className="text-sm font-bold">PROPERTY ACKNOWLEDGMENT RECEIPT</div>
                        <div className="text-xs">(PAR)</div>
                    </div>

                    {/* Top Info Row */}
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
                                <div className="whitespace-nowrap">PAR No. :</div>
                                <div className="w-48 border-b border-black pb-0.5 text-right">{ensureText(issuance.DocumentNumber, 'PAR')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="w-full border-collapse border border-black text-[11px]">
                        <thead>
                            <tr>
                                <th className="border border-black px-1 py-1 w-[52px] text-center">Quantity</th>
                                <th className="border border-black px-1 py-1 w-[52px] text-center">Unit</th>
                                <th className="border border-black px-1 py-1 text-center">Description</th>
                                <th className="border border-black px-1 py-1 w-[90px] text-center">Property Number</th>
                                <th className="border border-black px-1 py-1 w-[90px] text-center">Date Acquired</th>
                                <th className="border border-black px-1 py-1 w-[90px] text-center">Unit Cost</th>
                                <th className="border border-black px-1 py-1 w-[95px] text-center">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const rowsNeeded = 20;
                                const rows = details.slice(0, rowsNeeded).map((detail, idx) => {
                                    const inv = detail.inventoryDetail;
                                    const pInv = inv?.propertyInventory as unknown as { ItemDescription?: string; ItemName?: string; Brand?: string | null; ModelNumber?: string | null; SerialNumber?: string | null; DateReceived?: string };

                                    const itemName = ensureText(
                                        pInv?.ItemDescription || pInv?.ItemName || detail.ItemDescription,
                                        'ITEM'
                                    );
                                    const technical = ensureText((inv as any)?.Description, '');
                                    const description = technical ? `${itemName} - ${technical}` : itemName;

                                    const qty = Number(detail.QuantityIssued ?? 1);
                                    const unit = ensureText(inv?.unitOfMeasure?.UnitName || (detail as any)?.Unit, 'unit');
                                    const propertyNumber = ensureText(inv?.PropertyNumber || inv?.InventoryDetailID, ensureText(idx + 1, '1'));

                                    const dateAcquired = ensureText(
                                        (pInv as any)?.DateReceived ? formatDate((pInv as any).DateReceived) : '',
                                        docDate
                                    );

                                    const unitCost = Number(inv?.UnitCost ?? 0);
                                    const total = qty * unitCost;

                                    return (
                                        <tr key={detail.IssuanceDetailID ?? idx}>
                                            <td className="border border-black px-1 py-1 text-center">{qty}</td>
                                            <td className="border border-black px-1 py-1 text-center">{unit}</td>
                                            <td className="border border-black px-1 py-1 align-top whitespace-pre-line">{description}</td>
                                            <td className="border border-black px-1 py-1 text-center">{propertyNumber}</td>
                                            <td className="border border-black px-1 py-1 text-center">{dateAcquired}</td>
                                            <td className="border border-black px-1 py-1 text-right">{unitCost.toFixed(2)}</td>
                                            <td className="border border-black px-1 py-1 text-right">{total.toFixed(2)}</td>
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
                                            <td className="border border-black px-1 py-1">&nbsp;</td>
                                        </tr>
                                    );
                                }

                                return rows;
                            })()}
                        </tbody>
                    </table>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-10 mt-10 text-xs">
                        <div>
                            <div className="mb-8">Received by:</div>
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
                            <div className="text-[10px] text-center mt-1">Signature over Printed Name of End User</div>
                            <div className="border-b border-black mt-4 pb-1 text-center">{receivedByName}</div>
                            <div className="text-[10px] text-center mt-1">Position/Office</div>
                            <div className="border-b border-black mt-2 pb-1 text-center">{receivedByOffice}</div>
                            <div className="text-[10px] text-center mt-1">Date</div>
                            <div className="border-b border-black mt-2 pb-1 text-center">{receivedDate}</div>
                        </div>

                        <div>
                            <div className="mb-8">Issued by:</div>
                            <div className="border-b border-black h-14 flex items-end justify-center">
                                {issuerSignatureUrl && (
                                    <Image
                                        src={issuerSignatureUrl}
                                        alt="Issued by signature"
                                        width={180}
                                        height={60}
                                        unoptimized
                                        className="max-h-12 object-contain"
                                    />
                                )}
                            </div>
                            <div className="text-[10px] text-center mt-1">Signature over Printed Name of Supply and/or Property Custodian</div>
                            <div className="border-b border-black mt-4 pb-1 text-center">{issuedByName}</div>
                            <div className="text-[10px] text-center mt-1">Position/Office</div>
                            <div className="border-b border-black mt-2 pb-1 text-center">{issuedByOffice}</div>
                            <div className="text-[10px] text-center mt-1">Date</div>
                            <div className="border-b border-black mt-2 pb-1 text-center">{docDate}</div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
});

PARPrintView.displayName = 'PARPrintView';