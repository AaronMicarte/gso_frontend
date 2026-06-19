import React from 'react';
import { AssetIssuance } from '@/types/assetIssuance';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Image from 'next/image';
import issuanceAPI from '@/lib/api/issuance';
import { compressPropertyNumbers } from '@/lib/utils/propertyNumbers';

interface PARPrintViewProps {
    issuance: AssetIssuance;
    printSignature?: string | null;
}

interface GroupedParRow {
    key: string;
    quantity: number;
    unit: string;
    description: string;
    propertyNumbers: string[];
    dateAcquired: string;
    unitCost: number;
    totalAmount: number;
    maxSequence: number;
}

// small local helper to extract trailing numeric part for ordering
function parseTrailingNumber(value: string): { prefix: string; number: number; width: number } | null {
    const trimmed = String(value ?? '').trim();
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (!match) return null;
    const numberText = match[2];
    return {
        prefix: match[1],
        number: Number(numberText),
        width: numberText.length,
    };
}

// use shared helper `compressPropertyNumbers` for consistent formatting

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
    const issuerSignatureUrl = issuance.IssuerSignature
        || issuance.request?.signatures?.find(s => s.role === 'issuer')?.url
        || null;

    // Names / departments
    const entityName = 'CITY GOVERNMENT OF EL SALVADOR';
    const fundCluster = '';

    const receivedByOffice = ensureText(
        issuance.request?.department?.DepartmentName || issuance.deliveryReceipt?.DepartmentName,
        'DEPARTMENT'
    );
    const receivedByName = ensureText(
        issuance.request?.requester?.FullName || issuance.IssuedToName || issuance.deliveryReceipt?.RequestedBy,
        'END USER'
    );

    const [assignments, setAssignments] = React.useState<Array<{ receiver_name: string; quantity: number }>>([]);

    React.useEffect(() => {
        let mounted = true;
        const id = issuance.IssuanceID ?? issuance.IssuanceID;
        if (!id) return;
        issuanceAPI.getAssignments(id).then((res) => {
            if (!mounted) return;
            const rows = res?.data ?? [];
            setAssignments(rows.map((r: any) => ({ receiver_name: r.receiver_name, quantity: Number(r.quantity) })));
        }).catch(() => {
            // ignore silently - assignments optional
        });
        return () => { mounted = false; };
    }, [issuance.IssuanceID]);

    const issuedByName = ensureText(issuance.issuer?.FullName, 'PROPERTY CUSTODIAN');
    const issuedByOffice = ensureText(issuance.issuer?.department?.DepartmentName, 'GENERAL SERVICES OFFICE');

    // Dates
    const docDate = ensureText(formatDate(issuance.IssuanceDate), formatDate(new Date().toISOString()));
    const receivedDate = ensureText(
        issuance.AcknowledgedAt ? formatDate(issuance.AcknowledgedAt) : '',
        docDate
    );

    const groupedRows = details.reduce<Map<string, GroupedParRow>>((map, detail, index) => {
        const inv = detail.inventoryDetail;
        const pInv = inv?.propertyInventory;

        const itemName = ensureText(
            pInv?.ItemDescription || pInv?.ItemName || detail.ItemDescription,
            'ITEM'
        );
        const technical = ensureText(inv?.Description, '');
        const description = technical ? `${itemName} - ${technical}` : itemName;

        const qty = Math.max(1, Number(detail.QuantityIssued ?? 1));
        const unit = ensureText(inv?.unitOfMeasure?.UnitName || detail.Unit || 'unit', 'unit');

        const propertyNumber = ensureText(
            inv?.PropertyNumber || inv?.InventoryNumber || pInv?.InventoryNumber || inv?.InventoryDetailID,
            `${index + 1}`
        );

        const dateAcquired = ensureText(
            pInv?.DateAcquired ? formatDate(pInv.DateAcquired) : (pInv?.DateReceived ? formatDate(pInv.DateReceived) : ''),
            docDate
        );

        const unitCost = Number(inv?.UnitCost ?? 0);
        const key = [description, unit, dateAcquired, unitCost.toFixed(2)].join('|');

        if (!map.has(key)) {
            map.set(key, {
                key,
                quantity: 0,
                unit,
                description,
                propertyNumbers: [],
                dateAcquired,
                unitCost,
                totalAmount: 0,
                maxSequence: -1,
            });
        }

        const row = map.get(key)!;
        row.quantity += qty;
        row.totalAmount += qty * unitCost;
        row.propertyNumbers.push(propertyNumber);

        const trailing = parseTrailingNumber(propertyNumber);
        if (trailing) {
            row.maxSequence = Math.max(row.maxSequence, trailing.number);
        }

        return map;
    }, new Map());

    const rows = Array.from(groupedRows.values()).sort((a, b) => {
        if (a.maxSequence !== b.maxSequence) {
            return b.maxSequence - a.maxSequence;
        }
        return a.description.localeCompare(b.description);
    });

    const minimumRows = 10;
    const blankRowCount = rows.length > 0 && rows.length < minimumRows
        ? minimumRows - rows.length
        : 0;

    return (
        <div ref={ref} className="gso-print-doc bg-white p-8 max-w-4xl mx-auto text-black">

            <>
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
                        {rows.map((row) => (
                            <tr key={row.key}>
                                <td className="border border-black px-1 py-1 text-center align-top">{row.quantity}</td>
                                <td className="border border-black px-1 py-1 text-center align-top">{row.unit}</td>
                                <td className="border border-black px-1 py-1 align-top whitespace-normal break-words">{row.description}</td>
                                <td className="border border-black px-1 py-1 text-center align-top">{compressPropertyNumbers(row.propertyNumbers.join('/'))}</td>
                                <td className="border border-black px-1 py-1 text-center align-top">{row.dateAcquired}</td>
                                <td className="border border-black px-1 py-1 text-right align-top">{row.unitCost.toFixed(2)}</td>
                                <td className="border border-black px-1 py-1 text-right align-top">{row.totalAmount.toFixed(2)}</td>
                            </tr>
                        ))}

                        {Array.from({ length: blankRowCount }).map((_, blankIndex) => (
                            <tr key={`blank-row-${blankIndex}`}>
                                <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                                <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                            </tr>
                        ))}

                        {rows.length === 0 && (
                            <tr>
                                <td className="border border-black px-1 py-1 text-center" colSpan={7}>No issued items</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div className="par-signature-block grid grid-cols-2 mt-0 text-xs border border-black border-t-0">
                    <div className="p-3 border-r border-black flex flex-col">
                        <div className="h-5 mb-3">Received by:</div>
                        <div className="border-b border-black h-14 flex flex-col items-start justify-center px-2 gap-1">
                            {assignments.length > 0 ? (
                                <div className="w-full">
                                    {assignments.map((a, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-xs">
                                            <div className="font-medium">{a.receiver_name}</div>
                                            <div className="text-slate-600">Qty: {a.quantity}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="w-full text-center">{receivedBySignature ? (
                                    <Image
                                        src={receivedBySignature}
                                        alt="Received by signature"
                                        width={180}
                                        height={60}
                                        unoptimized
                                        className="max-h-12 object-contain"
                                    />
                                ) : (
                                    <span className="pb-0.5 text-center">{receivedByName}</span>
                                )}</div>
                            )}
                        </div>
                        <div className="text-[10px] leading-tight text-center mt-0.5 px-2">
                            Signature over Printed Name of Receiver
                        </div>
                        <div className="border-b border-black mt-1 h-6 flex items-end justify-center pb-0.5 text-center">{receivedByOffice}</div>
                        <div className="text-[10px] leading-tight text-center mt-1 h-4">Position/Office</div>
                        <div className="border-b border-black mt-1 h-6 flex items-end justify-center pb-0.5 text-center">{receivedDate}</div>
                        <div className="text-[10px] leading-tight text-center mt-1 h-4">Date</div>
                    </div>

                    <div className="p-3 flex flex-col">
                        <div className="h-5 mb-3">Issued by:</div>
                        <div className="border-b border-black h-14 flex items-end justify-center px-2">
                            {issuerSignatureUrl ? (
                                <Image
                                    src={issuerSignatureUrl}
                                    alt="Issued by signature"
                                    width={180}
                                    height={60}
                                    unoptimized
                                    className="max-h-12 object-contain"
                                />
                            ) : (
                                <span className="pb-0.5 text-center">{issuedByName}</span>
                            )}
                        </div>
                        <div className="text-[10px] leading-tight text-center mt-0.5 px-2">
                            Signature over Printed Name of Supply and/or Property Custodian
                        </div>
                        <div className="border-b border-black mt-1 h-6 flex items-end justify-center pb-0.5 text-center">{issuedByOffice}</div>
                        <div className="text-[10px] leading-tight text-center mt-1 h-4">Position/Office</div>
                        <div className="border-b border-black mt-1 h-6 flex items-end justify-center pb-0.5 text-center">{docDate}</div>
                        <div className="text-[10px] leading-tight text-center mt-1 h-4">Date</div>
                    </div>
                </div>
            </>
        </div>
    );
});

PARPrintView.displayName = 'PARPrintView';