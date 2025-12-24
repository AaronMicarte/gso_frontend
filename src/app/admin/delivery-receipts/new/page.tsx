'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from 'zod';
import { useCreateDeliveryReceipt } from '@/lib/hooks/useDeliveryReceipts';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getPropertyTypes } from '@/lib/api/procurement/deliveryReceipts';

const drItemSchema = z.object({
    item_description: z.string().min(1, 'Item description is required'),
    property_type_id: z.number().min(1, 'Property type is required'),
    quantity_delivered: z.number().min(1, 'Quantity must be at least 1'),
    unit_cost: z.number().min(0, 'Unit cost must be non-negative'),
});

const drSchema = z.object({
    supplier_name: z.string().min(1, 'Supplier name is required'),
    po_number: z.string().min(1, 'PO number is required'),
    invoice_number: z.string().optional(),
    date_received: z.string().min(1, 'Date received is required'),
    remarks: z.string().optional(),
    details: z.array(drItemSchema).min(1, 'At least one item is required'),
});

type DRFormValues = z.infer<typeof drSchema>;

interface Supplier {
    SupplierID: number;
    SupplierName: string;
}

interface PropertyType {
    PropertyTypeID: number;
    PropertyName: string;
}

export default function CreateDeliveryReceiptPage() {
    const router = useRouter();
    const createMutation = useCreateDeliveryReceipt();
    const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const {
        register,
        control,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<DRFormValues>({
        resolver: zodResolver(drSchema),
        defaultValues: {
            supplier_name: '',
            po_number: '',
            invoice_number: '',
            date_received: new Date().toISOString().split('T')[0],
            remarks: '',
            details: [
                {
                    item_description: '',
                    property_type_id: 0,
                    quantity_delivered: 1,
                    unit_cost: 0,
                }
            ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'details',
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoadingData(true);
                const propertyTypesData = await getPropertyTypes();
                setPropertyTypes(propertyTypesData);
            } catch (error) {
                toast.error('Failed to load form data');
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, []);

    const details = watch('details');
    const totalAmount = details?.reduce((sum, item) => {
        return sum + (item.quantity_delivered * item.unit_cost || 0);
    }, 0) || 0;

    const onSubmit = async (data: DRFormValues) => {
        try {
            await createMutation.mutateAsync(data);
            toast.success('Delivery receipt created successfully');
            router.push('/admin/delivery-receipts');
        } catch (error) {
            toast.error('Failed to create delivery receipt');
        }
    };

    const addItem = () => {
        append({
            item_description: '',
            property_type_id: 0,
            quantity_delivered: 1,
            unit_cost: 0,
        });
    };

    if (isLoadingData) {
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
                    <p className="text-slate-500 text-sm">Record delivery receipt from supplier manually</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                PO Number *
                            </label>
                            <input
                                {...register('po_number')}
                                type="text"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                placeholder="Enter PO number"
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
                        </div>

                        {/* Date Received */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Date Received *
                            </label>
                            <input
                                {...register('date_received')}
                                type="date"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
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
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Property Type</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Quantity</th>
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
                                            <input
                                                {...register(`details.${index}.item_description`)}
                                                type="text"
                                                className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 text-sm"
                                                placeholder="Enter item description"
                                            />
                                            {errors.details?.[index]?.item_description && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errors.details[index]?.item_description?.message}
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-3 px-3">
                                            <select
                                                {...register(`details.${index}.property_type_id`, { valueAsNumber: true })}
                                                className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 text-sm"
                                            >
                                                <option value={0}>Select Type</option>
                                                {propertyTypes.map((type) => (
                                                    <option key={type.PropertyTypeID} value={type.PropertyTypeID}>
                                                        {type.PropertyName}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.details?.[index]?.property_type_id && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errors.details[index]?.property_type_id?.message}
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-3 px-3">
                                            <input
                                                {...register(`details.${index}.quantity_delivered`, { valueAsNumber: true })}
                                                type="number"
                                                min="1"
                                                step="1"
                                                className="w-20 px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 text-sm"
                                            />
                                            {errors.details?.[index]?.quantity_delivered && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errors.details[index]?.quantity_delivered?.message}
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-3 px-3">
                                            <input
                                                {...register(`details.${index}.unit_cost`, { valueAsNumber: true })}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="w-24 px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 text-sm"
                                            />
                                            {errors.details?.[index]?.unit_cost && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errors.details[index]?.unit_cost?.message}
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-sm font-medium text-slate-700">
                                            ₱{((details[index]?.quantity_delivered || 0) * (details[index]?.unit_cost || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3 px-3">
                                            {fields.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
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

                    {errors.details && (
                        <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.details.message}
                        </p>
                    )}
                </div>

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
