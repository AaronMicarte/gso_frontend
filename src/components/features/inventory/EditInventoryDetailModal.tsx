'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useUpdateInventoryDetail, useInventory } from '@/lib/hooks/useInventory';
import type { InventoryDetailEditData } from '@/lib/api/inventory';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, X, Pencil } from 'lucide-react';

export type InventoryDetailEditForm = {
    id: number;
    Description: string;
    Brand: string;
    ModelNumber: string;
    SerialNumber: string;
    inventoryId?: number;
    articleName?: string;
};

type EditInventoryDetailModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: InventoryDetailEditForm | null;
};

type InventoryDetail = {
    InventoryDetailID: number;
    dr_article_name?: string | null;
    PropertyName?: string | null;
};

type InventoryData = {
    details?: InventoryDetail[];
};

type LabelProps = {
    htmlFor: string;
    children: React.ReactNode;
    badge?: React.ReactNode;
};

function FieldLabel({ htmlFor, children, badge }: LabelProps) {
    return (
        <label
            htmlFor={htmlFor}
            className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
        >
            <span>{children}</span>
            {badge}
        </label>
    );
}

const inputClass =
    'w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm text-slate-800 placeholder:text-slate-300 transition-colors';

export function EditInventoryDetailModal({ open, onOpenChange, item }: EditInventoryDetailModalProps) {
    const updateInventoryDetail = useUpdateInventoryDetail();
    const [form, setForm] = useState<InventoryDetailEditForm | null>(null);
    const [applyScope, setApplyScope] = useState<'this' | 'siblings'>('this');

    const inventoryQuery = useInventory(form?.inventoryId ?? 0) as { data?: InventoryData };

    useEffect(() => {
        if (open && item) {
            setForm({ ...item });
            setApplyScope('this');
        } else if (!open) {
            setForm(null);
        }
    }, [open, item]);

    const siblingCount = useMemo(() => {
        if (!form?.articleName) return 0;
        const details = inventoryQuery.data?.details ?? [];
        const matchKey = form.articleName.trim().toLowerCase();
        const siblings = details.filter((d) => {
            const name = (d.dr_article_name ?? d.PropertyName ?? '').trim().toLowerCase();
            return name && matchKey && name === matchKey;
        });
        return Math.max(0, siblings.length - 1);
    }, [inventoryQuery.data, form?.articleName]);

    const handleSave = async () => {
        if (!form) return;

        const payload: InventoryDetailEditData = {
            Description: form.Description,
            Brand: form.Brand,
            ModelNumber: form.ModelNumber,
            SerialNumber: form.SerialNumber,
        };

        try {
            if (applyScope === 'this') {
                await updateInventoryDetail.mutateAsync({ id: form.id, data: payload });
                toast.success('Item updated successfully');
            } else {
                const details = inventoryQuery.data?.details ?? [];
                const matchKey = (form.articleName ?? '').trim().toLowerCase();
                const siblings = details.filter((d) => {
                    const name = (d.dr_article_name ?? d.PropertyName ?? '').trim().toLowerCase();
                    return name && matchKey && name === matchKey;
                });

                if (siblings.length === 0) {
                    await updateInventoryDetail.mutateAsync({ id: form.id, data: payload });
                    toast.success('Item updated successfully');
                } else {
                    const { SerialNumber: _serial, ModelNumber: _model, ...siblingPayload } = payload;

                    await Promise.all(
                        siblings.map((s) => {
                            const dataToSave =
                                s.InventoryDetailID === form.id ? payload : siblingPayload;
                            return updateInventoryDetail.mutateAsync({
                                id: s.InventoryDetailID,
                                data: dataToSave as InventoryDetailEditData,
                            });
                        })
                    );
                    toast.success(
                        `Updated ${siblings.length} item${siblings.length > 1 ? 's' : ''} successfully`
                    );
                }
            }
            onOpenChange(false);
        } catch {
            toast.error('Failed to update item details');
        }
    };

    const updateField = (field: keyof Omit<InventoryDetailEditForm, 'id'>, value: string) => {
        setForm((prev) => (prev ? { ...prev, [field]: value } : null));
    };

    const isSiblingsMode = applyScope === 'siblings';
    const isPending = updateInventoryDetail.isPending;

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-150" />

                <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 focus:outline-none">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div>
                                <Dialog.Title className="text-base font-bold text-slate-900 leading-tight">
                                    Edit Item Details
                                </Dialog.Title>
                                <Dialog.Description className="text-xs text-slate-400 mt-0.5">
                                    {form?.articleName ?? 'Update description, brand, model, and serial number'}
                                </Dialog.Description>
                            </div>
                        </div>
                        <Dialog.Close className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200">
                            <X className="w-4 h-4" />
                        </Dialog.Close>
                    </div>

                    {/* Body */}
                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

                        {/* Description */}
                        <div>
                            <FieldLabel htmlFor="edit-description">Description</FieldLabel>
                            <textarea
                                id="edit-description"
                                value={form?.Description ?? ''}
                                onChange={(e) => updateField('Description', e.target.value)}
                                className={`${inputClass} resize-vertical min-h-[88px]`}
                                placeholder="Enter item description..."
                                rows={3}
                                maxLength={255}
                            />
                        </div>

                        {/* Brand + Model */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <FieldLabel htmlFor="edit-brand">Brand</FieldLabel>
                                <textarea
                                    id="edit-brand"
                                    value={form?.Brand ?? ''}
                                    onChange={(e) => updateField('Brand', e.target.value)}
                                    className={`${inputClass} resize-vertical min-h-[38px] max-h-[120px]`}
                                    placeholder="e.g. Dell, Canon..."
                                    rows={1}
                                    maxLength={100}
                                />
                            </div>
                            <div>
                                <FieldLabel
                                    htmlFor="edit-model"
                                    badge={
                                        isSiblingsMode ? (
                                            <span className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded normal-case tracking-normal animate-in fade-in duration-150">
                                                Cannot bulk-edit
                                            </span>
                                        ) : null
                                    }
                                >
                                    Model
                                </FieldLabel>
                                <textarea
                                    id="edit-model"
                                    value={isSiblingsMode ? (item?.ModelNumber ?? '') : (form?.ModelNumber ?? '')}
                                    onChange={(e) => updateField('ModelNumber', e.target.value)}
                                    disabled={isSiblingsMode}
                                    className={`${inputClass} resize-vertical min-h-[38px] max-h-[120px] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
                                    placeholder="e.g. XPS 15, EOS R..."
                                    rows={1}
                                    maxLength={100}
                                />
                            </div>
                        </div>

                        {/* Serial Number */}
                        <div>
                            <FieldLabel
                                htmlFor="edit-serial"
                                badge={
                                    isSiblingsMode ? (
                                        <span className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded normal-case tracking-normal animate-in fade-in duration-150">
                                            Cannot bulk-edit
                                        </span>
                                    ) : null
                                }
                            >
                                Serial Number
                            </FieldLabel>
                            <textarea
                                id="edit-serial"
                                value={isSiblingsMode ? (item?.SerialNumber ?? '') : (form?.SerialNumber ?? '')}
                                onChange={(e) => updateField('SerialNumber', e.target.value)}
                                disabled={isSiblingsMode}
                                className={`${inputClass} resize-vertical min-h-[38px] max-h-[120px] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
                                placeholder="Enter serial number..."
                                rows={1}
                                maxLength={100}
                            />
                        </div>

                        {/* Apply Scope */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Apply Changes To
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                {(
                                    [
                                        { value: 'this', label: 'This item only' },
                                        {
                                            value: 'siblings',
                                            label: `All identical items${siblingCount > 0 ? ` (${siblingCount + 1})` : ''}`,
                                        },
                                    ] as const
                                ).map(({ value, label }) => (
                                    <label
                                        key={value}
                                        className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer select-none text-sm font-medium transition-colors ${applyScope === value
                                            ? 'border-slate-800 bg-white text-slate-900 shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="applyScope"
                                            checked={applyScope === value}
                                            onChange={() => setApplyScope(value)}
                                            className="h-3.5 w-3.5 text-slate-800 border-slate-300 focus:ring-slate-500"
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>

                            {applyScope === 'this' && siblingCount > 0 && (
                                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 text-amber-800 rounded-lg px-3 py-2.5 text-xs animate-in slide-in-from-top-1 duration-150">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    <p>
                                        <span className="font-semibold">{siblingCount} other matching item{siblingCount > 1 ? 's' : ''}</span> won't receive these changes. Switch to bulk mode if they share the same description and brand.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end items-center gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
                            >
                                Cancel
                            </button>
                        </Dialog.Close>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isPending || !form}
                            className="px-4 py-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                        >
                            {isPending ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
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
}): InventoryDetailEditForm {
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