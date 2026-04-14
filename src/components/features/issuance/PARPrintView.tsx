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
    const rowsPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(details.length / rowsPerPage));

    // Signatures
    const receivedBySignature = runtimePrintSignature || issuance.AcknowledgmentSignature;
    const issuerSignatureUrl = issuance.IssuerSignature
        || issuance.request?.signatures?.find(s => s.role === 'issuer')?.url
        || null;

    // Names / departments
    const entityName = 'CITY GOVERNMENT OF EL SALVADOR';
    const fundCluster = 'GENERAL FUND';

    const receivedByOffice = ensureText(
        issuance.request?.department?.DepartmentName || issuance.deliveryReceipt?.DepartmentName,
        'DEPARTMENT'
    );

    const issuedByOffice = ensureText(issuance.issuer?.department?.DepartmentName, 'GENERAL SERVICES OFFICE');

    // Dates
    const docDate = ensureText(formatDate(issuance.IssuanceDate), formatDate(new Date().toISOString()));
    const receivedDate = ensureText(
        issuance.AcknowledgedAt ? formatDate(issuance.AcknowledgedAt) : '',
        docDate
    );

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
                {Array.from({ length: totalPages }).map((_, pageIndex) => {
                    const pageStart = pageIndex * rowsPerPage;
                    const pageDetails = details.slice(pageStart, pageStart + rowsPerPage);
                    const isLastPage = pageIndex === totalPages - 1;

                    return (
                        <div key={`par-page-${pageIndex}`} className={isLastPage ? '' : 'print-page-break'}>
                            {/* Header */}
                            <div className="gso-print-title">Property Acknowledgment Receipt</div>

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
                            <table className="w-full table-fixed border-collapse border border-black text-[11px]">
                                <colgroup>
                                    <col style={{ width: '52px' }} />
                                    <col style={{ width: '52px' }} />
                                    <col />
                                    <col style={{ width: '90px' }} />
                                    <col style={{ width: '90px' }} />
                                    <col style={{ width: '90px' }} />
                                    <col style={{ width: '95px' }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th className="border border-black px-1 py-1 text-center">Quantity</th>
                                        <th className="border border-black px-1 py-1 text-center">Unit</th>
                                        <th className="border border-black px-1 py-1 text-center">Description</th>
                                        <th className="border border-black px-1 py-1 text-center">Property Number</th>
                                        <th className="border border-black px-1 py-1 text-center">Date Acquired</th>
                                        <th className="border border-black px-1 py-1 text-center">Unit Cost</th>
                                        <th className="border border-black px-1 py-1 text-center">Total Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const rows = pageDetails.map((detail, idx) => {
                                            const inv = detail.inventoryDetail;
                                            const pInv = inv?.propertyInventory;

                                            const itemName = ensureText(
                                                pInv?.ItemDescription || pInv?.ItemName || detail.ItemDescription,
                                                'ITEM'
                                            );
                                            const technical = ensureText(inv?.Description, '');
                                            const description = technical ? `${itemName} - ${technical}` : itemName;

                                            const qty = Number(detail.QuantityIssued ?? 1);
                                            const unit = ensureText(inv?.unitOfMeasure?.UnitName || (detail.Unit ?? ''), 'unit');
                                            const propertyNumber = ensureText(inv?.PropertyNumber || inv?.InventoryDetailID, ensureText(pageStart + idx + 1, '1'));

                                            const dateAcquired = ensureText(
                                                pInv?.DateAcquired ? formatDate(pInv.DateAcquired) : (pInv?.DateReceived ? formatDate(pInv.DateReceived) : ''),
                                                docDate
                                            );

                                            const unitCost = Number(inv?.UnitCost ?? 0);
                                            const total = qty * unitCost;

                                            return (
                                                <tr key={detail.IssuanceDetailID ?? `${pageIndex}-${idx}`}>
                                                    <td className="border border-black px-1 py-1 text-center align-top">{qty}</td>
                                                    <td className="border border-black px-1 py-1 text-center align-top">{unit}</td>
                                                    <td className="border border-black px-1 py-1 align-top whitespace-normal break-words">{description}</td>
                                                    <td className="border border-black px-1 py-1 text-center align-top">{propertyNumber}</td>
                                                    <td className="border border-black px-1 py-1 text-center align-top">{dateAcquired}</td>
                                                    <td className="border border-black px-1 py-1 text-right align-top">{unitCost.toFixed(2)}</td>
                                                    <td className="border border-black px-1 py-1 text-right align-top">{total.toFixed(2)}</td>
                                                </tr>
                                            );
                                        });

                                        const blanks = Math.max(0, rowsPerPage - rows.length);
                                        for (let i = 0; i < blanks; i++) {
                                            rows.push(
                                                <tr key={`blank-${pageIndex}-${i}`}>
                                                    <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                                    <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                                    <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                                    <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                                    <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                                    <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                                    <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
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
                                    style={{ gridTemplateColumns: '52px 52px minmax(0, 1fr) 90px 90px 90px 95px' }}
                                >
                                    <div className="col-span-3 p-3 border-r border-black flex flex-col">
                                        <div className="h-5 mb-3">Received by:</div>
                                        <div className="border-b border-black h-14 flex items-end justify-center px-2">
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
                                        <div className="text-[10px] leading-tight text-center mt-0.5 px-2">
                                            Signature over Printed Name of End User
                                        </div>
                                        <div className="border-b border-black mt-4 h-6 flex items-end justify-center pb-0.5 text-center">{receivedByOffice}</div>
                                        <div className="text-[10px] leading-tight text-center mt-1 h-4">Position/Office</div>
                                        <div className="border-b border-black mt-1 h-6 flex items-end justify-center pb-0.5 text-center">&nbsp;</div>
                                        <div className="text-[10px] leading-tight text-center mt-1 h-4">Date</div>
                                    </div>

                                    <div className="col-span-4 p-3 flex flex-col">
                                        <div className="h-5 mb-3">Issued by:</div>
                                        <div className="border-b border-black h-14 flex items-end justify-center px-2">
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
                                        <div className="text-[10px] leading-tight text-center mt-0.5 px-2">
                                            Signature over Printed Name of Supply and/or Property Custodian
                                        </div>
                                        <div className="border-b border-black mt-4 h-6 flex items-end justify-center pb-0.5 text-center">{issuedByOffice}</div>
                                        <div className="text-[10px] leading-tight text-center mt-1 h-4">Position/Office</div>
                                        <div className="border-b border-black mt-1 h-6 flex items-end justify-center pb-0.5 text-center">&nbsp;</div>
                                        <div className="text-[10px] leading-tight text-center mt-1 h-4">Date</div>
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

PARPrintView.displayName = 'PARPrintView';