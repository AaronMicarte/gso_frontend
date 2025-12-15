'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    usePurchaseRequest,
    useUpdatePurchaseRequest,
    useApprovePurchaseRequest,
    useRejectPurchaseRequest,
    useSetBudgetCheckedPurchaseRequest
} from '@/lib/hooks/usePurchaseRequests';
import { useDepartments } from '@/lib/hooks/masterData/useDepartments';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitOfMeasures';
import { useAuth } from '@/lib/hooks/useAuth';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import {
    ArrowLeft,
    Plus,
    Trash2,
    CheckCircle,
    XCircle,
    Printer,
    Clock
} from 'lucide-react';
import { format } from 'date-fns';

// Reuse Schema
const prItemSchema = z.object({
    ItemDescription: z.string().min(1, 'Description is required'),
    Quantity: z.number().min(1, 'Quantity must be at least 1'),
    UnitCost: z.number().min(0, 'Unit Cost must be non-negative'),
    UnitOfMeasureID: z.number().min(1, 'Unit of Measure is required'),
    Remarks: z.string().optional(),
});

const prSchema = z.object({
    Purpose: z.string().min(1, 'Purpose is required'),
    DepartmentID: z.number().min(1, 'Department is required'),
    items: z.array(prItemSchema).min(1, 'At least one item is required'),
});

type PRFormValues = z.infer<typeof prSchema>;

