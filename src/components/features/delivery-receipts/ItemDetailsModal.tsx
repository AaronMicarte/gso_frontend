'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from 'sonner';

const itemSchema = z.object({
    item_description: z.string().min(1, 'Item description is required'),
    brand: z.string().optional(),
    model_number: z.string().optional(),
    serial_number: z.string().optional(),
    property_type_id: z.number().int().min(1, 'Property type is required'),
    unit_of_measure_id: z.number().int().min(1, 'Unit is required'),
    quantity_delivered: z.number().int().min(1, 'Quantity must be at least 1'),
    unit_cost: z.number().min(0),
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

    // Watch the property type to conditionally show brand/model/serial fields
    const selectedPropertyTypeId = watch('property_type_id');

    // Property types that should show brand/model/serial fields (same as IAR verification requirements)
    const equipmentPropertyTypeIds = [3, 4, 5]; // IT Equipment, Machinery, Medical Equipment

    const shouldShowBrandModelSerial = selectedPropertyTypeId && equipmentPropertyTypeIds.includes(selectedPropertyTypeId);

    React.useEffect(() => {
        if (open) {
            reset({
                item_description: '',
                brand: '',
                model_number: '',
                serial_number: '',
                property_type_id: 0,
                unit_of_measure_id: 1,
                quantity_delivered: 1,
                unit_cost: 0,
                ...initialValues,
            });
        }
    }, [open, reset]);

    const submit = handleSubmit(async (data) => {
        try {
            await onSave(data);
            toast.success('Item saved');
            onOpenChange(false);
        } catch (e) {
            toast.error('Failed to save item');
            console.error(e);
        }
    });

    return (
        <Dialog
            title="Edit Item"
            description="Update item details"
            open={open}
            onOpenChange={onOpenChange}
            onConfirm={submit}
            confirmText="Save"
            cancelText="Cancel"
            loading={loading}
            contentClassName="max-w-lg"
        >
            <div className="grid grid-cols-1 gap-3">
                <label className="text-sm">
                    <div className="mb-1 font-medium">Item Description</div>
                    <input {...register('item_description')} className="w-full px-3 py-2 border rounded text-sm" />
                    {errors.item_description && <div className="text-xs text-red-600 mt-1">{errors.item_description.message}</div>}
                </label>

                {shouldShowBrandModelSerial && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <label className="text-sm">
                            <div className="mb-1 font-medium">Brand</div>
                            <input {...register('brand')} className="w-full px-3 py-2 border rounded text-sm" />
                        </label>
                        <label className="text-sm">
                            <div className="mb-1 font-medium">Model</div>
                            <input {...register('model_number')} className="w-full px-3 py-2 border rounded text-sm" />
                        </label>
                        <label className="text-sm">
                            <div className="mb-1 font-medium">Serial</div>
                            <input {...register('serial_number')} className="w-full px-3 py-2 border rounded text-sm" />
                        </label>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="text-sm">
                        <div className="mb-1 font-medium">Quantity</div>
                        <input {...register('quantity_delivered', { valueAsNumber: true })} type="number" min={1} className="w-full px-3 py-2 border rounded text-sm" />
                        {errors.quantity_delivered && <div className="text-xs text-red-600 mt-1">{errors.quantity_delivered.message}</div>}
                    </label>
                    <label className="text-sm">
                        <div className="mb-1 font-medium">Property Type</div>
                        <select {...register('property_type_id', { valueAsNumber: true })} className="w-full px-3 py-2 border rounded text-sm">
                            <option value={0}>Select property type...</option>
                            {propertyTypes.map(pt => (
                                <option key={pt.PropertyTypeID} value={pt.PropertyTypeID}>{pt.PropertyName}</option>
                            ))}
                        </select>
                        {errors.property_type_id && <div className="text-xs text-red-600 mt-1">{errors.property_type_id.message}</div>}
                    </label>
                    <label className="text-sm">
                        <div className="mb-1 font-medium">UoM</div>
                        <select {...register('unit_of_measure_id', { valueAsNumber: true })} className="w-full px-3 py-2 border rounded text-sm">
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <label className="text-sm">
                    <div className="mb-1 font-medium">Unit Cost</div>
                    <input {...register('unit_cost', { valueAsNumber: true })} type="number" step="0.01" min={0} className="w-full px-3 py-2 border rounded text-sm" />
                </label>
            </div>
        </Dialog>
    );
}
