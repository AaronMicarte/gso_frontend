'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Loader2, Edit } from 'lucide-react';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitsOfMeasure';
import { ItemDetailsModal } from './ItemDetailsModal';
import { useForm, useFieldArray, Path } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from 'zod';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { getDeliveryReceipt, getDeliveryReceiptRequesters, getPropertyTypes } from '@/lib/api/deliveryReceipts';
import { useUpdateDeliveryReceipt } from '@/lib/hooks/useDeliveryReceipts';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const drItemSchema = z.object({
    dr_detail_id: z.number().optional(), // Optional for updates
    item_description: z.string().min(1, 'Item description is required'),
    brand: z.string().optional(),
    model_number: z.string().optional(),
    serial_number: z.string().optional(),
    property_type_id: z.number().min(1, 'Property type is required'),
    unit_of_measure_id: z.number().min(1, 'Unit of measure is required'),
    remarks: z.string().optional(),
    quantity_delivered: z.number().min(1, 'Quantity must be at least 1'),
    unit_cost: z.number().min(0, 'Unit cost must be non-negative'),
});

const drSchema = z.object({
    dr_number: z.string().min(1, 'DR number is required'),
    supplier_name: z.string().min(1, 'Supplier name is required'),
    requested_by_user_id: z.coerce.number().min(1, 'Requested by is required'),
    pr_number: z.string().min(1, 'PR number is required'),
    po_number: z.string().min(1, 'PO number is required'),
    invoice_number: z.string().min(1, 'Invoice number is required'),
    date_received: z.string().min(1, 'Date received is required'),
    override_past_limit: z.boolean().optional(),
    remarks: z.string().optional(),
    dr_picture: z.custom<FileList>().optional(),
    details: z.array(drItemSchema).min(1, 'At least one item is required'),
});

type DRFormValues = z.infer<typeof drSchema>;

interface PropertyType {
    PropertyTypeID: number;
    PropertyName: string;
    RequiresVerification?: boolean;
}

interface EditDRPageProps {
    baseRoute: string;
}

