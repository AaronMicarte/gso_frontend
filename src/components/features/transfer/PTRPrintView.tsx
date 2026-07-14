'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PropertyTransfer, PropertyTransferItem } from '@/types/propertyTransfer';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { resolveStorageUrl } from '@/lib/utils/signature';
import transferAPI from '@/lib/api/transfer';

interface PTRPrintViewProps {
    transfer: PropertyTransfer;
}

interface ReceiverAssignment {
    inventory_detail_id: number;
    receiver_name: string;
    position_office?: string;
    quantity: number;
}

interface ReceiverPrintPage {
    receiverName: string;
    receiverOffice: string;
    items: Array<{ item: PropertyTransferItem; assignedQty: number }>;
}

export const PTRPrintView = React.forwardRef<HTMLDivElement, PTRPrintViewProps>(({ transfer }, ref) => {
    const [receiverAssignments, setReceiverAssignments] = useState<ReceiverAssignment[]>([]);

    useEffect(() => {
        if (!transfer?.TransferID) return;
        transferAPI.getReceiverAssignments(transfer.TransferID)
            .then(res => setReceiverAssignments(res?.data ?? []))
            .catch(() => { });
    }, [transfer?.TransferID]);

    const formatDate = (dateString?: string | null) => {
        if (!dateString) return '';
        return format(toZonedTime(new Date(dateString), 'Asia/Manila'), 'MM/dd/yyyy');
    };

    const ensureText = (value: unknown, fallback: string) => {
        const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        return text.length > 0 ? text : fallback;
    };

    const resolveArticleImageUrl = (raw?: string | null) => {
        const value = (raw || '').trim();
        if (!value) return null;
        const normalized = value.replace(/^\/+/, '');
        const mapped = normalized.startsWith('article_images/') ? `/storage/${normalized}` : value;
        return resolveStorageUrl(mapped);
    };

    const entityName = 'CITY GOVERNMENT OF EL SALVADOR';

    const items = (transfer.items ?? []).filter((item) => Number(item.ApprovedQuantity ?? item.Quantity ?? 0) > 0);
    const docDate = ensureText(formatDate(transfer.ApprovedAt || transfer.created_at || ''), 'Missing date');

    const borrowerName = ensureText(transfer.fromEndUser?.FullName, 'Missing releasing custodian');
    const borrowerOffice = ensureText(
        transfer.fromEndUser?.DepartmentName || transfer.fromDepartment?.DepartmentName,
        'Missing department'
    );

    const borrowingName = ensureText(transfer.toEndUser?.FullName, 'Missing receiving custodian');
    const borrowingOffice = ensureText(
        transfer.toEndUser?.DepartmentName || transfer.toDepartment?.DepartmentName,
        'Missing department'
    );

    const searchParams = useSearchParams();
    const receiverKey = searchParams.get('receiver_key') ?? undefined;

    const receiverPages = useMemo((): ReceiverPrintPage[] => {
        const groupedByReceiver = new Map<string, {
            receiverName: string;
            receiverOffice: string;
            assignments: Array<{ inventory_detail_id: number; quantity: number }>;
        }>();

        receiverAssignments.forEach((assignment) => {
            const receiverName = String(assignment.receiver_name || '').trim() || borrowingName;
            const rawReceiverOffice = String(assignment.position_office ?? '').trim();
            const key = `${receiverName}||${rawReceiverOffice}`;
            const quantity = Math.max(1, Number(assignment.quantity ?? 1));

            const page = groupedByReceiver.get(key);
            if (page) {
                page.assignments.push({ inventory_detail_id: assignment.inventory_detail_id, quantity });
            } else {
                groupedByReceiver.set(key, {
                    receiverName,
                    receiverOffice: rawReceiverOffice,
                    assignments: [{ inventory_detail_id: assignment.inventory_detail_id, quantity }],
                });
            }
        });

        const fallbackItems = (transfer.items ?? [])
            .filter((item) => Number(item.ApprovedQuantity ?? item.Quantity ?? 0) > 0)
            .map((item) => ({ item, assignedQty: Math.max(1, Number(item.ApprovedQuantity ?? item.Quantity ?? 1)) }));

        if (groupedByReceiver.size === 0) {
            return [{
                receiverName: borrowingName,
                receiverOffice: borrowingOffice,
                items: fallbackItems,
            }];
        }

        const pages: ReceiverPrintPage[] = [];

        groupedByReceiver.forEach((group) => {
            const pageItems = new Map<number, { item: PropertyTransferItem; assignedQty: number }>();

            group.assignments.forEach((assignment) => {
                const sourceItem = (transfer.items ?? []).find((item) => Number(item.InventoryDetailID) === Number(assignment.inventory_detail_id));
                if (!sourceItem) return;

                const existing = pageItems.get(sourceItem.InventoryDetailID);
                if (existing) {
                    existing.assignedQty += assignment.quantity;
                } else {
                    pageItems.set(sourceItem.InventoryDetailID, {
                        item: sourceItem,
                        assignedQty: assignment.quantity,
                    });
                }
            });

            if (pageItems.size > 0) {
                pages.push({
                    receiverName: group.receiverName,
                    receiverOffice: group.receiverOffice,
                    items: Array.from(pageItems.values()),
                });
            }
        });

        return pages.length > 0
            ? pages
            : [{
                receiverName: borrowingName,
                receiverOffice: borrowingOffice,
                items: fallbackItems,
            }];
    }, [receiverAssignments, borrowingName, borrowingOffice, transfer.items]);

    const filteredReceiverPages = useMemo(() => {
        if (!receiverKey) return receiverPages;

        try {
            const [receiverName, receiverOffice] = JSON.parse(decodeURIComponent(receiverKey));
            const matched = receiverPages.filter((page) =>
                page.receiverName === receiverName && page.receiverOffice === receiverOffice
            );
            return matched.length > 0 ? matched : receiverPages;
        } catch {
            return receiverPages;
        }
    }, [receiverKey, receiverPages]);

    return (
        <>
            {filteredReceiverPages.map((page, pageIdx) => (
                <div
                    key={`${page.receiverName}-${page.receiverOffice}-${pageIdx}`}
                    ref={pageIdx === 0 ? ref : undefined}
                    className={`gso-print-doc bg-white p-6 max-w-4xl mx-auto text-black${pageIdx > 0 ? ' print-page-break' : ''}`}
                >
                    <div className="gso-print-title mb-1">Property Transfer Report</div>

                    <div className="grid grid-cols-2 gap-4 mb-1 text-xs leading-tight">
                        <div className="space-y-1">
                            <div className="flex items-end gap-2">
                                <div className="whitespace-nowrap">Entity Name :</div>
                                <div className="flex-1 border-b border-black pb-0.5">{entityName}</div>
                            </div>
                            <div className="flex items-end gap-2">
                                <div className="whitespace-nowrap">Fund Cluster :</div>
                                <div className="flex-1 border-b border-black pb-0.5"></div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-end gap-2 justify-end">
                                <div className="whitespace-nowrap">PTR No. :</div>
                                <div className="w-48 border-b border-black pb-0.5 text-right">{transfer.TransferNumber}</div>
                            </div>
                            <div className="flex items-end gap-2 justify-end">
                                <div className="whitespace-nowrap">Date :</div>
                                <div className="w-48 border-b border-black pb-0.5 text-right">{docDate}</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs mb-2 leading-tight">
                        <div>
                            <div className="flex items-end gap-2">
                                <div className="whitespace-nowrap">Releasing Custodian:</div>
                                <div className="flex-1 border-b border-black pb-0.5">{borrowerName}</div>
                            </div>
                            <div className="flex items-end gap-2 mt-1">
                                <div className="whitespace-nowrap">Department:</div>
                                <div className="flex-1 border-b border-black pb-0.5">{borrowerOffice}</div>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-end gap-2">
                                <div className="whitespace-nowrap">Receiving Custodian:</div>
                                <div className="flex-1 border-b border-black pb-0.5">{page.receiverName}</div>
                            </div>
                            <div className="flex items-end gap-2 mt-1">
                                <div className="whitespace-nowrap">Department:</div>
                                <div className="flex-1 border-b border-black pb-0.5">{page.receiverOffice || borrowingOffice}</div>
                            </div>
                        </div>
                    </div>

                    <table className="w-full border-collapse border border-black text-[11px] leading-tight">
                        <thead>
                            <tr>
                                <th className="border border-black px-1 py-[2px] w-[50px] text-center">Qty</th>
                                <th className="border border-black px-1 py-[2px] w-[70px] text-center">Unit</th>
                                <th className="border border-black px-1 py-[2px] text-center">Description</th>
                                <th className="border border-black px-1 py-[2px] w-[110px] text-center">Property No.</th>
                                <th className="border border-black px-1 py-[2px] w-[110px] text-center">Serial No.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const rowsNeeded = 18;
                                const rows = page.items.slice(0, rowsNeeded).map((row, idx) => {
                                    const inv = row.item.inventoryDetail;
                                    const description = ensureText(inv?.Description, 'Missing description');
                                    const unitName = ensureText(inv?.unitOfMeasure?.UnitName, 'Missing unit');
                                    const propertyNo = ensureText(inv?.PropertyNumber, 'Missing property number');
                                    const serial = ensureText(inv?.SerialNumber || inv?.drDetail?.SerialNumber, '');

                                    return (
                                        <tr key={row.item.TransferItemID ?? idx}>
                                            <td className="border border-black px-1 py-[2px] text-center">{Math.max(1, Number(row.assignedQty))}</td>
                                            <td className="border border-black px-1 py-[2px] text-center">{unitName}</td>
                                            <td className="border border-black px-1 py-[2px]">{description}</td>
                                            <td className="border border-black px-1 py-[2px] text-center">{propertyNo}</td>
                                            <td className="border border-black px-1 py-[2px] text-center">{serial}</td>
                                        </tr>
                                    );
                                });

                                const blanks = Math.max(0, rowsNeeded - rows.length);
                                for (let i = 0; i < blanks; i++) {
                                    rows.push(
                                        <tr key={`blank-${pageIdx}-${i}`}>
                                            <td className="border border-black px-1 py-[2px] h-[23px]">&nbsp;</td>
                                            <td className="border border-black px-1 py-[2px] h-[23px]">&nbsp;</td>
                                            <td className="border border-black px-1 py-[2px]">&nbsp;</td>
                                            <td className="border border-black px-1 py-[2px]">&nbsp;</td>
                                            <td className="border border-black px-1 py-[2px]">&nbsp;</td>
                                        </tr>
                                    );
                                }

                                return rows;
                            })()}
                        </tbody>
                    </table>

                    <div className="grid grid-cols-2 gap-10 mt-8 text-xs">
                        <div>
                            <div className="mb-6">Released by (Releasing Custodian):</div>
                            <div className="border-b border-black h-12"></div>
                            <div className="text-[10px] text-center mt-1">Signature over Printed Name</div>
                            <div className="border-b border-black mt-3 pb-1 text-center">{borrowerName}</div>
                            <div className="text-[10px] text-center mt-1">Position/Office</div>
                            <div className="border-b border-black mt-2 pb-1 text-center">{borrowerOffice}</div>
                            <div className="text-[10px] text-center mt-1">Date</div>
                            <div className="border-b border-black mt-2 pb-1 text-center">{formatDate(transfer.BorrowerSignedAt) || docDate}</div>
                        </div>

                        <div>
                            <div className="mb-6">Received by (Receiving Custodian):</div>
                            <div className="border-b border-black h-12"></div>
                            <div className="text-[10px] text-center mt-1">Signature over Printed Name</div>
                            <div className="border-b border-black mt-3 pb-1 text-center">{page.receiverName}</div>
                            <div className="text-[10px] text-center mt-1">Position/Office</div>
                            <div className="border-b border-black mt-2 pb-1 text-center">{page.receiverOffice || borrowingOffice}</div>
                            <div className="text-[10px] text-center mt-1">Date</div>
                            <div className="border-b border-black mt-2 pb-1 text-center">{formatDate(transfer.BorrowingSignedAt) || docDate}</div>
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
});

PTRPrintView.displayName = 'PTRPrintView';