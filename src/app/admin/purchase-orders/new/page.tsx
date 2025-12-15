'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreatePurchaseOrder } from '@/lib/hooks/usePurchaseOrders';
import { usePurchaseRequests, usePurchaseRequest } from '@/lib/hooks/usePurchaseRequests';
import { useSuppliers } from '@/lib/hooks/masterData/useSuppliers';
import { Supplier } from '@/types/masterData';
import { PurchaseRequest } from '@/types/procurement';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';

const poItemSchema = z.object({
    ItemDescription: z.string().min(1, 'Description is required'),
    Quantity: z.number().min(1, 'Quantity must be at least 1'),
    UnitCost: z.number().min(0, 'Unit Cost must be non-negative'),
    Remarks: z.string().optional(),
});

const poSchema = z.object({
    PONumber: z.string().min(1, 'PO Number is required'),
    PurchaseRequestID: z.number().min(1, 'Purchase Request is required'),
    SupplierID: z.number().min(1, 'Supplier is required'),
    PODate: z.string().min(1, 'Date is required'),
    ModeOfProcurement: z.string().optional(),
    PlaceOfDelivery: z.string().optional(),
    DateOfDelivery: z.string().optional(),
    DeliveryTerm: z.string().optional(),
    PaymentTerm: z.string().optional(),
    Remarks: z.string().optional(),
    items: z.array(poItemSchema).min(1, 'At least one item is required'),
});

type POFormValues = z.infer<typeof poSchema>;

