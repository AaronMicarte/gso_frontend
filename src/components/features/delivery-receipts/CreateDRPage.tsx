'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deliveryReceiptKeys } from '@/lib/hooks/useDeliveryReceipts';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from 'zod';
import { useCreateDeliveryReceipt } from '@/lib/hooks/useDeliveryReceipts';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitsOfMeasure';
import { ItemDetailsModal } from './ItemDetailsModal';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Loader2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { getPropertyTypes } from '@/lib/api/deliveryReceipts';
import { formatInTimeZone } from 'date-fns-tz';

const drItemSchema = z.object({
    item_description: z.string().min(1, 'Item description is required'),
    brand: z.string().optional(),
    model_number: z.string().optional(),
    serial_number: z.string().optional(),
    property_type_id: z.number().min(1, 'Property type is required'),
    remarks: z.string().optional(),
    unit_of_measure_id: z.number().min(1, 'Unit of measure is required'),
    quantity_delivered: z.number().min(1, 'Quantity must be at least 1'),
    unit_cost: z.number().min(0, 'Unit cost must be non-negative'),
});

const drSchema = z.object({
    dr_number: z.string().min(1, 'DR number is required'),
    supplier_name: z.string().min(1, 'Supplier name is required'),
    po_number: z.string().optional(), // OPTIONAL - just for reference
    invoice_number: z.string().optional(),
    date_received: z.string().min(1, 'Date received is required'),
    override_past_limit: z.boolean().optional(),
    remarks: z.string().optional(),
    details: z.array(drItemSchema).min(1, 'At least one item is required'),
});

type DRFormValues = z.infer<typeof drSchema>;

interface PropertyType {
    PropertyTypeID: number;
    PropertyName: string;
}

interface CreateDRPageProps {
    baseRoute: string;
}

