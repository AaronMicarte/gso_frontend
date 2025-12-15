'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreatePurchaseRequest } from '@/lib/hooks/usePurchaseRequests';
import { useDepartments } from '@/lib/hooks/masterData/useDepartments';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitOfMeasures';
import { useAuth } from '@/lib/hooks/useAuth';
import {
    ArrowLeft,
    Save,
    Plus,
    Trash2,
    AlertCircle,
    User,
    FileText
} from 'lucide-react';
import { toast } from 'sonner';

// Zod Schema
const prItemSchema = z.object({
    ItemDescription: z.string().min(1, 'Description is required'),
    Quantity: z.number().min(1, 'Quantity must be at least 1'),
    UnitCost: z.number().min(0, 'Unit Cost must be non-negative'),
    UnitOfMeasureID: z.number().min(1, 'Unit of Measure is required'),
    Remarks: z.string().optional(),
});

const prSchema = z.object({
    Purpose: z.string().min(1, 'Purpose is required'),
    items: z.array(prItemSchema).min(1, 'At least one item is required'),
});

type PRFormValues = z.infer<typeof prSchema>;

export default function CreatePurchaseRequestPage() {
    const router = useRouter();
    const createMutation = useCreatePurchaseRequest();
    const { data: departmentsData, isLoading: isLoadingDepts } = useDepartments({ per_page: 100 }); // Fetch all departments
    const { data: unitsOfMeasureData, isLoading: isLoadingUOM } = useAllUnitsOfMeasure();
    const { user } = useAuth();

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<PRFormValues>({
        resolver: zodResolver(prSchema),
        defaultValues: {
            Purpose: '',
            items: [{ ItemDescription: '', Quantity: 1, UnitCost: 0, Remarks: '' }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
    });

    // Watch items to calculate total
    const items = watch('items');
    const totalAmount = items.reduce((sum, item) => {
        return sum + (item.Quantity * item.UnitCost || 0);
    }, 0);

    const onSubmit = (data: PRFormValues) => {
        // Use user's department - users can only create PRs for their own department
        const payload = {
            ...data,
            DepartmentID: user?.DepartmentID || 0
        };

        createMutation.mutate(payload, {
            onSuccess: () => {
                router.push('/admin/purchase-requests');
            },
        });
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Create Purchase Request</h1>
                    <p className="text-slate-500">New procurement request</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* General Info Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-4">
                        General Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">PR Number</label>
                            <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Auto-generated upon submission
                            </div>
                            <p className="text-xs text-slate-500">
                                System will automatically generate PR number (e.g., PR-2025-0001)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Date Requested</label>
                            <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                {new Date().toLocaleDateString('en-PH', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </div>
                            <p className="text-xs text-slate-500">
                                Automatically set to today's date
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Department</label>
                            <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium">
                                {user?.department?.DepartmentName || 'Loading...'}
                            </div>
                            <p className="text-xs text-slate-500">
                                PRs can only be created for your own department
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Requested By
                            </label>
                            <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium">
                                {user?.FullName || 'Loading...'}
                            </div>
                            <p className="text-xs text-slate-500">
                                This PR will be recorded as requested by you (current user)
                            </p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-slate-700">Purpose</label>
                            <textarea
                                {...register('Purpose')}
                                rows={3}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${errors.Purpose ? 'border-red-500' : 'border-slate-200'
                                    }`}
                                placeholder="State the purpose of this purchase..."
                            />
                            {errors.Purpose && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {errors.Purpose.message}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Items</h2>
                        <button
                            type="button"
                            onClick={() => append({ ItemDescription: '', Quantity: 1, UnitCost: 0, UnitOfMeasureID: 1, Remarks: '' })}
                            className="text-sm text-[var(--primary)] hover:text-[var(--primary)]/80 font-medium flex items-center gap-1"
                        >
                            <Plus className="w-4 h-4" /> Add Item
                        </button>
                    </div>
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-12 gap-4 items-start bg-slate-50 p-4 rounded-lg relative group">
                                <div className="col-span-4 space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Description</label>
                                    <input
                                        {...register(`items.${index}.ItemDescription`)}
                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${errors.items?.[index]?.ItemDescription ? 'border-red-500' : 'border-slate-200'
                                            }`}
                                        placeholder="Item name/description"
                                    />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Qty</label>
                                    <input
                                        type="number"
                                        {...register(`items.${index}.Quantity`, { valueAsNumber: true })}
                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${errors.items?.[index]?.Quantity ? 'border-red-500' : 'border-slate-200'
                                            }`}
                                    />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Unit</label>
                                    <select
                                        {...register(`items.${index}.UnitOfMeasureID`, { valueAsNumber: true })}
                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${errors.items?.[index]?.UnitOfMeasureID ? 'border-red-500' : 'border-slate-200'
                                            }`}
                                    >
                                        <option value="">Select Unit</option>
                                        {unitsOfMeasureData?.map((uom) => (
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
                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${errors.items?.[index]?.UnitCost ? 'border-red-500' : 'border-slate-200'
                                            }`}
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
                                {errors.items?.[index] && (
                                    <div className="col-span-12 text-xs text-red-500">
                                        Please check item details
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <div className="text-right">
                            <p className="text-sm text-slate-500">Total Estimated Cost</p>
                            <p className="text-2xl font-bold text-[var(--primary)]">
                                ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
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
                        className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {createMutation.isPending ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Create Purchase Request
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