export default function CreatePurchaseOrderPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const createMutation = useCreatePurchaseOrder();

    // Get PR from URL params
    const prParam = searchParams.get('pr');
    const urlPRId = prParam ? parseInt(prParam) : null;

    // Fetch Approved PRs
    const { data: prsData } = usePurchaseRequests({ status: 2, per_page: 100 });
    const { data: suppliersData } = useSuppliers({ per_page: 100 });

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<POFormValues>({
        resolver: zodResolver(poSchema),
        defaultValues: {
            PONumber: '',
            PODate: new Date().toISOString().split('T')[0],
            items: [],
        },
    });

    const { fields, append, remove, replace } = useFieldArray({
        control,
        name: 'items',
    });

    const selectedPRId = watch('PurchaseRequestID');

    // Set initial PR from URL param
    useEffect(() => {
        if (urlPRId && !selectedPRId) {
            setValue('PurchaseRequestID', urlPRId);
        }
    }, [urlPRId, selectedPRId, setValue]);

    // Fetch details of selected PR to populate items
    const { data: selectedPR, isLoading: isLoadingSelectedPR } = usePurchaseRequest(selectedPRId);

    useEffect(() => {
        if (selectedPR && selectedPR.details) {
            const items = selectedPR.details?.map(d => ({
                ItemDescription: d.ItemDescription || '',
                Quantity: d.Quantity || 1,
                UnitCost: d.UnitCost || 0,
                Remarks: d.Remarks || '',
            })) || [];
            replace(items);
        }
    }, [selectedPR, replace]);

    const items = watch('items');
    const totalAmount = items?.reduce((sum, item) => {
        return sum + (item.Quantity * item.UnitCost || 0);
    }, 0) || 0;

    const onSubmit = (data: POFormValues) => {
        createMutation.mutate(data, {
            onSuccess: () => {
                router.push('/admin/purchase-orders');
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
                    <ArrowLeft className="w-6 h-6 text-slate-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Create Purchase Order</h1>
                    <p className="text-slate-500 text-sm">Generate a new PO from an approved Purchase Request</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* General Info */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-4">
                        General Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">PO Number</label>
                            <input
                                {...register('PONumber')}
                                placeholder="e.g., PO-2024-001"
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${errors.PONumber ? 'border-red-500' : 'border-slate-200'
                                    }`}
                            />
                            {errors.PONumber && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {errors.PONumber.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">PO Date</label>
                            <input
                                type="date"
                                {...register('PODate')}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${errors.PODate ? 'border-red-500' : 'border-slate-200'
                                    }`}
                            />
                            {errors.PODate && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {errors.PODate.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Purchase Request (Approved)</label>
                            <select
                                {...register('PurchaseRequestID', { valueAsNumber: true })}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${errors.PurchaseRequestID ? 'border-red-500' : 'border-slate-200'
                                    }`}
                            >
                                <option value="">Select PR...</option>
                                {prsData?.data?.map((pr: PurchaseRequest) => (
                                    <option key={pr.PurchaseRequestID} value={pr.PurchaseRequestID}>
                                        {pr.PRNumber} - {pr.Purpose}
                                    </option>
                                ))}
                            </select>
                            {errors.PurchaseRequestID && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {errors.PurchaseRequestID.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Supplier</label>
                            <select
                                {...register('SupplierID', { valueAsNumber: true })}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${errors.SupplierID ? 'border-red-500' : 'border-slate-200'
                                    }`}
                            >
                                <option value="">Select Supplier...</option>
                                {suppliersData?.data?.map((supplier: Supplier) => (
                                    <option key={supplier.SupplierID} value={supplier.SupplierID}>
                                        {supplier.SupplierName}
                                    </option>
                                ))}
                            </select>
                            {errors.SupplierID && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {errors.SupplierID.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Mode of Procurement</label>
                            <input
                                {...register('ModeOfProcurement')}
                                placeholder="e.g., Public Bidding, SVP"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Place of Delivery</label>
                            <input
                                {...register('PlaceOfDelivery')}
                                placeholder="e.g., GSO Warehouse"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Date of Delivery</label>
                            <input
                                {...register('DateOfDelivery')}
                                placeholder="e.g., 15 days upon receipt"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Delivery Term</label>
                            <input
                                {...register('DeliveryTerm')}
                                placeholder="e.g., FOB Destination"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Payment Term</label>
                            <input
                                {...register('PaymentTerm')}
                                placeholder="e.g., N/30"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-slate-700">Remarks</label>
                            <textarea
                                {...register('Remarks')}
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                placeholder="Optional remarks..."
                            />
                        </div>
                    </div>
                </div>

                {/* Items */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Order Items</h2>
                        <button
                            type="button"
                            onClick={() => append({ ItemDescription: '', Quantity: 1, UnitCost: 0, Remarks: '' })}
                            className="text-sm text-[var(--primary)] hover:text-[var(--primary)]/80 font-medium flex items-center gap-1"
                        >
                            <Plus className="w-4 h-4" /> Add Item
                        </button>
                    </div>

                    {isLoadingSelectedPR && (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                        </div>
                    )}

                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-12 gap-4 items-start bg-slate-50 p-4 rounded-lg relative">
                                <div className="col-span-5 space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Description</label>
                                    <input
                                        {...register(`items.${index}.ItemDescription`)}
                                        className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.items?.[index]?.ItemDescription ? 'border-red-500' : 'border-slate-200'
                                            }`}
                                    />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Qty</label>
                                    <input
                                        type="number"
                                        {...register(`items.${index}.Quantity`, { valueAsNumber: true })}
                                        className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.items?.[index]?.Quantity ? 'border-red-500' : 'border-slate-200'
                                            }`}
                                    />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Unit Cost</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...register(`items.${index}.UnitCost`, { valueAsNumber: true })}
                                        className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.items?.[index]?.UnitCost ? 'border-red-500' : 'border-slate-200'
                                            }`}
                                    />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Total</label>
                                    <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium">
                                        ₱{((items[index]?.Quantity || 0) * (items[index]?.UnitCost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="col-span-1 flex justify-end pt-6">
                                    <button
                                        type="button"
                                        onClick={() => remove(index)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {fields.length === 0 && !isLoadingSelectedPR && (
                            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                No items added. Select a PR to populate items or add manually.
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <div className="text-right">
                            <p className="text-sm text-slate-500">Total Amount</p>
                            <p className="text-2xl font-bold text-[var(--primary)]">
                                ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || createMutation.isPending}
                        className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium flex items-center gap-2"
                    >
                        {createMutation.isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Create Purchase Order
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
