import React from 'react';
import { AssetIssuance, IssuanceDetail } from '@/types/assetIssuance';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Image from 'next/image';
import { compressPropertyNumbers } from '@/lib/utils/propertyNumbers';
import issuanceAPI from '@/lib/api/issuance';

interface ICSPrintViewProps {
    issuance: AssetIssuance;
    printSignature?: string | null;
    selectedDetailIds?: number[];
}

interface GroupedIcsRow {
    key: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
    description: string;
    inventoryNumbers: string[];
    dateAcquired: string;
    estimatedUsefulLife: string;
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

export const ICSPrintView = React.forwardRef<HTMLDivElement, ICSPrintViewProps>(({ issuance, printSignature, selectedDetailIds }, ref) => {
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
        || issuance.request?.signatures?.find((s) => s.role === 'issuer')?.url
        || null;

    const allDetails = issuance.details ?? [];
    const details = selectedDetailIds?.length
        ? allDetails.filter((detail) => selectedDetailIds.includes(detail.IssuanceDetailID))
        : allDetails;

    const entityName = 'CITY GOVERNMENT OF EL SALVADOR';
    const fundCluster = '';
    const icsNumber = ensureText(issuance.DocumentNumber, 'ICS');

    const receivedFromName = ensureText(issuance.issuer?.FullName, 'PROPERTY OFFICER');
    const receivedFromOffice = ensureText(issuance.issuer?.department?.DepartmentName, 'GENERAL SERVICES OFFICE');

    const receivedByName = ensureText(
        issuance.IssuedToName || issuance.deliveryReceipt?.RequestedBy,
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

    const [assignments, setAssignments] = React.useState<Array<{ receiver_name: string }>>([]);

    React.useEffect(() => {
        let mounted = true;
        const id = issuance.IssuanceID ?? issuance.IssuanceID;
        if (!id) return;
        issuanceAPI.getAssignments(id).then((res) => {
            if (!mounted) return;
            const rows = res?.data ?? [];
            const mapped: Array<{ receiver_name: string }> = rows
                .filter((row: { issuance_detail_id?: number }) => {
                    if (!selectedDetailIds?.length) return true;
                    return selectedDetailIds.includes(Number(row.issuance_detail_id));
                })
                .map((row: { receiver_name?: string }) => ({
                    receiver_name: String(row.receiver_name || '').trim(),
                }))
                .filter((row: { receiver_name: string }) => row.receiver_name.length > 0);

            const uniqueReceivers = [...new Set(mapped.map((row) => row.receiver_name))];
            setAssignments(uniqueReceivers.map((receiver_name) => ({ receiver_name })));
        }).catch(() => {
            // ignore
        });
        return () => { mounted = false; };
    }, [issuance.IssuanceID, selectedDetailIds]);

    const groupedRows = details.reduce<Map<string, GroupedIcsRow>>((map: Map<string, GroupedIcsRow>, detail: IssuanceDetail, index: number) => {
        const inv = detail.inventoryDetail;
        const pInv = inv?.propertyInventory;

        const qty = Math.max(1, Number(detail.QuantityIssued ?? 1));
        const unit = ensureText(inv?.unitOfMeasure?.UnitName || detail.Unit || 'unit', 'unit');

        const itemName = ensureText(
            pInv?.ItemDescription || pInv?.ItemName || detail.ItemDescription,
            'ITEM'
        );
        const brandModel = [pInv?.Brand, pInv?.ModelNumber].filter(Boolean).join(' ');
        // exclude serial from description so items with different serials group together
        // separate item name, brand and model using comma instead of slash
        const description = [itemName, brandModel].filter(Boolean).join(', ');

        const inventoryItemNo = ensureText(
            pInv?.InventoryNumber || inv?.InventoryNumber || inv?.PropertyNumber || inv?.InventoryDetailID,
            `${index + 1}`
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
        const key = [description, unit, dateAcquired, estimatedUsefulLife, unitCost.toFixed(2)].join('|');

        if (!map.has(key)) {
            map.set(key, {
                key,
                quantity: 0,
                unit,
                unitCost,
                totalCost: 0,
                description,
                inventoryNumbers: [],
                dateAcquired,
                estimatedUsefulLife,
                maxSequence: -1,
            });
        }

        const row = map.get(key)!;
        row.quantity += qty;
        row.totalCost += qty * unitCost;
        row.inventoryNumbers.push(inventoryItemNo);

        const trailing = parseTrailingNumber(inventoryItemNo);
        if (trailing) {
            row.maxSequence = Math.max(row.maxSequence, trailing.number);
        }

        return map;
    }, new Map());

    const rows = (Array.from(groupedRows.values()) as GroupedIcsRow[]).sort((a, b) => {
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
                        {rows.map((row) => (
                            <tr key={row.key}>
                                <td className="border border-black px-1 py-1 text-center">{row.quantity}</td>
                                <td className="border border-black px-1 py-1 text-center">{row.unit}</td>
                                <td className="border border-black px-1 py-1 text-right">{row.unitCost.toFixed(2)}</td>
                                <td className="border border-black px-1 py-1 text-right">{row.totalCost.toFixed(2)}</td>
                                <td className="border border-black px-1 py-1 align-top whitespace-pre-line">{row.description}</td>
                                <td className="border border-black px-1 py-1 text-center">{compressPropertyNumbers(row.inventoryNumbers.join('/'))}</td>
                                <td className="border border-black px-1 py-1 text-center">{row.dateAcquired}</td>
                                <td className="border border-black px-1 py-1 text-center">{row.estimatedUsefulLife}</td>
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
                                <td className="border border-black px-1 py-1 h-6">&nbsp;</td>
                            </tr>
                        ))}

                        {rows.length === 0 && (
                            <tr>
                                <td className="border border-black px-1 py-1 text-center" colSpan={8}>No issued items</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div className="ics-signature-block grid grid-cols-2 mt-0 text-xs border border-black border-t-0">
                    <div className="p-3 border-r border-black">
                        <div className="mb-6">Received from:</div>
                        <div className="border-b border-black h-14 flex items-end justify-center px-2">
                            <span className="pb-0.5 text-center">{receivedFromName}</span>
                        </div>
                        <div className="text-[10px] text-center mt-0.5">Signature Over Printed Name of End User</div>
                        <div className="border-b border-black mt-2 pb-1 text-center">{receivedFromOffice}</div>
                        <div className="text-[10px] text-center mt-1">Position/Office</div>
                        <div className="border-b border-black mt-2 pb-1 text-center">{docDate}</div>
                        <div className="text-[10px] text-center mt-1">Date</div>
                    </div>

                    <div className="p-3">
                        <div className="mb-6">Received by:</div>
                        <div className="border-b border-black h-14 flex items-end justify-center px-2">
                            {assignments.length > 0 ? (
                                <div className="w-full text-center space-y-0.5">
                                    {assignments.map((assignment, idx) => (
                                        <div key={idx} className="font-medium text-xs">
                                            {assignment.receiver_name}
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
                        <div className="text-[10px] text-center mt-0.5">Signature Over Printed Name</div>
                        <div className="border-b border-black mt-2 pb-1 text-center">{receivedByOffice}</div>
                        <div className="text-[10px] text-center mt-1">Position/Office</div>
                        <div className="border-b border-black mt-2 pb-1 text-center">{receivedDate}</div>
                        <div className="text-[10px] text-center mt-1">Date</div>
                    </div>
                </div>
            </>
        </div>
    );
});

ICSPrintView.displayName = 'ICSPrintView';