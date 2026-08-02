'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useInventoryPropertyCard, useInventory } from '@/lib/hooks/useInventory';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitOfMeasures';
import { useMemo, useState } from 'react';
import { Eye, X, Package, FileText, User, Calendar, Building2, Hash, Layers, ChevronDown, ChevronUp, Tag, Cpu } from 'lucide-react';
import { useAllPropertyTypes } from '@/lib/hooks/masterData/usePropertyTypes';

type InventoryReceiptDialogProps = {
    inventoryDetailId: number;
    inventoryId?: number;
    articleName?: string;
    unitOfMeasureId?: number;
};

type UnitOfMeasure = {
    id?: number;
    UnitOfMeasureID?: number;
    name?: string;
    UnitName?: string;
};

type PropertyType = {
    PropertyName?: string;
    property_name?: string;
    name?: string;
    Description?: string;
    description?: string;
};

type InventoryDetail = {
    InventoryDetailID: number;
    UnitOfMeasureID?: number;
    UnitName?: string;
    unitName?: string;
    unit_of_measure_name?: string;
    Quantity?: number;
    UnitCost?: number;
    TotalCost?: number;
    dr_article_name?: string;
    PropertyName?: string;
    Description?: string;
    dr_item_description?: string;
    property_type_description?: string;
    PropertyNumber?: string;
    StatusName?: string;
    ConditionName?: string;
    custodianName?: string;
    DocumentType?: 'PAR' | 'ICS' | string;
    PropertyType?: { PropertyName?: string };
    PropertyTypeName?: string;
    property_type_name?: string;
    UnitOfMeasure?: { UnitOfMeasureID?: number };
    Brand?: string;
    brand?: string;
    ModelNumber?: string;
    Model?: string;
    model_number?: string;
    SerialNumber?: string;
    Serial?: string;
    serial?: string;
    serial_number?: string;
    endUserName?: string | null;
    endUserPosition?: string | null;
};

type PropertyCardRow = {
    entry_type?: string;
    date?: string;
    office_officer?: string;
    receipt_qty?: number;
};

type PropertyCardHeader = {
    unit_cost?: number;
    po_number?: string;
    supplier?: string;
    date_received?: string;
    received_by?: string;
    description?: string;
    property_number?: string;
    brand?: string;
    model_number?: string;
    par_ics_number?: string | null;
    document_type?: 'PAR' | 'ICS' | null;
};

type DeliveryReceipt = {
    DRNumber?: string;
    SupplierName?: string;
    DateReceived?: string;
};

type IAR = {
    IARNumber?: string;
    deliveryReceipt?: DeliveryReceipt;
};

type InventoryData = {
    details?: InventoryDetail[];
    iar?: IAR;
};

type PropertyCardData = {
    header?: PropertyCardHeader;
    rows?: PropertyCardRow[];
};

function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
        return '—';
    }
}

