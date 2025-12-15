'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    usePurchaseOrder,
    useUpdatePurchaseOrder,
    useApprovePurchaseOrder,
    useRejectPurchaseOrder
} from '@/lib/hooks/usePurchaseOrders';
import { useSuppliers } from '@/lib/hooks/masterData/useSuppliers';
import { useAuth } from '@/lib/hooks/useAuth';
import { showConfirmDialog } from '@/lib/utils/confirm';
import {
    ArrowLeft,
    Save,
    Plus,
    Trash2,
    AlertCircle,
    CheckCircle,
    XCircle,
    Printer,
    Clock
} from 'lucide-react';
import { format } from 'date-fns';

const poItemSchema = z.object({
    ItemDescription: z.string().min(1, 'Description is required'),
    Quantity: z.number().min(1, 'Quantity must be at least 1'),
    UnitCost: z.number().min(0, 'Unit Cost must be non-negative'),
    Remarks: z.string().optional(),
});

const poSchema = z.object({
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

export default function PurchaseOrderDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const id = parseInt(params.id as string);
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);

    const { data: po, isLoading, refetch } = usePurchaseOrder(id);
    const { data: suppliersData } = useSuppliers({ per_page: 100 });

    const updateMutation = useUpdatePurchaseOrder();
    const approveMutation = useApprovePurchaseOrder();
    const rejectMutation = useRejectPurchaseOrder();

    const {
        register,
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<POFormValues>({
        resolver: zodResolver(poSchema),
        defaultValues: {
            PODate: '',
            items: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
    });

    useEffect(() => {
        if (po) {
            reset({
                SupplierID: po.SupplierID,
                PODate: po.PODate,
                ModeOfProcurement: po.ModeOfProcurement || '',
                PlaceOfDelivery: po.PlaceOfDelivery || '',
                DateOfDelivery: po.DateOfDelivery || '',
                DeliveryTerm: po.DeliveryTerm || '',
                PaymentTerm: po.PaymentTerm || '',
                Remarks: po.Remarks || '',
                items: po.details?.map((d: any) => ({
                    ItemDescription: d.ItemDescription,
                    Quantity: d.Quantity,
                    UnitCost: d.UnitCost,
                    Remarks: d.Remarks || '',
                })) || [],
            });
        }
    }, [po, reset]);

    const items = watch('items');
    const totalAmount = items?.reduce((sum, item) => {
        return sum + (item.Quantity * item.UnitCost || 0);
    }, 0) || 0;

    const onSubmit = (data: POFormValues) => {
        updateMutation.mutate({ id, data }, {
            onSuccess: () => {
                setIsEditing(false);
            },
        });
    };

    const handleApprove = () => {
        showConfirmDialog({
            title: 'Approve Purchase Order',
            description: 'Are you sure you want to approve this PO? This will finalize the order.',
            confirmText: 'Approve',
            cancelText: 'Cancel',
            onConfirm: () => approveMutation.mutate(id),
        });
    };

    const handleReject = () => {
        showConfirmDialog({
            title: 'Reject Purchase Order',
            description: 'Are you sure you want to reject this PO?',
            confirmText: 'Reject',
            cancelText: 'Cancel',
            onConfirm: () => rejectMutation.mutate(id),
        });
    };

    if (isLoading) {
        return <div className="p-6 text-center">Loading...</div>;
    }

    if (!po) {
        return <div className="p-6 text-center">Purchase Order not found</div>;
    }

    const isPending = po.POStatusID === 1;
    const isApproved = po.POStatusID === 2;
    const isRejected = po.POStatusID === 3;
    const isAdmin = user?.Role?.toLowerCase() === 'admin';

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-slate-600" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900">{po.PONumber}</h1>
                            {isPending && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>}
                            {isApproved && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>}
                            {isRejected && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>}
                        </div>
                        <p className="text-slate-500 text-sm mt-1">
                            Created by {po.creator?.FullName} on {format(new Date(po.CreatedDate), 'MMM dd, yyyy')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isAdmin && isPending && (
                        <>
                            <button
                                onClick={handleReject}
                                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
                            >
                                Reject
                            </button>
                            <button
                                onClick={handleApprove}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                            >
                                Approve
                            </button>
                        </>
                    )}

                    {isPending && !isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                        >
                            Edit
                        </button>
                    )}

                    <button
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Print"
                    >
                        <Printer className="w-5 h-5" />
                    </button>
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
                            <label className="text-sm font-medium text-slate-700">PO Date</label>
                            {isEditing ? (
                                <input
                                    type="date"
                                    {...register('PODate')}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                />
                            ) : (
                                <p className="text-slate-900 font-medium">{format(new Date(po.PODate), 'MMMM dd, yyyy')}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Supplier</label>
                            {isEditing ? (
                                <select
                                    {...register('SupplierID', { valueAsNumber: true })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                >
                                    {suppliersData?.data?.map((supplier: any) => (
                                        <option key={supplier.SupplierID} value={supplier.SupplierID}>
                                            {supplier.SupplierName}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <p className="text-slate-900 font-medium">{po.supplier?.SupplierName}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Mode of Procurement</label>
                            {isEditing ? (
                                <input
                                    {...register('ModeOfProcurement')}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                />
                            ) : (
                                <p className="text-slate-900 font-medium">{po.ModeOfProcurement || '-'}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Place of Delivery</label>
                            {isEditing ? (
                                <input
                                    {...register('PlaceOfDelivery')}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                />
                            ) : (
                                <p className="text-slate-900 font-medium">{po.PlaceOfDelivery || '-'}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Date of Delivery</label>
                            {isEditing ? (
                                <input
                                    {...register('DateOfDelivery')}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                />
                            ) : (
                                <p className="text-slate-900 font-medium">{po.DateOfDelivery || '-'}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Delivery Term</label>
                            {isEditing ? (
                                <input
                                    {...register('DeliveryTerm')}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                />
                            ) : (
                                <p className="text-slate-900 font-medium">{po.DeliveryTerm || '-'}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Payment Term</label>
                            {isEditing ? (
                                <input
                                    {...register('PaymentTerm')}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                />
                            ) : (
                                <p className="text-slate-900 font-medium">{po.PaymentTerm || '-'}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">PR Reference</label>
                            <p className="text-slate-900 font-medium">{po.purchaseRequest?.PRNumber}</p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-slate-700">Remarks</label>
                            {isEditing ? (
                                <textarea
                                    {...register('Remarks')}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                />
                            ) : (
                                <p className="text-slate-900">{po.Remarks || '-'}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Order Items</h2>
                        {isEditing && (
                            <button
                                type="button"
                                onClick={() => append({ ItemDescription: '', Quantity: 1, UnitCost: 0, Remarks: '' })}
                                className="text-sm text-[var(--primary)] hover:text-[var(--primary)]/80 font-medium flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" /> Add Item
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {isEditing ? (
                            fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-12 gap-4 items-start bg-slate-50 p-4 rounded-lg relative">
                                    <div className="col-span-5 space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Description</label>
                                        <input
                                            {...register(`items.${index}.ItemDescription`)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Qty</label>
                                        <input
                                            type="number"
                                            {...register(`items.${index}.Quantity`, { valueAsNumber: true })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Unit Cost</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            {...register(`items.${index}.UnitCost`, { valueAsNumber: true })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-medium text-slate-500">Total</label>
                                        <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium">
                                            ₱{((items[index]?.Quantity || 0) * (items[index]?.UnitCost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <div className="col-span-1 flex justify-end pt-6">
                                        {fields.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">Description</th>
                                        <th className="px-4 py-3 text-center">Qty</th>
                                        <th className="px-4 py-3 text-right">Unit Cost</th>
                                        <th className="px-4 py-3 text-right rounded-r-lg">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {po.details?.map((item: any, i: number) => (
                                        <tr key={i}>
                                            <td className="px-4 py-3 font-medium text-slate-900">{item.ItemDescription}</td>
                                            <td className="px-4 py-3 text-center text-slate-600">{item.Quantity}</td>
                                            <td className="px-4 py-3 text-right text-slate-600">₱{Number(item.UnitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-900">₱{Number(item.TotalCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <div className="text-right">
                            <p className="text-sm text-slate-500">Total Amount</p>
                            <p className="text-2xl font-bold text-[var(--primary)]">
                                ₱{isEditing
                                    ? totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : Number(po.TotalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                }
                            </p>
                        </div>
                    </div>
                </div>

                {/* Edit Actions */}
                {isEditing && (
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditing(false);
                                reset();
                            }}
                            className="px-6 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || updateMutation.isPending}
                            className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium flex items-center gap-2"
                        >
                            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