export default function PurchaseRequestDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const id = parseInt(params.id as string);
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);

    const { data: pr, isLoading } = usePurchaseRequest(id);
    const { data: departmentsData } = useDepartments({ per_page: 100 });
    const { data: unitsOfMeasureData, isLoading: isLoadingUOM, error: uomError } = useAllUnitsOfMeasure();

    const uniqueUOMs = unitsOfMeasureData?.filter((uom, index, self) =>
        index === self.findIndex((t) => t.id === uom.id)
    );

    const updateMutation = useUpdatePurchaseRequest();
    const approveMutation = useApprovePurchaseRequest();
    const rejectMutation = useRejectPurchaseRequest();
    const budgetCheckedMutation = useSetBudgetCheckedPurchaseRequest();
    const { showConfirmDialog, ConfirmDialog } = useConfirmDialog();

    const {
        register,
        control,
        handleSubmit,
        reset,
        watch,
        formState: { isSubmitting },
    } = useForm<PRFormValues>({
        resolver: zodResolver(prSchema),
        defaultValues: {
            Purpose: '',
            items: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
    });

    // Reset form when data loads
    useEffect(() => {
        if (pr) {
            reset({
                Purpose: pr.Purpose,
                DepartmentID: pr.DepartmentID,
                items: pr.details?.map(d => ({
                    ItemDescription: d.ItemDescription,
                    Quantity: d.Quantity,
                    UnitCost: d.UnitCost,
                    UnitOfMeasureID: d.UnitOfMeasureID || 1, // Default to 1 (pc) if null
                    Remarks: d.Remarks || '',
                })) || [],
            });
        }
    }, [pr, reset]);

    const items = watch('items');
    const totalAmount = items?.reduce((sum, item) => {
        return sum + (item.Quantity * item.UnitCost || 0);
    }, 0) || 0;

    const onSubmit = (data: PRFormValues) => {
        updateMutation.mutate({ id, data }, {
            onSuccess: () => {
                setIsEditing(false);
            },
        });
    };

    const handleApprove = () => {
        // Prevent approval if budget is not checked. Offer to set it, then continue to approve.
        if (!isBudgetChecked) {
            showConfirmDialog({
                title: 'Cannot Approve — Budget Not Checked',
                description:
                    'This Purchase Request has not been marked as Budget Checked. It cannot be approved until the budget is checked. Would you like to set Budget Checked now?',
                confirmText: 'Set Budget Checked',
                cancelText: 'Cancel',
                onConfirm: async () => {
                    // Wrap the mutation in a promise so we can await its completion
                    await new Promise<void>((resolve, reject) => {
                        budgetCheckedMutation.mutate(id, {
                            onSuccess: () => resolve(),
                            onError: (err) => reject(err),
                        });
                    });

                    // After marking as budget checked, prompt for approval as normal
                    showConfirmDialog({
                        title: 'Approve Purchase Request',
                        description: 'Budget has been checked. Are you sure you want to approve this request? This will allow PO creation.',
                        confirmText: 'Approve',
                        cancelText: 'Cancel',
                        onConfirm: () => {
                            approveMutation.mutate(id);
                            router.push('/admin/purchase-requests');
                        },
                    });
                },
            });
            return;
        }

        showConfirmDialog({
            title: 'Approve Purchase Request',
            description: 'Are you sure you want to approve this request? This will allow PO creation.',
            confirmText: 'Approve',
            cancelText: 'Cancel',
            onConfirm: () => {
                approveMutation.mutate(id);
                router.push('/admin/purchase-requests');
            },
        });
    };

    const handleReject = () => {
        showConfirmDialog({
            title: 'Reject Purchase Request',
            description: 'Are you sure you want to reject this request?',
            confirmText: 'Reject',
            cancelText: 'Cancel',
            onConfirm: () => {
                rejectMutation.mutate(id);
                router.push('/admin/purchase-requests');
            },
        });
    };

    const handleSetBudgetChecked = () => {
        showConfirmDialog({
            title: 'Set Budget Checked',
            description: 'Mark this PR as budget checked? This is a placeholder for real Budget Officer review (outside GSO scope).',
            confirmText: 'Set Budget Checked',
            cancelText: 'Cancel',
            onConfirm: () => {
                budgetCheckedMutation.mutate(id);
            },
        });
    };

    if (isLoading) {
        return <div className="p-6 text-center">Loading...</div>;
    }

    if (!pr) {
        return <div className="p-6 text-center">Purchase Request not found</div>;
    }

    const isPending = pr.PRStatusID === 1;
    const isApproved = pr.PRStatusID === 2;
    const isRejected = pr.PRStatusID === 3;
    const isBudgetChecked = pr.PRStatusID === 5;
    const isAdmin = user?.Role?.toLowerCase() === 'admin';
    // In a real GSO system, only the requester should edit their pending request.
    // Admins/GSO Staff should only Approve (Process) or Reject (Return).
    const isRequester = user?.UserID === pr.RequestedBy;

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
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold text-slate-900">{pr.PRNumber}</h1>
                            {isPending && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>}
                            {isApproved && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>}
                            {isRejected && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>}
                            {isBudgetChecked && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Budget Checked</span>}
                        </div>
                        <p className="text-slate-500 text-sm mt-1">
                            Requested by <span className="font-medium text-slate-700">{pr.requester?.FullName || 'Unknown User'}</span> on {format(new Date(pr.CreatedDate), 'MMM dd, yyyy')}
                            {pr.DateApproved && (
                                <span className="ml-2">
                                    • Approved on {format(new Date(pr.DateApproved), 'MMM dd, yyyy')} by {pr.approver?.FullName || 'Unknown'}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Admin Actions */}
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
                                disabled={!isBudgetChecked}
                                className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm text-white ${isBudgetChecked
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-green-600 opacity-60 cursor-not-allowed'
                                    }`}
                            >
                                Approve
                            </button>
                            <button
                                onClick={handleSetBudgetChecked}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                            >
                                Set Budget Checked
                            </button>
                        </>
                    )}

                    {/* Create PO Button for Approved PRs */}
                    {isApproved && (
                        <button
                            onClick={() => router.push(`/admin/purchase-orders/new?pr=${pr.PurchaseRequestID}`)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                        >
                            Create Purchase Order
                        </button>
                    )}

                    {/* Edit Button (Only if Pending and Requester) */}
                    {isPending && !isEditing && isRequester && (
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
                            <label className="text-sm font-medium text-slate-700">Date Requested</label>
                            <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {format(new Date(pr.DateRequested), 'MMMM dd, yyyy')}
                            </div>
                            <p className="text-xs text-slate-500">
                                Original submission date (locked - cannot be modified)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Department</label>
                            <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm flex items-center gap-2">
                                {pr.department?.DepartmentName || 'N/A'}
                            </div>
                            <p className="text-xs text-slate-500">
                                Department locked - cannot be modified after creation
                            </p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-slate-700">Purpose</label>
                            {isEditing ? (
                                <textarea
                                    {...register('Purpose')}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                />
                            ) : (
                                <p className="text-slate-900">{pr.Purpose}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Requested Items</h2>
                        {isEditing && (
                            <button
                                type="button"
                                onClick={() => append({ ItemDescription: '', Quantity: 1, UnitCost: 0, UnitOfMeasureID: 1, Remarks: '' })}
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
                                    <div className="col-span-4 space-y-1">
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
                                        <label className="text-xs font-medium text-slate-500">Unit</label>
                                        <select
                                            {...register(`items.${index}.UnitOfMeasureID`, { valueAsNumber: true })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                        >
                                            <option value="">Select Unit</option>
                                            {uniqueUOMs?.map((uom) => (
                                                <option key={uom.id} value={uom.id}>
                                                    {uom.name}
                                                </option>
                                            ))}
                                        </select>
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
                                    <div className="col-span-1 space-y-1">
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
                                        <th className="px-4 py-3 text-center">Unit</th>
                                        <th className="px-4 py-3 text-right">Unit Cost</th>
                                        <th className="px-4 py-3 text-right rounded-r-lg">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pr.details?.map((item, i) => {
                                        const foundUOM = uniqueUOMs?.find(uom => uom.id === item.UnitOfMeasureID);
                                        return (
                                            <tr key={item.PRDetailID || i}>
                                                <td className="px-4 py-3 font-medium text-slate-900">{item.ItemDescription}</td>
                                                <td className="px-4 py-3 text-center text-slate-600">{item.Quantity}</td>
                                                <td className="px-4 py-3 text-center text-slate-600">
                                                    {isLoadingUOM ? (
                                                        <span className="text-xs text-slate-400">Loading...</span>
                                                    ) : uomError ? (
                                                        <span className="text-xs text-red-400">Error loading UOM</span>
                                                    ) : (
                                                        foundUOM?.name || (item.UnitOfMeasureID ? `UOM ID: ${item.UnitOfMeasureID}` : <span className="text-xs text-amber-600">Not set - please edit</span>)
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-600">₱{Number(item.UnitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-900">₱{Number(item.TotalCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <div className="text-right">
                            <p className="text-sm text-slate-500">Total Estimated Cost</p>
                            <p className="text-2xl font-bold text-[var(--primary)]">
                                ₱{isEditing
                                    ? totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : pr.details?.reduce((sum, item) => sum + Number(item.TotalCost), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
            <ConfirmDialog />
        </div>
    );
}
