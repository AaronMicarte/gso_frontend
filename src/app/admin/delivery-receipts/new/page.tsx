'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateDeliveryReceipt } from '@/lib/hooks/useDeliveryReceipts';
import { usePurchaseOrders } from '@/lib/hooks/usePurchaseOrders';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';

const drItemSchema = z.object({
    ItemDescription: z.string().min(1, 'Description is required'),
    Quantity: z.number().min(1, 'Quantity must be at least 1'),
    UnitCost: z.number().min(0, 'Unit Cost must be non-negative'),
    Remarks: z.string().optional(),
});

const drSchema = z.object({
    DRNumber: z.string().min(1, 'DR Number is required'),
    PurchaseOrderID: z.number().min(1, 'Purchase Order is required'),
    DRDate: z.string().min(1, 'DR Date is required'),
    DeliveryDate: z.string().optional(),
    InvoiceNumber: z.string().optional(),
    Remarks: z.string().optional(),
    items: z.array(drItemSchema).min(1, 'At least one item is required'),
});

type DRFormValues = z.infer<typeof drSchema>;

export default function CreateDeliveryReceiptPage() {
    const router = useRouter();
    const createMutation = useCreateDeliveryReceipt();

    // Fetch Approved POs (status = 2 for approved)
    const { data: posData, isLoading: isLoadingPOs } = usePurchaseOrders({
        status: 2,
        per_page: 100
    });

    const {
        register,
        control,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<DRFormValues>({
        resolver: zodResolver(drSchema),
        defaultValues: {
            DRNumber: '',
            DRDate: new Date().toISOString().split('T')[0],
            items: [],
        },
    });

    const { fields, append, remove, replace } = useFieldArray({
        control,
        name: 'items',
    });

    const selectedPOId = watch('PurchaseOrderID');

    // Find selected PO to populate items
    const selectedPO = posData?.data?.find(po => po.PurchaseOrderID === selectedPOId);

    useEffect(() => {
        if (selectedPO && selectedPO.details) {
            const items = selectedPO.details.map(d => ({
                ItemDescription: d.ItemDescription,
                Quantity: d.Quantity,
                UnitCost: d.UnitCost,
                Remarks: d.Remarks || '',
            }));
            replace(items);
        }
    }, [selectedPO, replace]);

    const items = watch('items');
    const totalAmount = items?.reduce((sum, item) => {
        return sum + (item.Quantity * item.UnitCost || 0);
    }, 0) || 0;

    const onSubmit = (data: DRFormValues) => {
        createMutation.mutate(data, {
            onSuccess: () => {
                router.push('/admin/delivery-receipts');
            },
        });
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Create Delivery Receipt</h1>
                    <p className="text-slate-500 text-sm">Record delivery receipt from supplier</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                DR Number *
                            </label>
                            <input
                                {...register('DRNumber')}
                                type="text"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                placeholder="Enter DR number"
                            />
                            {errors.DRNumber && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.DRNumber.message}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Purchase Order *
                            </label>
                            <select
                                {...register('PurchaseOrderID', { valueAsNumber: true })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            >
                                <option value="">Select Purchase Order</option>
                                {isLoadingPOs ? (
                                    <option disabled>Loading...</option>
                                ) : (
                                    posData?.data?.map((po) => (
                                        <option key={po.PurchaseOrderID} value={po.PurchaseOrderID}>
                                            {po.PONumber} - {po.supplier?.SupplierName}
                                        </option>
                                    ))
                                )}
                            </select>
                            {errors.PurchaseOrderID && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.PurchaseOrderID.message}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                DR Date *
                            </label>
                            <input
                                {...register('DRDate')}
                                type="date"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                            {errors.DRDate && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.DRDate.message}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Delivery Date
                            </label>
                            <input
                                {...register('DeliveryDate')}
                                type="date"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Invoice Number
                            </label>
                            <input
                                {...register('InvoiceNumber')}
                                type="text"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                placeholder="Enter invoice number"
                            />
                        </div>
                    </div>

                    <div className="mt-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Remarks
                        </label>
                        <textarea
                            {...register('Remarks')}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            placeholder="Enter remarks"
                        />
                    </div>
                </div>

                {/* Items */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Items</h2>
                        <button
                            type="button"
                            onClick={() => append({
                                ItemDescription: '',
                                Quantity: 1,
                                UnitCost: 0,
                                Remarks: '',
                            })}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors text-sm font-medium"
                        >
                            <Plus className="w-3 h-3" />
                            Add Item
                        </button>
                    </div>

                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="border border-slate-200 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-4">
                                    <h3 className="text-sm font-medium text-slate-900">Item {index + 1}</h3>
                                    {fields.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            className="text-red-600 hover:text-red-700 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Description *
                                        </label>
                                        <input
                                            {...register(`items.${index}.ItemDescription`)}
                                            type="text"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                            placeholder="Enter item description"
                                        />
                                        {errors.items?.[index]?.ItemDescription && (
                                            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                {errors.items[index]?.ItemDescription?.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Quantity *
                                        </label>
                                        <input
                                            {...register(`items.${index}.Quantity`, { valueAsNumber: true })}
                                            type="number"
                                            min="1"
                                            step="1"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                        />
                                        {errors.items?.[index]?.Quantity && (
                                            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                {errors.items[index]?.Quantity?.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Unit Cost *
                                        </label>
                                        <input
                                            {...register(`items.${index}.UnitCost`, { valueAsNumber: true })}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                        />
                                        {errors.items?.[index]?.UnitCost && (
                                            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                {errors.items[index]?.UnitCost?.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Remarks
                                        </label>
                                        <input
                                            {...register(`items.${index}.Remarks`)}
                                            type="text"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                            placeholder="Enter remarks"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {errors.items && typeof errors.items.message === 'string' && (
                        <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.items.message}
                        </p>
                    )}
                </div>

                {/* Summary */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Total Amount</h3>
                            <p className="text-sm text-slate-600">Total value of delivery receipt</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-slate-900">
                                ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || createMutation.isPending}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting || createMutation.isPending ? (
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