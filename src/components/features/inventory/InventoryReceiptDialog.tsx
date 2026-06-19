'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useInventoryPropertyCard, useInventory } from '@/lib/hooks/useInventory';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitOfMeasures';
import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

type InventoryReceiptDialogProps = {
    inventoryDetailId: number;
    inventoryId?: number;
    articleName?: string;
    unitOfMeasureId?: number;
};

// Formats any raw date string cleanly into Month D, YYYY (e.g., March 12, 2026)
function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    } catch {
        return '-';
    }
}

export function InventoryReceiptDialog({ inventoryDetailId, inventoryId, articleName, unitOfMeasureId }: InventoryReceiptDialogProps) {
    const [open, setOpen] = useState(false);
    const propCard = useInventoryPropertyCard(inventoryDetailId, !!inventoryDetailId);
    const inventoryQuery = useInventory(inventoryId || 0);
    const { data: unitsData } = useAllUnitsOfMeasure();

    const unitName = useMemo(() => {
        const list = Array.isArray(unitsData) ? (unitsData as any[]) : [];
        const found = list.find(u => (u.id ?? u.UnitOfMeasureID) === unitOfMeasureId);
        return found?.name ?? found?.UnitName ?? 'unit';
    }, [unitsData, unitOfMeasureId]);

    const combined = useMemo(() => {
        const details = inventoryQuery.data?.details || [];
        if (!articleName) {
            const d = details.find(d => d.InventoryDetailID === inventoryDetailId);
            return {
                count: d ? 1 : 0,
                totalQuantity: d?.Quantity || 0,
                unitCost: d?.UnitCost || propCard.data?.header?.unit_cost || 0,
                totalCost: d?.TotalCost || 0,
            };
        }

        const key = articleName.trim().toLowerCase();
        const siblings = details.filter(d => {
            const name = (d.dr_article_name || d.PropertyName || '').trim().toLowerCase();
            return name && key && name === key;
        });

        const totalQuantity = siblings.reduce((s, cur) => s + (cur.Quantity || 0), 0);
        const totalCost = siblings.reduce((s, cur) => s + Number(cur.TotalCost || 0), 0);
        const unitCost = propCard.data?.header?.unit_cost ?? (siblings[0]?.UnitCost || 0);

        return { count: siblings.length, totalQuantity, unitCost, totalCost };
    }, [inventoryQuery.data, articleName, inventoryDetailId, propCard.data]);

    const header = propCard.data?.header;
    const receiptRows = propCard.data?.rows?.filter(r => r.entry_type === 'receipt') || propCard.data?.rows || [];
    const latestReceipt = receiptRows.length > 0 ? receiptRows[0] : null;

    const inventoryIar = inventoryQuery.data?.iar;
    const poNumber = header?.po_number ?? inventoryIar?.IARNumber ?? inventoryIar?.deliveryReceipt?.DRNumber ?? null;
    const supplier = header?.supplier ?? inventoryIar?.deliveryReceipt?.SupplierName ?? null;
    const receivedDate = header?.date_received ?? latestReceipt?.date ?? inventoryIar?.deliveryReceipt?.DateReceived ?? null;

    // 1. Fetch raw value from API data structures
    const rawReceivedBy = header?.received_by ?? latestReceipt?.office_officer ?? propCard.data?.rows?.find(r => r.receipt_qty)?.office_officer ?? null;

    // 2. Parse and invert format smoothly from "Accounting / Cyron Micarte" to "Cyron Micarte - Accounting"
    const receivedBy = useMemo(() => {
        if (!rawReceivedBy) return null;

        if (rawReceivedBy.includes('/')) {
            const parts = rawReceivedBy.split('/').map(p => p.trim());
            if (parts.length === 2) {
                const [dept, name] = parts;
                return `${name} - ${dept}`;
            }
        }
        return rawReceivedBy;
    }, [rawReceivedBy]);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
                title="View receiving details"
            >
                <Eye className="w-4 h-4" />
            </button>

            <Dialog.Root open={open} onOpenChange={setOpen}>
                <Dialog.Portal>
                    {/* Fixed sharp overlay, no blur filter */}
                    <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 transition-opacity animate-in fade-in duration-150" />

                    {/* Content frame */}
                    <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 focus:outline-none">
                        <div>
                            <Dialog.Title className="text-lg font-bold text-slate-900 tracking-tight">Property Details</Dialog.Title>
                            {articleName && (
                                <Dialog.Description className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                                    Article : {articleName}
                                </Dialog.Description>
                            )}
                        </div>

                        {/* Top Metadata Section (Left-to-Right layout) */}
                        <div className="border-t border-slate-100 pt-4 space-y-3.5">
                            <div className="grid grid-cols-3 gap-4 items-baseline">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">PO NO.</span>
                                <span className="col-span-2 text-slate-900 font-semibold text-sm">{poNumber ?? '-'}</span>
                            </div>

                            <div className="grid grid-cols-3 gap-4 items-baseline">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Supplier</span>
                                <span className="col-span-2 text-slate-900 font-semibold text-sm truncate" title={supplier ?? ''}>{supplier ?? '-'}</span>
                            </div>

                            {/* Detect document type from the inventory detail when available */}
                            <div className="grid grid-cols-3 gap-4 items-baseline">
                                {(() => {
                                    const detail = inventoryQuery.data?.details?.find(d => d.InventoryDetailID === inventoryDetailId);
                                    const docType = detail?.DocumentType ?? null;
                                    const label = docType === 'PAR' ? 'PAR Number' : docType === 'ICS' ? 'ICS Number' : 'PAR / ICS Number';
                                    return (
                                        <>
                                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                                            <span className="col-span-2 text-slate-900 font-semibold text-sm">{header?.property_number ?? '-'}</span>
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="grid grid-cols-3 gap-4 items-baseline">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date Received</span>
                                <span className="col-span-2 text-slate-900 font-semibold text-sm">{formatDate(receivedDate)}</span>
                            </div>

                            <div className="grid grid-cols-3 gap-4 items-baseline">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Received By</span>
                                <span className="col-span-2 text-slate-900 font-semibold text-sm block truncate" title={receivedBy ?? ''}>{receivedBy ?? '-'}</span>
                            </div>
                        </div>

                        {/* Quantities & Costs Breakdown Table */}
                        <div className="border border-slate-100 rounded-lg overflow-hidden">
                            <table className="w-full text-center border-collapse">
                                <thead className="bg-slate-50/70 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Qty</th>
                                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Unit</th>
                                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Unit Cost</th>
                                        <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Total Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-slate-700 text-sm">
                                    <tr>
                                        <td className="px-4 py-2.5 font-semibold text-slate-900 text-center">
                                            {combined.totalQuantity.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-500 font-medium text-center">
                                            {unitName}
                                        </td>
                                        <td className="px-4 py-2.5 font-medium text-slate-600 text-center">
                                            ₱{Number(combined.unitCost || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2.5 font-bold text-slate-950 text-center">
                                            ₱{Number(combined.totalCost || header?.unit_cost || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {combined.count > 1 && (
                                <div className="bg-slate-50/40 px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400 italic text-center">
                                    * Consolidating data fields from {combined.count} line items.
                                </div>
                            )}
                        </div>

                        {/* Footer Button Bar */}
                        <div className="flex justify-end pt-2 border-t border-slate-100">
                            <Dialog.Close asChild>
                                <button className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors">
                                    Close
                                </button>
                            </Dialog.Close>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}