function formatPeso(value: number): string {
    return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Skeleton() {
    return <span className="inline-block h-3.5 w-28 rounded bg-slate-100 animate-pulse" />;
}

type MetaRowProps = {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    fullWidth?: boolean;
};

function MetaRow({ icon, label, value, fullWidth }: MetaRowProps) {
    return (
        <div className={`flex items-start gap-3 ${fullWidth ? 'col-span-2' : ''}`}>
            <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
                <div className="text-sm font-semibold text-slate-800 break-words">{value}</div>
            </div>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            {children}
        </p>
    );
}

function Divider() {
    return <div className="border-t border-dashed border-slate-100" />;
}

export function InventoryReceiptDialog({
    inventoryDetailId,
    inventoryId,
    articleName,
    unitOfMeasureId,
}: InventoryReceiptDialogProps) {
    const [open, setOpen] = useState(false);
    const [showItems, setShowItems] = useState(false);

    const propCard = useInventoryPropertyCard(inventoryDetailId, open && !!inventoryDetailId) as {
        data?: PropertyCardData;
        isLoading: boolean;
    };

    const inventoryQuery = useInventory(inventoryId ?? 0, open && !!inventoryId) as {
        data?: InventoryData;
        isLoading: boolean;
    };

    const { data: unitsData } = useAllUnitsOfMeasure() as { data?: UnitOfMeasure[] };
    const { data: allPropertyTypes } = useAllPropertyTypes() as { data?: PropertyType[] };

    const unitName = useMemo(() => {
        const list: UnitOfMeasure[] = Array.isArray(unitsData) ? unitsData : [];
        const fromQuery = inventoryQuery.data?.details?.find(
            (d) => d.InventoryDetailID === inventoryDetailId
        );
        const resolvedUnitId =
            unitOfMeasureId ??
            fromQuery?.UnitOfMeasureID ??
            fromQuery?.UnitOfMeasure?.UnitOfMeasureID ??
            null;
        const found = list.find((u) => (u.id ?? u.UnitOfMeasureID) === resolvedUnitId);
        if (found) return found.name ?? found.UnitName ?? 'unit';
        return fromQuery?.UnitName ?? fromQuery?.unitName ?? fromQuery?.unit_of_measure_name ?? 'unit';
    }, [unitsData, unitOfMeasureId, inventoryQuery.data, inventoryDetailId]);

    const currentDetail = useMemo(() => {
        return (
            inventoryQuery.data?.details?.find((d) => d.InventoryDetailID === inventoryDetailId) ?? null
        );
    }, [inventoryQuery.data, inventoryDetailId]);

    const allDetails = inventoryQuery.data?.details ?? [];

    const matchingDetails = useMemo(() => {
        if (articleName) {
            const key = articleName.trim().toLowerCase();
            return allDetails.filter((d) => {
                const name = (d.dr_article_name ?? d.PropertyName ?? '').trim().toLowerCase();
                return name && key && name === key;
            });
        }
        return allDetails.filter((d) => d.InventoryDetailID === inventoryDetailId);
    }, [allDetails, articleName, inventoryDetailId]);

    const combined = useMemo(() => {
        const details = inventoryQuery.data?.details ?? [];
        if (!articleName) {
            const d = currentDetail;
            return {
                count: d ? 1 : 0,
                totalQuantity: d?.Quantity ?? 0,
                unitCost: d?.UnitCost ?? propCard.data?.header?.unit_cost ?? 0,
                totalCost: d?.TotalCost ?? 0,
            };
        }
        const key = articleName.trim().toLowerCase();
        const siblings = details.filter((d) => {
            const name = (d.dr_article_name ?? d.PropertyName ?? '').trim().toLowerCase();
            return name && key && name === key;
        });
        const totalQuantity = siblings.reduce((s, cur) => s + (cur.Quantity ?? 0), 0);
        const totalCost = siblings.reduce((s, cur) => s + Number(cur.TotalCost ?? 0), 0);
        const unitCost = propCard.data?.header?.unit_cost ?? siblings[0]?.UnitCost ?? 0;
        return { count: siblings.length, totalQuantity, unitCost, totalCost };
    }, [inventoryQuery.data, articleName, currentDetail, propCard.data]);

    const header = propCard.data?.header;
    const receiptRows =
        propCard.data?.rows?.filter((r) => r.entry_type === 'receipt') ??
        propCard.data?.rows ??
        [];
    const latestReceipt = receiptRows[0] ?? null;
    const inventoryIar = inventoryQuery.data?.iar;

    const poNumber =
        header?.po_number ?? inventoryIar?.IARNumber ?? inventoryIar?.deliveryReceipt?.DRNumber ?? null;
    const supplier =
        header?.supplier ?? inventoryIar?.deliveryReceipt?.SupplierName ?? null;
    const receivedDate =
        header?.date_received ?? latestReceipt?.date ?? inventoryIar?.deliveryReceipt?.DateReceived ?? null;
    const rawReceivedBy =
        header?.received_by ??
        latestReceipt?.office_officer ??
        propCard.data?.rows?.find((r) => r.receipt_qty)?.office_officer ??
        null;

    const receivedBy = useMemo(() => {
        if (!rawReceivedBy) return null;
        if (rawReceivedBy.includes('/')) {
            const parts = rawReceivedBy.split('/').map((p) => p.trim());
            if (parts.length === 2) return `${parts[1]} - ${parts[0]}`;
        }
        return rawReceivedBy;
    }, [rawReceivedBy]);

    const resolvedPropertyTypeName = useMemo((): string | null => {
        const nameFromFields =
            currentDetail?.PropertyType?.PropertyName ??
            currentDetail?.PropertyTypeName ??
            currentDetail?.property_type_name ??
            null;
        if (nameFromFields) return nameFromFields;
        const desc = currentDetail?.property_type_description;
        if (desc && Array.isArray(allPropertyTypes)) {
            const trimmed = desc.trim();
            const match = allPropertyTypes.find(
                (pt) => (pt.Description ?? pt.description ?? '').trim() === trimmed
            );
            if (match) return match.PropertyName ?? match.property_name ?? match.name ?? null;
        }
        return null;
    }, [currentDetail, allPropertyTypes]);

    const loading = propCard.isLoading || inventoryQuery.isLoading;
    const val = (node: React.ReactNode) => (loading ? <Skeleton /> : node);

    const articleValue =
        articleName ?? currentDetail?.dr_article_name ?? currentDetail?.PropertyName ?? '—';
    const descriptionValue =
        currentDetail?.Description ?? currentDetail?.dr_item_description ?? header?.description ?? '—';
    const inventoryNumberValue = header?.inventory_number ?? currentDetail?.InventoryNumber ?? '—';
    const propertyNumberValue = header?.property_number ?? currentDetail?.PropertyNumber ?? '—';
    const statusValue = currentDetail?.StatusName ?? currentDetail?.ConditionName ?? '—';
    const custodianValue = currentDetail?.custodianName ?? receivedBy ?? '—';
    const brandValue = currentDetail?.Brand ?? currentDetail?.brand ?? header?.brand ?? null;
    const modelValue = currentDetail?.ModelNumber ?? currentDetail?.Model ?? currentDetail?.model_number ?? header?.model_number ?? null;
    const serialValue = currentDetail?.SerialNumber ?? currentDetail?.Serial ?? currentDetail?.serial ?? currentDetail?.serial_number ?? null;

    // PAR/ICS label and value from property card header
    let parIcsLabel = 'PAR / ICS No.';
    let parIcsValue = header?.par_ics_number ?? null;

    if (header?.document_type === 'PAR') {
        parIcsLabel = 'PAR Number';
    } else if (header?.document_type === 'ICS') {
        parIcsLabel = 'ICS Number';
    } else if (!header?.document_type && currentDetail?.DocumentType === 'PAR') {
        parIcsLabel = 'PAR Number';
    } else if (!header?.document_type && currentDetail?.DocumentType === 'ICS') {
        parIcsLabel = 'ICS Number';
    }

    const totalCostValue = Number(
        combined.totalCost || combined.totalQuantity * combined.unitCost || 0
    );

    const isMultiple = matchingDetails.length > 1;

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
                    <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-150" />

                    <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 focus:outline-none">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                            <div>
                                <Dialog.Title className="text-base font-bold text-slate-900">
                                    Property Details
                                </Dialog.Title>
                                <Dialog.Description className="text-xs text-slate-500 mt-0.5">
                                    {loading ? <Skeleton /> : articleValue}
                                </Dialog.Description>
                            </div>
                            <Dialog.Close className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200">
                                <X className="w-4 h-4" />
                            </Dialog.Close>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                            {/* Asset Information */}
                            <section>
                                <SectionLabel>Asset Information</SectionLabel>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                    <MetaRow fullWidth icon={<Layers className="w-3.5 h-3.5" />} label="Article" value={val(articleValue)} />
                                    <MetaRow fullWidth icon={<FileText className="w-3.5 h-3.5" />} label="Description" value={val(descriptionValue)} />
                                    <MetaRow icon={<Tag className="w-3.5 h-3.5" />} label="Brand" value={val(brandValue ?? '—')} />
                                    <MetaRow icon={<Cpu className="w-3.5 h-3.5" />} label="Model" value={val(modelValue ?? '—')} />
                                    <MetaRow icon={<Package className="w-3.5 h-3.5" />} label="Property Type" value={val(resolvedPropertyTypeName ?? '—')} />
                                    <MetaRow icon={<Hash className="w-3.5 h-3.5" />} label="Inventory No." value={val(inventoryNumberValue)} />
                                    <MetaRow icon={<Hash className="w-3.5 h-3.5" />} label="Property No." value={val(propertyNumberValue)} />
                                    <MetaRow
                                        icon={<Hash className="w-3.5 h-3.5" />}
                                        label="Serial Number"
                                        value={val(serialValue ?? (isMultiple ? 'Multiple — see items below' : '—'))}
                                    />
                                    <MetaRow
                                        icon={<span className="w-3 h-3 rounded-full border-2 border-current" />}
                                        label="Status / Condition"
                                        value={val(statusValue)}
                                    />
                                    <MetaRow fullWidth icon={<User className="w-3.5 h-3.5" />} label="Custodian" value={val(custodianValue)} />
                                </div>
                            </section>

                            {/* Collapsible item list — only when multiple */}
                            {isMultiple && (
                                <>
                                    <Divider />
                                    <section>
                                        <button
                                            type="button"
                                            onClick={() => setShowItems((s) => !s)}
                                            className="w-full flex items-center justify-between text-left group focus:outline-none"
                                        >
                                            <SectionLabel>
                                                Line Items ({matchingDetails.length})
                                            </SectionLabel>
                                            <span className="text-slate-400 group-hover:text-slate-600 transition-colors mb-3">
                                                {showItems
                                                    ? <ChevronUp className="w-4 h-4" />
                                                    : <ChevronDown className="w-4 h-4" />}
                                            </span>
                                        </button>

                                        {showItems && (
                                            <div className="rounded-lg border border-slate-100 overflow-hidden">
                                                <div className="grid grid-cols-5 bg-slate-50 border-b border-slate-100">
                                                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                        Article / Property No.
                                                    </div>
                                                    {['Brand', 'Model', 'Serial No.', 'End User'].map((h) => (
                                                        <div key={h} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                                                            {h}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="divide-y divide-slate-50">
                                                    {matchingDetails.map((d) => (
                                                        <div key={d.InventoryDetailID} className="grid grid-cols-5 px-3 py-2.5 text-sm hover:bg-slate-50/60 transition-colors items-center">
                                                            <div className="min-w-0 pr-2">
                                                                <div className="font-medium text-slate-800 truncate">
                                                                    {d.dr_article_name ?? d.PropertyName ?? '—'}
                                                                </div>
                                                                <div className="text-xs text-slate-400 mt-0.5">
                                                                    {d.PropertyNumber ?? '—'}
                                                                </div>
                                                            </div>
                                                            <div className="text-slate-600 text-center whitespace-normal break-words px-2">
                                                                {d.Brand ?? d.brand ?? '—'}
                                                            </div>
                                                            <div className="text-slate-600 text-center whitespace-normal break-words px-2">
                                                                {d.ModelNumber ?? d.Model ?? d.model_number ?? '—'}
                                                            </div>
                                                            <div className="text-slate-600 text-center whitespace-normal break-words pl-2">
                                                                {d.SerialNumber ?? d.Serial ?? d.serial ?? d.serial_number ?? '—'}
                                                            </div>
                                                            <div className="text-slate-600 text-center whitespace-normal break-words px-2">
                                                                {d.endUserName ? (
                                                                    <div>
                                                                        <div className="font-medium text-slate-800">{d.endUserName}</div>
                                                                        {d.endUserPosition && (
                                                                            <div className="text-xs text-slate-500">{d.endUserPosition}</div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400">—</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                </>
                            )}

                            <Divider />

                            {/* Procurement Details */}
                            <section>
                                <SectionLabel>Procurement Details</SectionLabel>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                    <MetaRow icon={<Hash className="w-3.5 h-3.5" />} label="PO Number" value={val(poNumber ?? '—')} />
                                    <MetaRow icon={<Building2 className="w-3.5 h-3.5" />} label="Supplier" value={val(supplier ?? '—')} />
                                    <MetaRow icon={<FileText className="w-3.5 h-3.5" />} label={parIcsLabel} value={val(parIcsValue ?? '—')} />
                                    <MetaRow icon={<Calendar className="w-3.5 h-3.5" />} label="Date Received" value={val(formatDate(receivedDate))} />
                                    <MetaRow fullWidth icon={<User className="w-3.5 h-3.5" />} label="Received By" value={val(receivedBy ?? '—')} />
                                </div>
                            </section>

                            <Divider />

                            {/* Cost Breakdown */}
                            <section>
                                <SectionLabel>Cost Breakdown</SectionLabel>
                                <div className="rounded-lg border border-slate-100 overflow-hidden">
                                    <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-100">
                                        {['Quantity', 'Unit', 'Unit Cost', 'Total Cost'].map((h) => (
                                            <div key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                                                {h}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-4 divide-x divide-slate-50">
                                        <div className="px-4 py-3.5 text-center font-bold text-slate-900 text-base">
                                            {combined.totalQuantity.toLocaleString()}
                                        </div>
                                        <div className="px-4 py-3.5 text-center text-sm text-slate-500 font-medium flex items-center justify-center">
                                            {unitName}
                                        </div>
                                        <div className="px-4 py-3.5 text-center text-sm font-semibold text-slate-600 flex items-center justify-center">
                                            {formatPeso(Number(combined.unitCost))}
                                        </div>
                                        <div className="px-4 py-3.5 text-center font-bold text-slate-900 text-base flex items-center justify-center bg-slate-50">
                                            {formatPeso(totalCostValue)}
                                        </div>
                                    </div>
                                    {combined.count > 1 && (
                                        <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400 italic text-center">
                                            * Consolidating data from {combined.count} line items.
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end px-6 py-4 border-t border-slate-100 flex-shrink-0">
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

export function toInventoryDetailEditForm(item: {
    InventoryDetailID: number;
    InventoryID?: number;
    Description?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
    dr_article_name?: string | null;
    PropertyName?: string | null;
}): {
    id: number;
    Description: string;
    Brand: string;
    ModelNumber: string;
    SerialNumber: string;
    inventoryId?: number;
    articleName?: string;
} {
    return {
        id: item.InventoryDetailID,
        Description: item.Description ?? '',
        Brand: item.Brand ?? '',
        ModelNumber: item.ModelNumber ?? '',
        SerialNumber: item.SerialNumber ?? '',
        inventoryId: item.InventoryID,
        articleName: item.dr_article_name ?? item.PropertyName ?? '',
    };
}