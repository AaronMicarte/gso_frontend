'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useUpdateInventoryDetail } from '@/lib/hooks/useInventory';
import type { InventoryDetailEditData } from '@/lib/api/inventory';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export type InventoryDetailEditForm = {
    id: number;
    Description: string;
    Brand: string;
    ModelNumber: string;
    SerialNumber: string;
};

type EditInventoryDetailModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: InventoryDetailEditForm | null;
};

export function EditInventoryDetailModal({ open, onOpenChange, item }: EditInventoryDetailModalProps) {
    const updateInventoryDetail = useUpdateInventoryDetail();
    const [form, setForm] = useState<InventoryDetailEditForm | null>(null);

    useEffect(() => {
        if (open && item) {
            setForm({ ...item });
        } else if (!open) {
            setForm(null);
        }
    }, [open, item]);

    const handleCancel = () => {
        onOpenChange(false);
    };

    const handleSave = async () => {
        if (!form) return;

        const payload: InventoryDetailEditData = {
            Description: form.Description,
            Brand: form.Brand,
            ModelNumber: form.ModelNumber,
            SerialNumber: form.SerialNumber,
        };

        try {
            await updateInventoryDetail.mutateAsync({
                id: form.id,
                data: payload,
            });
            toast.success('Item details updated successfully');
            onOpenChange(false);
        } catch {
            toast.error('Failed to update item details');
        }
    };

    const updateField = (field: keyof Omit<InventoryDetailEditForm, 'id'>, value: string) => {
        setForm((prev) => (prev ? { ...prev, [field]: value } : null));
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
                <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
                    <Dialog.Title className="text-lg font-bold text-slate-900">Edit Item Details</Dialog.Title>
                    <Dialog.Description className="text-sm text-slate-600">
                        Update the description, brand, model, and serial number for this inventory item.
                    </Dialog.Description>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="edit-description" className="block text-sm font-medium text-slate-700 mb-1">
                                Description
                            </label>
                            <textarea
                                id="edit-description"
                                value={form?.Description ?? ''}
                                onChange={(e) => updateField('Description', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[100px]"
                                placeholder="Enter item description..."
                                rows={4}
                                maxLength={255}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="edit-brand" className="block text-sm font-medium text-slate-700 mb-1">
                                    Brand
                                </label>
                                <input
                                    id="edit-brand"
                                    type="text"
                                    value={form?.Brand ?? ''}
                                    onChange={(e) => updateField('Brand', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter brand..."
                                    maxLength={100}
                                />
                            </div>

                            <div>
                                <label htmlFor="edit-model" className="block text-sm font-medium text-slate-700 mb-1">
                                    Model
                                </label>
                                <input
                                    id="edit-model"
                                    type="text"
                                    value={form?.ModelNumber ?? ''}
                                    onChange={(e) => updateField('ModelNumber', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter model..."
                                    maxLength={100}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="edit-serial" className="block text-sm font-medium text-slate-700 mb-1">
                                Serial Number
                            </label>
                            <input
                                id="edit-serial"
                                type="text"
                                value={form?.SerialNumber ?? ''}
                                onChange={(e) => updateField('SerialNumber', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter serial number..."
                                maxLength={100}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </Dialog.Close>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={updateInventoryDetail.isPending || !form}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                            >
                                {updateInventoryDetail.isPending ? 'Saving...' : 'Save'}
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
    Description?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
}): InventoryDetailEditForm {
    return {
        id: item.InventoryDetailID,
        Description: item.Description ?? '',
        Brand: item.Brand ?? '',
        ModelNumber: item.ModelNumber ?? '',
        SerialNumber: item.SerialNumber ?? '',
    };
}
