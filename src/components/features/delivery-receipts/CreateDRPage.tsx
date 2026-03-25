"use client";

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deliveryReceiptKeys } from '@/lib/hooks/useDeliveryReceipts';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Path } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from 'zod';
import { useCreateDeliveryReceipt } from '@/lib/hooks/useDeliveryReceipts';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitsOfMeasure';
import { ItemDetailsModal } from './ItemDetailsModal';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Loader2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { getDeliveryReceiptRequesters, getPropertyTypes, getSuppliers } from '@/lib/api/deliveryReceipts';
import { getActiveArticles } from '@/lib/api/masterData';
import { Article } from '@/types/masterData';
import { formatInTimeZone } from 'date-fns-tz';

const drItemSchema = z.object({
    article_id: z.number().min(1, 'Article is required'),
    item_description: z.string().max(1000, 'Item description is too long').optional().or(z.literal('')),
    brand: z.string().max(100, 'Brand is too long').optional().or(z.literal('')),
    model_number: z.string().max(100, 'Model number is too long').optional().or(z.literal('')),
    serial_number: z.string().max(100, 'Serial number is too long').optional().or(z.literal('')),
    property_type_id: z.number().min(1, 'Property type is required'),
    remarks: z.string().optional(),
    unit_of_measure_id: z.number().min(1, 'Unit of measure is required'),
    quantity_delivered: z.number().min(1, 'Quantity must be at least 1'),
    quantity_requested: z.number().min(1, 'Quantity must be at least 1'),
    change_reason: z.string().optional(),
    unit_cost: z.number().min(0, 'Unit cost must be non-negative'),
}).superRefine((data, ctx) => {
    if (data.quantity_delivered !== data.quantity_requested) {
        const reason = (data.change_reason || '').trim();
        if (!reason) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['change_reason'],
                message: 'Change reason is required when delivered differs from requested quantity',
            });
        }
    }

    // serial number implies quantity must equal 1
    if ((data.serial_number || '').trim() !== '' && (data.quantity_delivered !== 1 || data.quantity_requested !== 1)) {
        if (data.quantity_delivered !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['quantity_delivered'],
                message: 'Quantity must be 1 when a serial number is provided',
            });
        }
        if (data.quantity_requested !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['quantity_requested'],
                message: 'Quantity must be 1 when a serial number is provided',
            });
        }
    }
});

const drSchema = z.object({
    dr_number: z.string().min(1, 'DR number is required'),
    supplier_id: z.coerce.number().min(1, 'Supplier is required'),
    supplier_name: z.string().optional(),
    requested_by_user_id: z.coerce.number().min(1, 'Requested by is required'),
    pr_number: z.string().min(1, 'PR number is required'),
    po_number: z.string().min(1, 'PO number is required'),
    invoice_number: z.string().min(1, 'Invoice number is required'),
    date_received: z.string().min(1, 'Date received is required'),
    remarks: z.string().optional(),
    dr_picture: z.custom<FileList>().refine((files) => files && files.length > 0, 'DR picture is required'),
    details: z.array(drItemSchema).min(1, 'At least one item is required'),
});

type DRFormValues = z.infer<typeof drSchema>;

interface PropertyType {
    PropertyTypeID: number;
    PropertyName: string;
    RequiresVerification?: boolean;
}

interface CreateDRPageProps {
    baseRoute: string;
}