export function CreateDRPage({ baseRoute }: CreateDRPageProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const createMutation = useCreateDeliveryReceipt();
    const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Manila today's date (YYYY-MM-DD) for client-side max date and validation
    const manilaToday = formatInTimeZone(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
    // Manila minimum allowed date (5 years back)
    const manilaMinDate = new Date();
    manilaMinDate.setFullYear(manilaMinDate.getFullYear() - 5);
    const manilaMin = formatInTimeZone(manilaMinDate, 'Asia/Manila', 'yyyy-MM-dd');

    const {
        register,
        control,
        handleSubmit,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<DRFormValues>({
        resolver: zodResolver(drSchema),
        defaultValues: {
            dr_number: '',
            supplier_name: '',
            po_number: '',
            invoice_number: '',
            date_received: manilaToday,
            override_past_limit: false,
            remarks: '',
            details: [],
        },
    });

    const { fields, append, remove, update } = useFieldArray({
        control,
        name: 'details',
    });

    // Modal state for editing a single item; add-only flag for creating new items
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isAddingItem, setIsAddingItem] = useState(false);

    const updateRow = (index: number) => {
        setIsAddingItem(false);
        setEditingIndex(index);
        setIsItemModalOpen(true);
    };

    const handleSaveItem = async (values: z.infer<typeof drItemSchema>) => {
        try {
            if (isAddingItem) {
                // append only when user saves the new item from the modal
                append(values);
                setIsAddingItem(false);
            } else {
                if (editingIndex === null) return;
                update(editingIndex, values);
            }
        } finally {
            setIsItemModalOpen(false);
            setEditingIndex(null);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoadingData(true);
                const propertyTypesData = await getPropertyTypes();
                setPropertyTypes(propertyTypesData);
            } catch {
                toast.error('Failed to load form data');
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, []);

    // Units of measure for items
    const { data: unitsData, isLoading: isLoadingUnits } = useAllUnitsOfMeasure();
    // API returns UnitOfMeasureResource (id,name) — normalize to {id, name} to be safe
    type UnitOfMeasureResponse = { id?: number; name?: string; UnitOfMeasureID?: number; UnitName?: string };
    const units = Array.isArray(unitsData)
        ? (unitsData as UnitOfMeasureResponse[])
            .filter(u => u && (u.id ?? u.UnitOfMeasureID))
            .map(u => ({ id: u.id ?? u.UnitOfMeasureID!, name: u.name ?? u.UnitName! }))
        : [];

    const details = watch('details');
    const totalAmount = details?.reduce((sum, item) => {
        return sum + (item.quantity_delivered * (item.unit_cost || 0));
    }, 0) || 0;

    const onSubmit = async (data: DRFormValues) => {
        // client-side checks: prevent future dates and too-old dates (unless override requested)
        if (data.date_received > manilaToday) {
            toast.error('Date received cannot be in the future.');
            return;
        }
        if (data.date_received < manilaMin && !data.override_past_limit) {
            toast.error(`Date received is too old. Minimum allowed is ${manilaMin}.`);
            return;
        }

        try {
            await createMutation.mutateAsync(data);
            toast.success('Delivery receipt created successfully');

            // Ensure the delivery receipts list is refreshed before navigating
            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });

            router.push(`${baseRoute}/delivery-receipts`);
        } catch (err: any) {
            const resp = err?.response?.data;
            if (resp?.errors) {
                // Map Laravel validation errors to react-hook-form setError
                Object.entries(resp.errors).forEach(([field, messages]) => {
                    const message = Array.isArray(messages) ? (messages as any)[0] : String(messages);
                    try {
                        // field names from Laravel already come in dot notation (e.g. details.0.item_description)
                        setError(field as any, { type: 'server', message });
                    } catch (e) {
                        // ignore setError failures for weird keys
                    }
                });
                toast.error('Validation failed — please fix the highlighted fields');
                return;
            }

            toast.error('Failed to create delivery receipt');
        }
    };

    const addItem = () => {
        // Do not append immediately — open the modal and append only on save
        setIsAddingItem(true);
        setEditingIndex(null);
        setIsItemModalOpen(true);
    };

    const duplicateItem = (index: number) => {
        const item = details[index];
        append({
            item_description: item?.item_description || '',
            brand: item?.brand || '',
            model_number: item?.model_number || '',
            serial_number: item?.serial_number || '',
            property_type_id: item?.property_type_id || 0,
            unit_of_measure_id: item?.unit_of_measure_id || (units.length ? units[0].id : 1),
            quantity_delivered: item?.quantity_delivered || 1,
            unit_cost: item?.unit_cost || 0,
        });
    };

    if (isLoadingData || isLoadingUnits) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mx-auto" />
                    <p className="text-slate-600">Loading form data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    type="button"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Create Delivery Receipt</h1>
                    <p className="text-slate-500 text-sm">Step 1: Record delivery from supplier. IAR (Inspection) comes next.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* DR Number (manual) */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Delivery Receipt Number *
                            </label>
                            <input
                                {...register('dr_number')}
                                type="text"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                placeholder="Enter DR number (manual)"
                            />
                            {errors.dr_number && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.dr_number.message}
                                </p>
                            )}
                        </div>
                        {/* Supplier Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Supplier Name *
                            </label>
                            <input
                                {...register('supplier_name')}
                                type="text"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                placeholder="Enter supplier name manually"
                            />
                            {errors.supplier_name && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.supplier_name.message}
                                </p>
                            )}
                        </div>

                        {/* PO Number */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                PO Number (Optional)
                            </label>
                            <input
                                {...register('po_number')}
                                type="text"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                placeholder="PO reference (if any)"
                            />
                            {errors.po_number && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.po_number.message}
                                </p>
                            )}
                        </div>

                        {/* Invoice Number */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Invoice Number
                            </label>
                            <input
                                {...register('invoice_number')}
                                type="text"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                placeholder="Enter invoice number (optional)"
                            />
                            {errors.invoice_number && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.invoice_number.message}
                                </p>
                            )}
                        </div>

                        {/* Date Received */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Date Received *
                            </label>
                            <input
                                {...register('date_received')}
                                type="date"
                                min={manilaMin}
                                max={manilaToday}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                            <label className="inline-flex items-center mt-2 text-sm">
                                <input {...register('override_past_limit')} type="checkbox" className="mr-2" />
                                <span className="text-slate-600">Allow historic date (admin override)</span>
                            </label>
                            {errors.date_received && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.date_received.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="mt-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Remarks
                        </label>
                        <textarea
                            {...register('remarks')}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                            placeholder="Additional notes or remarks"
                        />
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Items Delivered</h2>
                        <button
                            type="button"
                            onClick={addItem}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Item
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">#</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Item Description</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 min-w-[220px]">Details</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 w-24">Qty</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Unit Cost</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Total Cost</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fields.map((field, index) => (
                                    <tr key={field.id} className="border-b border-slate-100">
                                        <td className="py-3 px-3 text-sm text-slate-600">{index + 1}</td>
                                        <td className="py-3 px-3">
                                            <div className="text-sm text-slate-700">{details[index]?.item_description || '—'}</div>
                                            {errors.details?.[index]?.item_description && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errors.details[index]?.item_description?.message}
                                                </p>
                                            )}
                                        </td>


                                        <td className="py-3 px-3 min-w-[220px]">
                                            <div className="text-sm text-slate-700 font-medium truncate">
                                                {details[index]?.brand || '—'}{details[index]?.model_number ? ` / ${details[index].model_number}` : ''}{details[index]?.serial_number ? ` / ${details[index].serial_number}` : ''}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1 truncate">
                                                {propertyTypes.find(p => p.PropertyTypeID === details[index]?.property_type_id)?.PropertyName || 'No type'}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 w-28 text-center">
                                            <div className="text-sm">{details[index]?.quantity_delivered ?? 0}</div>
                                            <div className="text-xs text-slate-500 mt-1">{units.find(u => u.id === details[index]?.unit_of_measure_id)?.name || ''}</div>
                                            {errors.details?.[index]?.quantity_delivered && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errors.details[index]?.quantity_delivered?.message}
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                            <div className="text-sm">₱{(details[index]?.unit_cost ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                            {errors.details?.[index]?.unit_cost && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errors.details[index]?.unit_cost?.message}
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-sm font-medium text-slate-700">
                                            ₱{((details[index]?.quantity_delivered || 0) * (details[index]?.unit_cost || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3 px-3 flex items-center gap-2">
                                            {(errors.details?.[index]?.property_type_id || errors.details?.[index]?.unit_of_measure_id || errors.details?.[index]?.quantity_delivered || errors.details?.[index]?.item_description) && (
                                                <span className="text-red-600 mr-2" title="Missing required fields">
                                                    <AlertCircle className="w-4 h-4" />
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => updateRow(index)}
                                                title="Edit item"
                                                className="text-slate-500 hover:text-slate-700 transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => duplicateItem(index)}
                                                title="Duplicate item"
                                                className="text-slate-500 hover:text-slate-700 transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>

                                            {fields.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                    title="Remove item"
                                                    className="text-red-600 hover:text-red-700 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {fields.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500 italic">add items</div>
                    ) : errors.details && (
                        <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.details.message}
                        </p>
                    )}
                </div>

                {/* Item Details Modal */}
                <ItemDetailsModal
                    open={isItemModalOpen}
                    onOpenChange={(open) => {
                        setIsItemModalOpen(open);
                        if (!open) setIsAddingItem(false);
                    }}
                    initialValues={isAddingItem ? {} : (editingIndex !== null ? watch(`details.${editingIndex}`) : {})}
                    propertyTypes={propertyTypes}
                    units={units}
                    onSave={handleSaveItem}
                />

                {/* Summary */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Summary</h2>
                    <div className="flex items-center justify-between text-lg">
                        <span className="text-slate-600">Total Amount:</span>
                        <span className="font-bold text-slate-900">
                            ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Create Delivery Receipt
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

