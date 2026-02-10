'use client';

import React, { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { Package, Hash, Calculator } from 'lucide-react';

const itemSchema = z.object({
    item_description: z.string().min(1, 'Item description is required'),
    brand: z.string().optional(),
    model_number: z.string().optional(),
    serial_number: z.string().optional(),
    property_type_id: z.number().int().min(1, 'Property type is required'),
    unit_of_measure_id: z.number().int().min(1, 'Unit is required'),
    quantity_delivered: z.number().int().min(1, 'Quantity must be at least 1'),
    unit_cost: z.number().min(0),
}).superRefine((data, ctx) => {
    const serial = data.serial_number?.trim();
    if (serial && data.quantity_delivered > 1) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['quantity_delivered'],
            message: 'Quantity must be 1 when a serial number is provided',
        });
    }
});

export type ItemFormValues = z.infer<typeof itemSchema>;

interface ItemDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialValues: Partial<ItemFormValues>;
    propertyTypes: { PropertyTypeID: number; PropertyName: string }[];
    units: { id: number; name: string }[];
    onSave: (values: ItemFormValues) => Promise<void> | void;
    loading?: boolean;
}

export function ItemDetailsModal({ open, onOpenChange, initialValues, propertyTypes, units, onSave, loading = false }: ItemDetailsModalProps) {
    const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        defaultValues: {
            item_description: '',
            brand: '',
            model_number: '',
            serial_number: '',
            property_type_id: 0,
            unit_of_measure_id: 1,
            quantity_delivered: 1,
            unit_cost: 0,
            ...initialValues,
        }
    });

    const quantity = watch('quantity_delivered');
    const unitCost = watch('unit_cost');
    const totalCost = (quantity || 0) * (unitCost || 0);

    // Use ref to track previous open state
    const prevOpenRef = useRef(open);

    React.useEffect(() => {
        // Only reset when modal opens (transitions from false to true)
        if (open && !prevOpenRef.current) {
            reset({
                ...initialValues,
                item_description: initialValues.item_description && initialValues.item_description !== '0' ? initialValues.item_description : '',
                brand: initialValues.brand && initialValues.brand !== '0' ? initialValues.brand : '',
                model_number: initialValues.model_number && initialValues.model_number !== '0' ? initialValues.model_number : '',
                serial_number: initialValues.serial_number && initialValues.serial_number !== '0' ? initialValues.serial_number : '',
            });
        }
        prevOpenRef.current = open;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialValues]);

    const submit = handleSubmit(async (data) => {
        try {
            await onSave(data);
            toast.success('Item saved successfully');
            onOpenChange(false);
        } catch (e) {
            toast.error('Failed to save item');
            console.error(e);
        }
    });

    return (
        <Dialog
            title="Item Details"
            description="Configure the delivered item specifications"
            open={open}
            onOpenChange={onOpenChange}
            onConfirm={submit}
            confirmText="Save Item"
            cancelText="Cancel"
            loading={loading}
            contentClassName="w-[95vw] md:w-[900px] lg:w-[1100px] !max-w-none max-h-[90vh] overflow-y-auto"
        >
            <div className="space-y-6">
                {/* Item Description */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[var(--primary)]" />
                        <label className="text-sm font-semibold text-slate-900">Item Description</label>
                    </div>
                    <Input
                        {...register('item_description')}
                        placeholder="Enter item description"
                        error={errors.item_description?.message}
                    />
                </div>

                {/* Property Type & Unit of Measure */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900">Property Type</label>
                        <select
                            {...register('property_type_id', { valueAsNumber: true })}
                            className="w-full px-4 py-2.5 bg-white border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-200"
                        >
                            <option value={0}>Select property type...</option>
                            {propertyTypes.map(pt => (
                                <option key={pt.PropertyTypeID} value={pt.PropertyTypeID}>{pt.PropertyName}</option>
                            ))}
                        </select>
                        {errors.property_type_id && (
                            <p className="text-sm text-[var(--error)]">{errors.property_type_id.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900">Unit of Measure</label>
                        <select
                            {...register('unit_of_measure_id', { valueAsNumber: true })}
                            className="w-full px-4 py-2.5 bg-white border-2 border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-200"
                        >
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Equipment Details - optional */}
                <div className="space-y-4">
                    <div className="border-t border-slate-200 pt-4">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <Hash className="w-4 h-4 text-[var(--primary)]" />
                            Equipment Specifications (Optional)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                {...register('brand')}
                                label="Brand"
                                placeholder="e.g., Dell, HP"
                            />
                            <Input
                                {...register('model_number')}
                                label="Model Number"
                                placeholder="e.g., OptiPlex 7090"
                            />
                            <div>
                                <Input
                                    {...register('serial_number')}
                                    label="Serial Number"
                                    placeholder="e.g., SN123456789"
                                />
                                <p className="mt-1 text-xs text-slate-500">If you enter a serial number, quantity must be 1.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quantity & Cost */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900">Quantity Delivered</label>
                        <Input
                            {...register('quantity_delivered', { valueAsNumber: true })}
                            type="number"
                            min={1}
                            placeholder="Enter quantity"
                            error={errors.quantity_delivered?.message}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-slate-900">Unit Cost (₱)</label>
                        </div>
                        <Input
                            {...register('unit_cost', { valueAsNumber: true })}
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0.00"
                            error={errors.unit_cost?.message}
                        />
                    </div>
                </div>

                {/* Total Cost Display */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-[var(--primary)]" />
                            <span className="text-sm font-semibold text-slate-900">Total Cost</span>
                        </div>
                        <span className="text-lg font-bold text-[var(--primary)]">
                            ₱{totalCost.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}
                        </span>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}