export function CreateDRPage({ baseRoute }: CreateDRPageProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const createMutation = useCreateDeliveryReceipt();
    const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);

    // Manila today's date (YYYY-MM-DD) for client-side max date and validation
    const manilaToday = formatInTimeZone(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
    // Manila minimum allowed date (1 year back)
    const manilaMinDate = new Date();
    manilaMinDate.setFullYear(manilaMinDate.getFullYear() - 1);
    const manilaMin = formatInTimeZone(manilaMinDate, 'Asia/Manila', 'yyyy-MM-dd');

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<DRFormValues>({
        resolver: zodResolver(drSchema),
        defaultValues: {
            dr_number: '',
            supplier_id: 0,
            supplier_name: '',
            requested_by_user_id: 0,
            pr_number: '',
            po_number: '',
            invoice_number: '',
            date_received: manilaToday,
            remarks: '',
            details: [],
        },
    });


    const [requesters, setRequesters] = useState<{ UserID: number; FullName: string; DepartmentID: number; DepartmentName?: string | null }[]>([]);
    const [requesterQuery, setRequesterQuery] = useState('');
    const [suppliers, setSuppliers] = useState<{ SupplierID: number; SupplierName: string }[]>([]);
    const [supplierQuery, setSupplierQuery] = useState('');

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
                const [propertyTypesData, articlesData] = await Promise.all([
                    getPropertyTypes(),
                    getActiveArticles()
                ]);
                setPropertyTypes(propertyTypesData);
                setArticles(articlesData);
            } catch {
                toast.error('Failed to load form data');
            }
        };

        fetchData();
    }, []);

    // Units of measure for items
    const { data: unitsData } = useAllUnitsOfMeasure();
    // API returns UnitOfMeasureResource (id,name) — normalize to {id, name} to be safe
    type UnitOfMeasureResponse = { id?: number; name?: string; UnitOfMeasureID?: number; UnitName?: string };
    const units = Array.isArray(unitsData)
        ? (unitsData as UnitOfMeasureResponse[])
            .filter(u => u && (u.id ?? u.UnitOfMeasureID))
            .map(u => ({ id: u.id ?? u.UnitOfMeasureID!, name: u.name ?? u.UnitName! }))
        : [];


    const details = watch('details');
    const watchedRequesterId = watch('requested_by_user_id');
    const totalAmount = details?.reduce((sum, item) => {
        return sum + (item.quantity_delivered * (item.unit_cost || 0));
    }, 0) || 0;

    useEffect(() => {
        const fetchRequesters = async () => {
            try {
                const results = await getDeliveryReceiptRequesters();
                setRequesters(results || []);
            } catch {
                toast.error('Failed to load requesters');
                setRequesters([]);
            }
        };

        const fetchSuppliers = async () => {
            try {
                const results = await getSuppliers();
                setSuppliers(results || []);
            } catch {
                toast.error('Failed to load suppliers');
                setSuppliers([]);
            }
        };

        fetchRequesters();
        fetchSuppliers();
    }, []);

    const filteredRequesters = requesters.filter((user) => {
        const departmentName = user.DepartmentName || `Department ${user.DepartmentID}`;
        const label = `${user.FullName} - ${departmentName}`.toLowerCase();
        return label.includes(requesterQuery.trim().toLowerCase());
    });

    const filteredSuppliers = suppliers.filter((supplier) => {
        return supplier.SupplierName.toLowerCase().includes(supplierQuery.trim().toLowerCase());
    });

    // Combobox state for accessible dropdown search - Requesters
    const [comboboxOpen, setComboboxOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const comboboxRef = useRef<HTMLDivElement | null>(null);
    const comboboxInputRef = useRef<HTMLInputElement | null>(null);
    const comboboxListRef = useRef<HTMLUListElement | null>(null);

    // Combobox state for suppliers
    const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
    const [supplierHighlightedIndex, setSupplierHighlightedIndex] = useState(-1);
    const supplierComboboxRef = useRef<HTMLDivElement | null>(null);
    const supplierComboboxInputRef = useRef<HTMLInputElement | null>(null);
    const supplierComboboxListRef = useRef<HTMLUListElement | null>(null);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
                setComboboxOpen(false);
                setHighlightedIndex(-1);
            }
            if (supplierComboboxRef.current && !supplierComboboxRef.current.contains(e.target as Node)) {
                setSupplierComboboxOpen(false);
                setSupplierHighlightedIndex(-1);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const selectRequester = (user: { UserID: number; FullName: string; DepartmentID: number; DepartmentName?: string | null }) => {
        const departmentName = user.DepartmentName || `Department ${user.DepartmentID}`;
        setRequesterQuery(`${user.FullName} - ${departmentName}`);
        setValue('requested_by_user_id', user.UserID);
        setComboboxOpen(false);
        setHighlightedIndex(-1);
    };

    const selectSupplier = (supplier: { SupplierID: number; SupplierName: string }) => {
        setSupplierQuery(supplier.SupplierName);
        setValue('supplier_id', supplier.SupplierID);
        setValue('supplier_name', supplier.SupplierName);
        setSupplierComboboxOpen(false);
        setSupplierHighlightedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!comboboxOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.min(prev + 1, filteredRequesters.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredRequesters.length) {
                selectRequester(filteredRequesters[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setComboboxOpen(false);
            setHighlightedIndex(-1);
        }
    };

    const handleSupplierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!supplierComboboxOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSupplierHighlightedIndex((prev) => Math.min(prev + 1, filteredSuppliers.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSupplierHighlightedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (supplierHighlightedIndex >= 0 && supplierHighlightedIndex < filteredSuppliers.length) {
                selectSupplier(filteredSuppliers[supplierHighlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setSupplierComboboxOpen(false);
            setSupplierHighlightedIndex(-1);
        }
    };

    useEffect(() => {
        // If requester id is set externally (e.g. form reset), populate the visible combobox text.
        const requester = requesters.find((user) => user.UserID === watchedRequesterId);
        if (requester && requesterQuery.trim().length === 0) {
            const departmentName = requester.DepartmentName || `Department ${requester.DepartmentID}`;
            setRequesterQuery(`${requester.FullName} - ${departmentName}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedRequesterId, requesters]);

    useEffect(() => {
        // If supplier name in form is set externally, populate the visible combobox text.
        const supplierName = watch('supplier_name');
        if (supplierName && supplierQuery.trim().length === 0) {
            setSupplierQuery(supplierName);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watch('supplier_name'), suppliers]);

    const onSubmit = async (data: DRFormValues) => {
        // client-side checks: prevent future dates and too-old dates (unless override requested)
        if (data.date_received > manilaToday) {
            toast.error('Date received cannot be in the future.');
            return;
        }
        if (data.date_received < manilaMin) {
            toast.error(`Date received is too old. Minimum allowed is ${manilaMin}.`);
            return;
        }

        // Prepare FormData for file upload
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (key === 'details') {
                // Serialize details array properly for Laravel
                const details = value as typeof data.details;
                details.forEach((item, index) => {
                    Object.entries(item).forEach(([itemKey, itemValue]) => {
                        if (itemValue !== undefined && itemValue !== null) {
                            formData.append(`details[${index}][${itemKey}]`, String(itemValue));
                        }
                    });
                });
            } else if (key === 'dr_picture') {
                // Extract the first file from FileList
                const fileList = value as FileList;
                if (fileList && fileList.length > 0) {
                    formData.append(key, fileList[0]);
                }
            } else if (value !== undefined && value !== null) {
                // Convert booleans to '1' or '0' for Laravel
                if (typeof value === 'boolean') {
                    formData.append(key, value ? '1' : '0');
                } else {
                    formData.append(key, String(value));
                }
            }
        });

        try {
            await createMutation.mutateAsync(formData);
            toast.success('Delivery receipt created successfully');

            // Ensure the delivery receipts list is refreshed before navigating
            await queryClient.invalidateQueries({ queryKey: deliveryReceiptKeys.all });

            router.push(`${baseRoute}/delivery-receipts`);
        } catch (err: unknown) {
            console.error('Full error object:', err);
            const resp = (err as { response?: { data?: { errors?: Record<string, string | string[]>; message?: string } } })?.response?.data;
            console.error('Response data:', resp);

            if (resp?.errors) {
                console.error('Validation errors:', resp.errors);
                // Map Laravel validation errors to react-hook-form setError
                Object.entries(resp.errors).forEach(([field, messages]) => {
                    const message = Array.isArray(messages) ? messages[0] : String(messages);
                    console.log(`Setting error for field: ${field} => ${message}`);
                    try {
                        // field names from Laravel already come in dot notation (e.g. details.0.item_description)
                        setError(field as Path<DRFormValues>, { type: 'server', message });
                    } catch (e) {
                        console.error(`Failed to set error for field ${field}:`, e);
                    }
                });
                const errorList = Object.entries(resp.errors)
                    .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
                    .join(', ');
                toast.error(`Validation failed: ${errorList}`);
                return;
            }

            toast.error(resp?.message || 'Failed to create delivery receipt');
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
            article_id: item?.article_id || 0, item_description: item?.item_description || '',
            brand: item?.brand || '',
            model_number: item?.model_number || '',
            serial_number: item?.serial_number || '',
            property_type_id: item?.property_type_id || 0,
            unit_of_measure_id: item?.unit_of_measure_id || (units.length ? units[0].id : 1),
            quantity_delivered: item?.quantity_delivered || 1,
            quantity_requested: item?.quantity_requested ?? (item?.quantity_delivered || 1),
            change_reason: item?.change_reason || '',
            unit_cost: item?.unit_cost || 0,
        });
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
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
                        <p className="text-slate-500 text-sm">Record delivery receipt information</p>
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
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Supplier Name *
                                </label>
                                <div className="relative" ref={supplierComboboxRef}>
                                    <input
                                        ref={supplierComboboxInputRef}
                                        type="text"
                                        role="combobox"
                                        aria-expanded={supplierComboboxOpen}
                                        aria-controls="supplier-listbox"
                                        aria-autocomplete="list"
                                        value={supplierQuery}
                                        onChange={(e) => {
                                            setSupplierQuery(e.target.value);
                                            setValue('supplier_name', e.target.value);
                                            setValue('supplier_id', 0);
                                            setSupplierComboboxOpen(true);
                                            setSupplierHighlightedIndex(-1);
                                        }}
                                        onKeyDown={handleSupplierKeyDown}
                                        placeholder="Search suppliers or enter new supplier name..."
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                        onFocus={() => setSupplierComboboxOpen(true)}
                                    />
                                    {supplierComboboxOpen && (
                                        <ul id="supplier-listbox" role="listbox" ref={supplierComboboxListRef} className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-48 overflow-auto">
                                            {filteredSuppliers.length === 0 ? (
                                                <li className="px-3 py-2 text-sm text-slate-500">
                                                    {supplierQuery.trim() ? `No suppliers match "${supplierQuery}". Press Enter to use "${supplierQuery}" as new supplier.` : 'Type to search suppliers...'}
                                                </li>
                                            ) : (
                                                filteredSuppliers.map((supplier, idx) => (
                                                    <li
                                                        key={supplier.SupplierID}
                                                        role="option"
                                                        aria-selected={supplierHighlightedIndex === idx}
                                                        onMouseDown={(e) => { e.preventDefault(); selectSupplier(supplier); }}
                                                        onMouseEnter={() => setSupplierHighlightedIndex(idx)}
                                                        className={`px-3 py-2 cursor-pointer text-sm ${supplierHighlightedIndex === idx ? 'bg-[var(--primary)] text-white' : 'hover:bg-slate-100'}`}
                                                    >
                                                        <div className="font-medium">{supplier.SupplierName}</div>
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                    )}
                                </div>
                                {errors.supplier_id && (
                                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {errors.supplier_id.message}
                                    </p>
                                )}
                            </div>
                            {/* Requested By (Department Head) */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Requested By (Department Head) *
                                </label>
                                <div className="relative" ref={comboboxRef}>
                                    <input
                                        ref={comboboxInputRef}
                                        type="text"
                                        role="combobox"
                                        aria-expanded={comboboxOpen}
                                        aria-controls="requester-listbox"
                                        aria-autocomplete="list"
                                        value={requesterQuery}
                                        onChange={(e) => { setRequesterQuery(e.target.value); setComboboxOpen(true); setHighlightedIndex(-1); }}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Search by name or department..."
                                        className="w-full px-3 py-2 mb-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                        onFocus={() => setComboboxOpen(true)}
                                    />
                                    {comboboxOpen && (
                                        <ul id="requester-listbox" role="listbox" ref={comboboxListRef} className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-48 overflow-auto">
                                            {filteredRequesters.length === 0 ? (
                                                <li className="px-3 py-2 text-sm text-slate-500">No matches for &quot;{requesterQuery}&quot;</li>
                                            ) : (
                                                filteredRequesters.map((user, idx) => {
                                                    const departmentName = user.DepartmentName || `Department ${user.DepartmentID}`;
                                                    const label = `${user.FullName} - ${departmentName}`;
                                                    return (
                                                        <li
                                                            key={user.UserID}
                                                            role="option"
                                                            aria-selected={highlightedIndex === idx}
                                                            onMouseDown={(e) => { e.preventDefault(); selectRequester(user); }}
                                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                                            className={`px-3 py-2 text-sm cursor-pointer ${highlightedIndex === idx ? 'bg-[var(--primary)] text-white' : 'hover:bg-slate-100'}`}
                                                        >
                                                            {label}
                                                        </li>
                                                    );
                                                })
                                            )}
                                        </ul>
                                    )}
                                </div>
                                <input type="hidden" {...register('requested_by_user_id', { valueAsNumber: true })} />
                                {errors.requested_by_user_id && (
                                    <p className="mt-1 text-sm text-red-600">{errors.requested_by_user_id.message}</p>
                                )}
                            </div>

                            {/* PR Number */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    PR Number *
                                </label>
                                <input
                                    {...register('pr_number')}
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    placeholder="Enter PR number"
                                />
                                {errors.pr_number && (
                                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {errors.pr_number.message}
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
                                    Invoice Number *
                                </label>
                                <input
                                    {...register('invoice_number')}
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    placeholder="Enter invoice number"
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

                        {/* DR Picture */}
                        <div className="mt-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                DR Picture *
                            </label>
                            <input
                                {...register('dr_picture')}
                                type="file"
                                accept="image/jpeg,image/png,image/jpg,image/gif"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                            {errors.dr_picture && (
                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.dr_picture.message}
                                </p>
                            )}
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
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Article</th>
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Item Description</th>
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Brand / Model / SN</th>
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 min-w-[220px]">Property Type</th>
                                        <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 w-32">Requested / Delivered</th>
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
                                                <div className="text-sm text-slate-700">
                                                    {articles.find(a => a.id === details[index]?.article_id)?.name || '—'}
                                                </div>
                                                {errors.details?.[index]?.article_id && (
                                                    <p className="mt-1 text-xs text-red-600">
                                                        {errors.details[index]?.article_id?.message}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="text-sm text-slate-700">{details[index]?.item_description || '—'}</div>
                                                {errors.details?.[index]?.item_description && (
                                                    <p className="mt-1 text-xs text-red-600">
                                                        {errors.details[index]?.item_description?.message}
                                                    </p>
                                                )}
                                            </td>

                                            <td className="py-3 px-3 text-sm text-slate-700">
                                                {details[index]?.brand || ''}{details[index]?.brand && details[index]?.model_number ? ' / ' : ''}{details[index]?.model_number || ''}{(details[index]?.brand || details[index]?.model_number) && details[index]?.serial_number ? ' / ' : ''}{details[index]?.serial_number || ''}
                                            </td>

                                            <td className="py-3 px-3 min-w-[220px]">
                                                <div className="text-xs text-slate-500 mt-1 truncate">
                                                    {propertyTypes.find(p => p.PropertyTypeID === details[index]?.property_type_id)?.PropertyName || 'No type'}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 w-32 text-center">
                                                <div className="text-sm">
                                                    <span className="font-medium">R:</span>{' '}{(details[index]?.quantity_requested ?? details[index]?.quantity_delivered ?? 0)}{' '}
                                                    <span className="font-medium">D:</span>{' '}{details[index]?.quantity_delivered ?? 0}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">{units.find(u => u.id === details[index]?.unit_of_measure_id)?.name || ''}</div>
                                                {details[index]?.quantity_requested !== details[index]?.quantity_delivered && details[index]?.change_reason && (
                                                    <div className="text-xs text-red-600 mt-1">Reason: {details[index]?.change_reason}</div>
                                                )}
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
                                                {(errors.details?.[index]?.property_type_id || errors.details?.[index]?.unit_of_measure_id || errors.details?.[index]?.quantity_delivered) && (
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
                            <div className="p-6 text-center text-sm text-slate-500 italic">No items added. Click &quot;Add Item&quot; to begin.</div>
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
                        articles={articles}
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
        </div>
    );
}