export function EditDRPage({ baseRoute }: EditDRPageProps) {
    const params = useParams();
    const router = useRouter();
    const updateMutation = useUpdateDeliveryReceipt();
    const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isLoadingDR, setIsLoadingDR] = useState(true);
    const [currentPictureUrl, setCurrentPictureUrl] = useState<string | null>(null);
    const [picturePreview, setPicturePreview] = useState<string | null>(null);

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
        setValue,
        setError,
        formState: { errors },
    } = useForm<DRFormValues>({
        resolver: zodResolver(drSchema),
        defaultValues: {
            dr_number: '',
            supplier_name: '',
            requested_by_user_id: 0,
            pr_number: '',
            po_number: '',
            invoice_number: '',
            date_received: manilaToday,
            override_past_limit: false,
            remarks: '',
            details: [],
        },
    });

    const [requesters, setRequesters] = useState<{ UserID: number; FullName: string; DepartmentID: number; DepartmentName?: string | null }[]>([]);
    const [requesterQuery, setRequesterQuery] = useState('');

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
                const [propertyTypesData, drData] = await Promise.all([
                    getPropertyTypes(),
                    getDeliveryReceipt(parseInt(params.id as string))
                ]);
                setPropertyTypes(propertyTypesData);

                // Populate form with existing data
                setValue('dr_number', drData.DRNumber);
                setValue('supplier_name', drData.SupplierName || '');
                setValue('requested_by_user_id', (drData.RequestedBy ?? drData.requestedByUser?.UserID ?? 0) as number);
                setValue('pr_number', drData.PRNumber || '');
                setValue('po_number', drData.PONumber || '');
                setValue('invoice_number', drData.InvoiceNumber || '');
                // Use date-fns-tz to ensure Asia/Manila timezone
                const zonedDate = toZonedTime(new Date(drData.DateReceived), 'Asia/Manila');
                setValue('date_received', formatInTimeZone(zonedDate, 'Asia/Manila', 'yyyy-MM-dd'));
                setValue('remarks', drData.Remarks || '');
                // Set current picture URL from API response
                if (drData.dr_picture_url) {
                    setCurrentPictureUrl(drData.dr_picture_url);
                    setPicturePreview(drData.dr_picture_url);
                }
                setValue('details', drData.details?.map(detail => ({
                    dr_detail_id: detail.DRDetailID, // Include the detail ID for updates
                    item_description: detail.ItemDescription,
                    brand: detail.Brand ?? '',
                    model_number: detail.ModelNumber ?? '',
                    serial_number: detail.SerialNumber ?? '',
                    property_type_id: detail.PropertyTypeID,
                    unit_of_measure_id: detail.UnitOfMeasureID || 1,
                    quantity_delivered: detail.QuantityDelivered,
                    unit_cost: parseFloat(String(detail.UnitCost)),
                })) || []);
            } catch {
                toast.error('Failed to load form data');
                router.push(`${baseRoute}/delivery-receipts`);
            } finally {
                setIsLoadingData(false);
                setIsLoadingDR(false);
            }
        };

        if (params.id) {
            fetchData();
        }
    }, [params.id, router, setValue, baseRoute]);

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
        return sum + (item.quantity_delivered * item.unit_cost || 0);
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

        fetchRequesters();
    }, []);

    const filteredRequesters = requesters.filter((user) => {
        const departmentName = user.DepartmentName || `Department ${user.DepartmentID}`;
        const label = `${user.FullName} - ${departmentName}`.toLowerCase();
        return label.includes(requesterQuery.trim().toLowerCase());
    });

    // Combobox state for accessible dropdown search
    const [comboboxOpen, setComboboxOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const comboboxRef = useRef<HTMLDivElement | null>(null);
    const comboboxInputRef = useRef<HTMLInputElement | null>(null);
    const comboboxListRef = useRef<HTMLUListElement | null>(null);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
                setComboboxOpen(false);
                setHighlightedIndex(-1);
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

    useEffect(() => {
        // If requester id is set externally (e.g. form reset), populate the visible combobox text.
        const requester = requesters.find((user) => user.UserID === watchedRequesterId);
        if (requester && requesterQuery.trim().length === 0) {
            const departmentName = requester.DepartmentName || `Department ${requester.DepartmentID}`;
            setRequesterQuery(`${requester.FullName} - ${departmentName}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedRequesterId, requesters]);

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
                // Extract the first file from FileList, only if a new file is selected
                const fileList = value as FileList;
                if (fileList && fileList.length > 0) {
                    formData.append(key, fileList[0]);
                }
                // If no file provided, we don't append it, so backend keeps existing picture
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
            await updateMutation.mutateAsync({
                id: parseInt(params.id as string),
                data: formData
            });
            toast.success('Delivery receipt updated successfully');
            router.push(`${baseRoute}/delivery-receipts/${params.id}`);
        } catch (err: unknown) {
            console.error('Full error object:', err);
            const resp = (err as { response?: { data?: { errors?: Record<string, string | string[]>; message?: string } } })?.response?.data;
            console.error('Response data:', resp);

            if (resp?.errors) {
                console.error('Validation errors:', resp.errors);
                Object.entries(resp.errors).forEach(([field, messages]) => {
                    const message = Array.isArray(messages) ? messages[0] : String(messages);
                    console.log(`Setting error for field: ${field} => ${message}`);
                    try {
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

            toast.error(resp?.message || 'Failed to update delivery receipt');
        }
    };

    const addItem = () => {
        setIsAddingItem(true);
        setEditingIndex(null);
        setIsItemModalOpen(true);
    };

    const handlePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setPicturePreview(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
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

    function SearchableType({ index }: { index: number }) {
        const selectedId = watch(`details.${index}.property_type_id`);
        const [query, setQuery] = useState('');
        const [open, setOpen] = useState(false);
        const [highlightedIndex, setHighlightedIndex] = useState(-1);
        const wrapperRef = useRef<HTMLDivElement | null>(null);
        const inputRef = useRef<HTMLInputElement | null>(null);
        const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

        useEffect(() => {
            const selected = propertyTypes.find(p => p.PropertyTypeID === selectedId);
            setQuery(selected ? selected.PropertyName : '');
        }, [selectedId]);

        useEffect(() => {
            const onClick = (e: MouseEvent) => {
                if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                    setOpen(false);
                    setHighlightedIndex(-1);
                }
            };
            document.addEventListener('click', onClick);
            return () => document.removeEventListener('click', onClick);
        }, []);

        useLayoutEffect(() => {
            if (!open) return;
            const update = () => {
                const el = inputRef.current;
                if (!el) return setCoords(null);
                const rect = el.getBoundingClientRect();
                setCoords({ top: rect.bottom, left: rect.left, width: rect.width });
            };
            update();
            window.addEventListener('scroll', update, true);
            window.addEventListener('resize', update);
            return () => {
                window.removeEventListener('scroll', update, true);
                window.removeEventListener('resize', update);
            };
        }, [open]);

        const filtered = propertyTypes.filter(p => p.PropertyName.toLowerCase().includes(query.toLowerCase()));

        const selectItem = (pt: PropertyType) => {
            setValue(`details.${index}.property_type_id`, pt.PropertyTypeID);
            setValue(`details.${index}.unit_of_measure_id`, 1); // Default to 'pc'
            setQuery(pt.PropertyName);
            setOpen(false);
            setHighlightedIndex(-1);
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (!open) {
                if (e.key === 'ArrowDown') {
                    setOpen(true);
                    setHighlightedIndex(0);
                }
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setHighlightedIndex(prev =>
                        prev < filtered.length - 1 ? prev + 1 : 0
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setHighlightedIndex(prev =>
                        prev > 0 ? prev - 1 : filtered.length - 1
                    );
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
                        selectItem(filtered[highlightedIndex]);
                    }
                    break;
                case 'Escape':
                    setOpen(false);
                    setHighlightedIndex(-1);
                    break;
            }
        };

        return (
            <div className="relative" ref={wrapperRef}>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        setHighlightedIndex(-1);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search property type..."
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 text-sm"
                />
                <input type="hidden" {...register(`details.${index}.property_type_id`, { valueAsNumber: true })} />

                {open && coords && createPortal(
                    <ul
                        style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 9999 }}
                        className="bg-white border border-slate-200 rounded mt-1 max-h-48 overflow-auto shadow-sm"
                    >
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-slate-500">No results</li>
                        ) : (
                            filtered.map((pt, idx) => (
                                <li
                                    key={pt.PropertyTypeID}
                                    onClick={() => selectItem(pt)}
                                    className={`px-3 py-2 cursor-pointer text-sm ${idx === highlightedIndex
                                        ? 'bg-[var(--primary)] text-white'
                                        : 'hover:bg-slate-100'
                                        }`}
                                >
                                    {pt.PropertyName}
                                </li>
                            ))
                        )}
                    </ul>,
                    document.body
                )}
            </div>
        );
    }

    if (isLoadingData || isLoadingDR) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed' }}>
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mx-auto" />
                    <p className="text-slate-600">Loading form data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
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
                        <h1 className="text-2xl font-bold text-slate-900">Edit Delivery Receipt</h1>
                        <p className="text-slate-500 text-sm">Update delivery receipt information</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Basic Information */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* DR Number */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Delivery Receipt Number *
                                </label>
                                <input
                                    {...register('dr_number')}
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                                    placeholder="Enter DR number"
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

                        {/* DR Picture */}
                        <div className="mt-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                DR Picture (Optional - leave blank to keep existing)
                            </label>
                            {picturePreview && (
                                <div className="mb-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
                                    <p className="text-sm font-medium text-slate-700 mb-2">Current Picture:</p>
                                    <img
                                        src={picturePreview}
                                        alt="DR Picture Preview"
                                        className="max-w-full h-auto rounded border border-slate-200"
                                        style={{ maxHeight: '300px' }}
                                    />
                                </div>
                            )}
                            <input
                                {...register('dr_picture')}
                                type="file"
                                accept="image/jpeg,image/png,image/jpg,image/gif"
                                onChange={handlePictureChange}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            />
                            <p className="text-xs text-slate-500 mt-2">Supported formats: JPEG, PNG, GIF (Max 2MB)</p>
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
                                                <div className="text-sm text-slate-700 font-medium">
                                                    {details[index]?.brand || '—'}{details[index]?.model_number ? ` / ${details[index].model_number}` : ''}{details[index]?.serial_number ? ` / ${details[index].serial_number}` : ''}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
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
                                                <div className="text-sm">₱{(details[index]?.unit_cost ?? 0).toFixed(2)}</div>
                                                {errors.details?.[index]?.unit_cost && (
                                                    <p className="mt-1 text-xs text-red-600">
                                                        {errors.details[index]?.unit_cost?.message}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-sm font-medium text-slate-700">
                                                ₱{((details[index]?.quantity_delivered || 0) * (details[index]?.unit_cost || 0)).toFixed(2)}
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
                                ₱{totalAmount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                            disabled={updateMutation.isPending}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {updateMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Update Delivery Receipt
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}