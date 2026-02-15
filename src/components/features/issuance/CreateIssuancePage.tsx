'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    ArrowLeft,
    CheckCircle,
    FileText,
    Loader2,
    Package,
    Layers,
    Save
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import issuanceAPI from '@/lib/api/issuance';
const issuanceSchema = z.object({
    dr_id: z.number().min(1, 'Delivery Receipt is required'),
    date_issued: z.string().min(1, 'Issue date is required'),
    remarks: z.string().optional(),
    inventory_items: z.array(z.object({
        inventory_detail_id: z.number(),
        quantity_issued: z.number().min(1, 'Quantity must be at least 1')
    })).min(1, 'Select at least one inventory item')
});

type IssuanceFormValues = z.infer<typeof issuanceSchema>;

interface DeliveryReceiptOption {
    DRID: number;
    DRNumber: string;
    RequestedBy?: string | null;
    DepartmentID?: number | null;
    DepartmentName?: string | null;
    DateReceived?: string | null;
    InspectionStatus?: 'pending' | 'inspected' | null;
    IARID?: number | null;
    IARNumber?: string | null;
    IARDateAccepted?: string | null;
    IARAcceptedBy?: number | null;
    IsAccepted?: number | boolean | null;
    AvailableItems?: number;
}

interface InventoryItem {
    InventoryDetailID: number;
    Description?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    PropertyNumber?: string | null;
    SerialNumber?: string | null;
    UnitCost?: number | null;
    PropertyName?: string | null;
    UnitName?: string | null;
    dr_item_description?: string | null;
    InventoryNumber?: string | null;
    DateReceived?: string | null;
    PropertyStatusID?: number | null;
    StatusName?: string | null;
    DRID?: number | null;
    DRNumber?: string | null;
    RequestedBy?: string | null;
    DepartmentName?: string | null;
    DocumentType?: 'PAR' | 'ICS' | null;
}

interface CreateIssuancePageProps {
    baseRoute: string;
}

