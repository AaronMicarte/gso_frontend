'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useUpdateInventoryDetail, useInventory } from '@/lib/hooks/useInventory';
import type { InventoryDetailEditData } from '@/lib/api/inventory';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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

export function EditInventoryDetailModal({ open, onOpenChange, item }: EditInventoryDetailModalProps) {
    const updateInventoryDetail = useUpdateInventoryDetail();
    const [form, setForm] = useState<InventoryDetailEditForm | null>(null);
    const [applyScope, setApplyScope] = useState<'this' | 'siblings'>('this');

    const inventoryQuery = useInventory(form?.inventoryId || 0);

    useEffect(() => {
        if (open && item) {
            setForm({ ...item });
            setApplyScope('this'); // Reset to default scope when opening
        } else if (!open) {
            setForm(null);
        }
    }, [open, item]);

    const handleCancel = () => {
        onOpenChange(false);
    };

    const handleSave = async () => {
        if (!form) return;

        // Base payload for common attributes
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
                const details = inventoryQuery.data?.details || [];
                const matchKey = (form.articleName ?? '').trim().toLowerCase();
                const siblings = details.filter(d => {
                    const name = (d.dr_article_name || d.PropertyName || '').trim().toLowerCase();
                    return name && matchKey && name === matchKey;
                });

                if (siblings.length === 0) {
                    await updateInventoryDetail.mutateAsync({ id: form.id, data: payload });
                    toast.success('Item details updated successfully');
                } else {
                    // Create a separate payload for siblings that EXCLUDES the serial number modification
                    const { SerialNumber, ...siblingPayload } = payload;

                    await Promise.all(
                        siblings.map(s => {
                            // If it's the exact item the user is editing, we can update its serial.
                            // For other items, we only update description/brand/model.
                            const dataToSave = s.InventoryDetailID === form.id ? payload : siblingPayload;
                            return updateInventoryDetail.mutateAsync({
                                id: s.InventoryDetailID,
                                data: dataToSave as InventoryDetailEditData
                            });
                        })
                    );
                    toast.success(`Updated ${siblings.length} item${siblings.length > 1 ? 's' : ''} successfully`);
                }
            }

            onOpenChange(false);
        } catch (err) {
            toast.error('Failed to update item details');
        }
    };

    const updateField = (field: keyof Omit<InventoryDetailEditForm, 'id'>, value: string) => {
        setForm((prev) => (prev ? { ...prev, [field]: value } : null));
    };

    const isSiblingsMode = applyScope === 'siblings';

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                {/* Fixed Overlay with smooth fade class */}
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 transition-opacity animate-in fade-in duration-200" />
                <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                    <div>
                        <Dialog.Title className="text-lg font-bold text-slate-900">Edit Item Details</Dialog.Title>
                        <Dialog.Description className="text-sm text-slate-500 mt-1">
                            Update the description, brand, model, and serial number for this inventory item.
                        </Dialog.Description>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="edit-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                                Description
                            </label>
                            <textarea
                                id="edit-description"
                                value={form?.Description ?? ''}
                                onChange={(e) => updateField('Description', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-vertical min-h-[90px] text-sm"
                                placeholder="Enter item description..."
                                rows={3}
                                maxLength={255}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="edit-brand" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                                    Brand
                                </label>
                                <input
                                    id="edit-brand"
                                    type="text"
                                    value={form?.Brand ?? ''}
                                    onChange={(e) => updateField('Brand', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                                    placeholder="Enter brand..."
                                    maxLength={100}
                                />
                            </div>

                            <div>
                                <label htmlFor="edit-model" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                                    Model
                                </label>
                                <input
                                    id="edit-model"
                                    type="text"
                                    value={form?.ModelNumber ?? ''}
                                    onChange={(e) => updateField('ModelNumber', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                                    placeholder="Enter model..."
                                    maxLength={100}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="edit-serial" className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                                <span>Serial Number</span>
                                {isSiblingsMode && (
                                    <span className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded normal-case tracking-normal animate-in fade-in duration-150">
                                        Serial Numbers cannot be bulk-edited
                                    </span>
                                )}
                            </label>
                            <input
                                id="edit-serial"
                                type="text"
                                // Revert to original individual item serial if bulk-editing siblings
                                value={isSiblingsMode ? (item?.SerialNumber ?? '') : (form?.SerialNumber ?? '')}
                                onChange={(e) => updateField('SerialNumber', e.target.value)}
                                disabled={isSiblingsMode}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed transition-all"
                                placeholder="Enter serial number..."
                                maxLength={100}
                            />
                        </div>

                        {/* Enhanced Save Scope Selector Block */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 mt-2">
                            <span className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                Apply Changes To:
                            </span>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="radio"
                                        name="applyScope"
                                        checked={applyScope === 'this'}
                                        onChange={() => setApplyScope('this')}
                                        className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                    />
                                    <span>This item only</span>
                                </label>
                                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="radio"
                                        name="applyScope"
                                        checked={applyScope === 'siblings'}
                                        onChange={() => setApplyScope('siblings')}
                                        className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                    />
                                    <span>All identical sibling rows</span>
                                </label>
                            </div>
                        </div>

                        {/* Standard Action Bottom Bar */}
                        <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
                                >
                                    Cancel
                                </button>
                            </Dialog.Close>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={updateInventoryDetail.isPending || !form}
                                className="px-4 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                            >
                                {updateInventoryDetail.isPending ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
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