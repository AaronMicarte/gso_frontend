'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useUpdateInventoryDetail, useInventory } from '@/lib/hooks/useInventory';
import type { InventoryDetailEditData } from '@/lib/api/inventory';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, X, CheckCircle2, AlertTriangle, Pencil, Settings2 } from 'lucide-react';

export type InventoryDetailEditForm = {
    id: number;
    Description: string;
    Brand: string;
    ModelNumber: string;
    SerialNumber: string;
    inventoryId?: number;
    articleName?: string;
};

type UnifiedInventoryModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: InventoryDetailEditForm | null;
};

type InventoryDetailInstance = {
    InventoryDetailID: number;
    dr_article_name?: string | null;
    PropertyName?: string | null;
    PropertyNumber?: string | null;
    SerialNumber?: string | null;
    ConditionName?: 'Serviceable' | 'Unserviceable' | string | null;
};

type InventoryQueryData = {
    details?: InventoryDetailInstance[];
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

export function EditInventoryDetailModal({ open, onOpenChange, item }: UnifiedInventoryModalProps) {
    const updateInventoryDetail = useUpdateInventoryDetail();

    const [activeTab, setActiveTab] = useState<'details' | 'condition'>('details');

    const [form, setForm] = useState<InventoryDetailEditForm | null>(null);
    const [applyScope, setApplyScope] = useState<'this' | 'siblings'>('this');

    const [localConditions, setLocalConditions] = useState<Record<number, 'Serviceable' | 'Unserviceable'>>({});
    const [savingConditionId, setSavingConditionId] = useState<number | null>(null);

    const inventoryQuery = useInventory(form?.inventoryId ?? 0, open && !!form?.inventoryId) as { data?: InventoryQueryData; isLoading: boolean; refetch?: () => void };

    const assetInstances = useMemo(() => {
        if (!form?.articleName) return [];
        const details = inventoryQuery.data?.details ?? [];
        const matchKey = form.articleName.trim().toLowerCase();
        return details.filter((d) => {
            const name = (d.dr_article_name ?? d.PropertyName ?? '').trim().toLowerCase();
            return name && matchKey && name === matchKey;
        });
    }, [inventoryQuery.data, form?.articleName]);

    const siblingCount = Math.max(0, assetInstances.length - 1);

    useEffect(() => {
        if (open && item) {
            setForm({ ...item });
            setApplyScope('this');
            setActiveTab('details');
        } else if (!open) {
            setForm(null);
        }
    }, [open, item]);

    useEffect(() => {
        if (open && assetInstances.length > 0) {
            const stateMap: Record<number, 'Serviceable' | 'Unserviceable'> = {};
            assetInstances.forEach((inst) => {
                stateMap[inst.InventoryDetailID] = inst.ConditionName === 'Unserviceable' ? 'Unserviceable' : 'Serviceable';
            });
            setLocalConditions(stateMap);
        }
    }, [open, assetInstances, activeTab]);

    // Tab A Action Handler: Save Descriptive Metadata Changes
    const handleSaveDetails = async () => {
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
                toast.success('Item details updated successfully');
            } else {
                if (assetInstances.length === 0) {
                    await updateInventoryDetail.mutateAsync({ id: form.id, data: payload });
                    toast.success('Item details updated successfully');
                } else {
                    const { SerialNumber: _serial, ...siblingPayload } = payload;

                    await Promise.all(
                        assetInstances.map((inst) =>
                            updateInventoryDetail.mutateAsync({
                                id: inst.InventoryDetailID,
                                data: siblingPayload,
                            })
                        )
                    );

                    toast.success(`Updated ${assetInstances.length} details logs successfully`);
                }
            }

            onOpenChange(false);
        } catch {
            toast.error('Failed to update item details');
        }
    };

    // Tab B Action Handler: Instant Condition Toggle
    const handleToggleCondition = async (targetId: number, targetCondition: 'Serviceable' | 'Unserviceable') => {
        setSavingConditionId(targetId);
        const previousCondition = localConditions[targetId];

        setLocalConditions(prev => ({ ...prev, [targetId]: targetCondition }));

        try {
            await updateInventoryDetail.mutateAsync({
                id: targetId,
                data: { Condition: targetCondition }
            });

            try {
                inventoryQuery.refetch?.();
            } catch { }

            setLocalConditions(prev => ({ ...prev, [targetId]: targetCondition }));
            toast.success(`Unit status updated to ${targetCondition.toLowerCase()}`);
        } catch {
            setLocalConditions(prev => ({ ...prev, [targetId]: previousCondition }));
            toast.error('Failed to change unit condition');
        } finally {
            setSavingConditionId(null);
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

                <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 focus:outline-none">

                    <div className="px-6 pt-4 pb-2 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <Dialog.Title className="text-base font-bold text-slate-900 leading-tight">
                                    Asset Control Hub
                                </Dialog.Title>
                                <Dialog.Description className="text-xs text-slate-400 mt-0.5">
                                    Target Batch Line: <span className="font-semibold text-slate-600">{form?.articleName || 'Dynamic Ledger'}</span>
                                </Dialog.Description>
                            </div>
                            <Dialog.Close className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none">
                                <X className="w-4 h-4" />
                            </Dialog.Close>
                        </div>

                        <div className="flex gap-1 border-b border-slate-100 mt-4">
                            <button
                                type="button"
                                onClick={() => setActiveTab('details')}
                                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-all focus:outline-none ${activeTab === 'details'
                                    ? 'border-slate-900 text-slate-900'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                Change Details
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('condition')}
                                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-all focus:outline-none ${activeTab === 'condition'
                                    ? 'border-slate-900 text-slate-900'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <Settings2 className="w-3.5 h-3.5" />
                                Change Condition
                                {assetInstances.length > 0 && (
                                    <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'condition' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {assetInstances.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4 bg-slate-50/40">

                        {activeTab === 'details' && (
                            <div className="space-y-4 animate-in fade-in duration-100">
                                <div>
                                    <FieldLabel htmlFor="edit-description">Description</FieldLabel>
                                    <textarea
                                        id="edit-description"
                                        value={form?.Description ?? ''}
                                        onChange={(e) => updateField('Description', e.target.value)}
                                        className={`${inputClass} bg-white resize-vertical min-h-[88px]`}
                                        placeholder="Enter item description..."
                                        rows={3}
                                        maxLength={255}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <FieldLabel htmlFor="edit-brand">Brand</FieldLabel>
                                        <textarea
                                            id="edit-brand"
                                            value={form?.Brand ?? ''}
                                            onChange={(e) => updateField('Brand', e.target.value)}
                                            className={`${inputClass} bg-white resize-vertical min-h-[38px] max-h-[120px]`}
                                            placeholder="e.g. Dell, Canon..."
                                            rows={1}
                                            maxLength={100}
                                        />
                                    </div>
                                    <div>
                                        <FieldLabel htmlFor="edit-model">Model</FieldLabel>
                                        <textarea
                                            id="edit-model"
                                            value={form?.ModelNumber ?? ''}
                                            onChange={(e) => updateField('ModelNumber', e.target.value)}
                                            className={`${inputClass} bg-white resize-vertical min-h-[38px] max-h-[120px]`}
                                            placeholder="e.g. XPS 15, EOS R..."
                                            rows={1}
                                            maxLength={100}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <FieldLabel
                                        htmlFor="edit-serial"
                                        badge={
                                            isSiblingsMode ? (
                                                <span className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded normal-case tracking-normal">
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
                                        className={`${inputClass} resize-vertical min-h-[38px] max-h-[120px] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed bg-white`}
                                        placeholder="Enter serial number..."
                                        rows={1}
                                        maxLength={100}
                                    />
                                </div>

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
                                        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 text-amber-800 rounded-lg px-3 py-2.5 text-xs">
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                            <p>
                                                <span className="font-semibold">{siblingCount} other matching item lines</span> won't receive these field modifications.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'condition' && (
                            <div className="space-y-3 animate-in fade-in duration-100">
                                {inventoryQuery.isLoading ? (
                                    <div className="py-12 text-center text-xs text-slate-400 font-medium">Resolving individual operational units...</div>
                                ) : assetInstances.length === 0 ? (
                                    <div className="py-12 text-center text-xs text-slate-400">No individual component lines registered under this asset type.</div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <th className="px-4 py-3">Property Number</th>
                                                    <th className="px-4 py-3">Serial Number</th>
                                                    <th className="px-4 py-3 text-right">Condition Toggle Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                                                {assetInstances.map((inst) => {
                                                    const currentCondition = localConditions[inst.InventoryDetailID] || 'Serviceable';
                                                    const isItemProcessing = savingConditionId === inst.InventoryDetailID;

                                                    return (
                                                        <tr key={inst.InventoryDetailID} className={`hover:bg-slate-50/40 transition-colors ${inst.InventoryDetailID === item?.id ? 'bg-blue-50/10 font-medium' : ''}`}>
                                                            <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                                                                {inst.PropertyNumber || <span className="text-slate-300 font-normal">No Prop #</span>}
                                                                {inst.InventoryDetailID === item?.id && (
                                                                    <span className="ml-1.5 text-[9px] bg-blue-100 text-blue-700 px-1 py-0.2 rounded font-sans font-medium">Focused Target</span>
                                                                )}
                                                            </td>

                                                            <td className="px-4 py-3 font-mono text-slate-500">
                                                                {inst.SerialNumber || <span className="text-slate-300 font-normal">--</span>}
                                                            </td>

                                                            <td className="px-4 py-3 text-right">
                                                                <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                                                    <button
                                                                        type="button"
                                                                        disabled={isItemProcessing}
                                                                        onClick={() => handleToggleCondition(inst.InventoryDetailID, 'Serviceable')}
                                                                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all ${currentCondition === 'Serviceable'
                                                                            ? 'bg-white text-emerald-700 shadow-sm'
                                                                            : 'text-slate-400 hover:text-slate-600'
                                                                            }`}
                                                                    >
                                                                        <CheckCircle2 className={`w-3 h-3 ${currentCondition === 'Serviceable' ? 'text-emerald-600' : ''}`} />
                                                                        Serviceable
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isItemProcessing}
                                                                        onClick={() => handleToggleCondition(inst.InventoryDetailID, 'Unserviceable')}
                                                                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all ${currentCondition === 'Unserviceable'
                                                                            ? 'bg-white text-rose-600 shadow-sm'
                                                                            : 'text-slate-400 hover:text-slate-600'
                                                                            }`}
                                                                    >
                                                                        <AlertTriangle className={`w-3 h-3 ${currentCondition === 'Unserviceable' ? 'text-rose-500' : ''}`} />
                                                                        Unserviceable
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end items-center gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-white">
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none"
                            >
                                {activeTab === 'condition' ? 'Close Control' : 'Cancel'}
                            </button>
                        </Dialog.Close>

                        {activeTab === 'details' && (
                            <button
                                type="button"
                                onClick={handleSaveDetails}
                                disabled={isPending || !form}
                                className="px-4 py-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-900"
                            >
                                {isPending ? 'Saving…' : 'Save Changes'}
                            </button>
                        )}
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