export function CreateIssuancePage({ baseRoute }: CreateIssuancePageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [drOptions, setDrOptions] = useState<DeliveryReceiptOption[]>([]);
    const [selectedDr, setSelectedDr] = useState<DeliveryReceiptOption | null>(null);
    const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);
    const [selectedInventory, setSelectedInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLoadingInventory, setIsLoadingInventory] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<IssuanceFormValues>({
        resolver: zodResolver(issuanceSchema),
        defaultValues: {
            date_issued: new Date().toISOString().split('T')[0],
        }
    });

    const watchedDrId = watch('dr_id');

    useEffect(() => {
        loadDeliveryReceipts();
    }, []);

    useEffect(() => {
        const drParam = searchParams.get('dr_id');
        if (!drParam) return;
        const parsed = Number(drParam);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        setValue('dr_id', parsed, { shouldValidate: true });
    }, [searchParams, setValue]);

    useEffect(() => {
        if (!watchedDrId) {
            setSelectedDr(null);
            setAvailableInventory([]);
            setSelectedInventory([]);
            return;
        }

        const found = drOptions.find((dr) => Number(dr.DRID) === Number(watchedDrId)) || null;
        setSelectedDr(found);
        setSelectedInventory([]);
        loadAvailableInventory(Number(watchedDrId));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedDrId, drOptions]);

    useEffect(() => {
        const inventoryItems = selectedInventory.map(item => ({
            inventory_detail_id: item.InventoryDetailID,
            quantity_issued: 1
        }));
        setValue('inventory_items', inventoryItems, { shouldValidate: true });
    }, [selectedInventory, setValue]);

    const loadDeliveryReceipts = async () => {
        try {
            setLoading(true);
            const response = await issuanceAPI.getDeliveryReceiptsForIssuance({ per_page: 200 });
            setDrOptions(response.data || []);
        } catch (error) {
            console.error('Failed to load delivery receipts:', error);
            toast.error('Failed to load delivery receipts');
            setDrOptions([]);
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableInventory = async (drId: number) => {
        try {
            setIsLoadingInventory(true);
            const response = await issuanceAPI.getAvailableInventory({
                per_page: 500,
                dr_id: drId,
            });
            const items = response.data || [];
            setAvailableInventory(items);
            setSelectedInventory(items);
        } catch (error: unknown) {
            console.error('Failed to load inventory:', error);
            const maybeAxios = error as { response?: { data?: { error?: string; message?: string } } };
            const serverMessage = maybeAxios?.response?.data?.error || maybeAxios?.response?.data?.message;
            toast.error(serverMessage ? `Failed to load inventory: ${serverMessage}` : 'Failed to load inventory');
            setAvailableInventory([]);
            setSelectedInventory([]);
        } finally {
            setIsLoadingInventory(false);
        }
    };

    const onSubmit = async (data: IssuanceFormValues) => {
        if (!selectedDr) {
            toast.error('Please select a Delivery Receipt');
            return;
        }

        const inventoryItems = selectedInventory.map(item => ({
            inventory_detail_id: item.InventoryDetailID,
            quantity_issued: 1
        }));

        setValue('inventory_items', inventoryItems);

        try {
            setIsSubmitting(true);

            const submitData = {
                dr_id: selectedDr.DRID,
                date_issued: data.date_issued,
                remarks: data.remarks,
                inventory_items: inventoryItems,
            };

            const res = await issuanceAPI.create(submitData);
            const issuances = res.data?.issuances ?? [];
            const first = issuances[0];

            toast.success('Issuance created');

            if (first?.IssuanceID) {
                router.push(`${baseRoute}/${first.IssuanceID}`);
            } else {
                router.push(`${baseRoute}`);
            }
        } catch (error) {
            console.error('Failed to create issuance:', error);
            toast.error('Failed to issue assets');
        } finally {
            setIsSubmitting(false);
        }
    };

    const groupedInventory = useMemo(() => {
        const groups = new Map<string, { key: string; item: InventoryItem; items: InventoryItem[] }>();

        selectedInventory.forEach((item) => {
            const name = item.dr_item_description || item.PropertyName || 'Unknown Item';
            const brand = item.Brand || '';
            const model = item.ModelNumber || '';
            const serial = item.SerialNumber || '';
            const key = [name.trim().toLowerCase(), brand.trim().toLowerCase(), model.trim().toLowerCase(), serial.trim().toLowerCase()].join('::');

            if (!groups.has(key)) {
                groups.set(key, { key, item, items: [item] });
            } else {
                groups.get(key)?.items.push(item);
            }
        });

        return Array.from(groups.values());
    }, [selectedInventory]);

    const selectedSummary = useMemo(() => {
        const counts = selectedInventory.reduce<Record<string, number>>((acc, item) => {
            const key = item.DocumentType || 'Unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(counts)
            .map(([type, count]) => `${type}: ${count}`)
            .join(' • ');
    }, [selectedInventory]);

    const issuanceStats = useMemo(() => {
        const totals = {
            total: selectedInventory.length,
            grouped: groupedInventory.length,
            par: 0,
            ics: 0,
            unknown: 0,
        };

        selectedInventory.forEach((item) => {
            if (item.DocumentType === 'PAR') {
                totals.par += 1;
                return;
            }

            if (item.DocumentType === 'ICS') {
                totals.ics += 1;
                return;
            }

            totals.unknown += 1;
        });

        return totals;
    }, [groupedInventory.length, selectedInventory]);

    if (loading) {
        return (
            <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
                <div className="p-6">
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="flex items-center gap-3 text-slate-600">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Loading delivery receipts...
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                    <Link
                        href={`${baseRoute}`}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-700" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Issue Assets</h1>
                        <p className="text-slate-600 text-sm">
                            Issue accepted inventory directly from a Delivery Receipt
                        </p>
                    </div>
                </div>

                <form
                    onSubmit={handleSubmit(onSubmit, (formErrors) => {
                        console.error('Form validation errors:', formErrors);
                        toast.error('Please fill in all required fields');
                    })}
                    className="space-y-6"
                >
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Delivery Receipt</h2>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        DR Number *
                                    </label>

                                    <select
                                        {...register('dr_id', {
                                            valueAsNumber: true,
                                            required: 'Please select a DR',
                                            validate: (value) => value > 0 || 'Please select a DR'
                                        })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    >
                                        <option value="">Select a DR...</option>
                                        {drOptions.map(dr => (
                                            <option key={dr.DRID} value={dr.DRID}>
                                                {dr.DRNumber} - {dr.RequestedBy || 'Requester'} ({dr.DepartmentName || 'Department'})
                                            </option>
                                        ))}
                                    </select>

                                    {errors.dr_id && (
                                        <p className="mt-1 text-sm text-red-600">{errors.dr_id.message}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Issue Date *
                                    </label>
                                    <input
                                        type="date"
                                        {...register('date_issued')}
                                        readOnly
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed focus:outline-none"
                                    />
                                    {errors.date_issued && (
                                        <p className="mt-1 text-sm text-red-600">{errors.date_issued.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Remarks
                                </label>
                                <textarea
                                    {...register('remarks')}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    placeholder="Optional remarks for this issuance..."
                                />
                            </div>
                        </div>

                        {selectedDr && (
                            <div className="p-6 bg-slate-50">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-[var(--primary)]" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900">{selectedDr.DRNumber}</h3>
                                                <p className="text-sm text-slate-500">
                                                    Requested by {selectedDr.RequestedBy || 'N/A'} • {selectedDr.DepartmentName || 'Department'} •{' '}
                                                    {selectedDr.DateReceived
                                                        ? format(toZonedTime(new Date(selectedDr.DateReceived), 'Asia/Manila'), 'MMM dd, yyyy')
                                                        : 'Date N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {!!selectedDr.IsAccepted && (
                                                <div className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    Accepted
                                                    {selectedDr.IARDateAccepted
                                                        ? ` • ${format(toZonedTime(new Date(selectedDr.IARDateAccepted), 'Asia/Manila'), 'MMM dd, yyyy')}`
                                                        : ''}
                                                </div>
                                            )}
                                            <div className="text-xs text-slate-500 bg-white/80 border border-slate-200 px-3 py-2 rounded-full">
                                                {isLoadingInventory ? 'Loading items...' : 'Auto-selected from this DR'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                                            <div className="text-xs uppercase tracking-wide text-slate-500">Total Items</div>
                                            <div className="mt-2 text-2xl font-semibold text-slate-900">{issuanceStats.total}</div>
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                                            <div className="text-xs uppercase tracking-wide text-slate-500">Grouped Lines</div>
                                            <div className="mt-2 text-2xl font-semibold text-slate-900">{issuanceStats.grouped}</div>
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                                            <div className="text-xs uppercase tracking-wide text-slate-500">PAR Items</div>
                                            <div className="mt-2 text-2xl font-semibold text-purple-700">{issuanceStats.par}</div>
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-xl p-4">
                                            <div className="text-xs uppercase tracking-wide text-slate-500">ICS Items</div>
                                            <div className="mt-2 text-2xl font-semibold text-indigo-700">{issuanceStats.ics}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                                        <div>
                                            <h4 className="font-semibold text-slate-900">Selected Inventory Items</h4>
                                            <p className="text-xs text-slate-500">
                                                {selectedInventory.length === 0
                                                    ? 'No items selected yet'
                                                    : `${selectedInventory.length} item(s) selected`}
                                                {selectedSummary ? ` • ${selectedSummary}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Layers className="w-4 h-4" />
                                            Grouped by item, brand, model, serial
                                        </div>
                                    </div>

                                    {selectedInventory.length > 0 && (
                                        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
                                            {groupedInventory.map((group) => {
                                                const item = group.item;
                                                const displayName = item.dr_item_description || item.PropertyName || 'Unknown Item';
                                                const docType = item.DocumentType || 'Unknown';
                                                const serial = item.SerialNumber || null;
                                                const model = item.ModelNumber || null;
                                                const brand = item.Brand || null;
                                                const count = group.items.length;

                                                return (
                                                    <div key={group.key} className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="font-semibold text-slate-900">
                                                                    {displayName}
                                                                </div>
                                                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-900 text-white">
                                                                    Qty {count}
                                                                </span>
                                                            </div>
                                                            <div className="text-sm text-slate-600 mt-1">
                                                                {item.Description && <div>{item.Description}</div>}
                                                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                                                                    {brand && <span>Brand: {brand}</span>}
                                                                    {model && <span>Model: {model}</span>}
                                                                    {serial && <span>Serial: {serial}</span>}
                                                                </div>
                                                            </div>
                                                            <span className={`inline-flex items-center mt-3 px-2 py-0.5 rounded text-xs font-medium ${docType === 'PAR'
                                                                ? 'bg-purple-100 text-purple-800'
                                                                : docType === 'ICS'
                                                                    ? 'bg-indigo-100 text-indigo-800'
                                                                    : 'bg-slate-100 text-slate-600'
                                                                }`}>
                                                                {docType}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedDr && selectedInventory.length > 0 && (
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Issuing Assets...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Issue Assets
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
