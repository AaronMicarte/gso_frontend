'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Loader2, Edit, AlertTriangle, Copy } from 'lucide-react';
import { useAllUnitsOfMeasure } from '@/lib/hooks/masterData/useUnitsOfMeasure';
import { ItemDetailsModal } from './ItemDetailsModal';
import { useForm, useFieldArray, Path } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from 'zod';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { getDeliveryReceipt, getDeliveryReceiptRequesters, getPropertyTypes, getSuppliers, getUsedSerialNumbers } from '@/lib/api/deliveryReceipts';
import issuanceAPI from '@/lib/api/issuance';
import { getActiveArticles } from '@/lib/api/masterData';
import { Article } from '@/types/masterData';
import { useUpdateDeliveryReceipt } from '@/lib/hooks/useDeliveryReceipts';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const drItemSchema = z.object({
    dr_detail_id: z.number().optional(),
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

    const serials = String(data.serial_number || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    if (serials.length > 0) {
        if (data.quantity_delivered !== serials.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['quantity_delivered'],
                message: `Quantity delivered must equal number of serial numbers (${serials.length})`,
            });
        }
        if (data.quantity_requested !== serials.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['quantity_requested'],
                message: `Quantity requested must equal number of serial numbers (${serials.length})`,
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
    dr_picture: z.custom<FileList>().optional(),
    details: z.array(drItemSchema).min(1, 'At least one item is required'),
    items_still_pending_delivery: z.boolean().optional(),
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

interface DRAssignmentRow {
    id: string;
    item_index: number;
    receiver_name: string;
    position_office: string;
    quantity: number;
}

export function EditDRPage({ baseRoute }: EditDRPageProps) {
    const params = useParams();
    const router = useRouter();
    const updateMutation = useUpdateDeliveryReceipt();
    const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [picturePreview, setPicturePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const manilaToday = formatInTimeZone(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
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
        formState: { errors },
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
            items_still_pending_delivery: false,
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

    const [usedSerials, setUsedSerials] = useState<string[]>([]);
    const [assignments, setAssignments] = useState<DRAssignmentRow[]>([]);
    const [receiverSuggestions, setReceiverSuggestions] = useState<Array<{ receiver_name: string; position_office?: string | null }>>([]);
    const [activeReceiverDropdown, setActiveReceiverDropdown] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        issuanceAPI.getReceiverSuggestions()
            .then(res => {
                if (!isMounted) return;
                const list = Array.isArray(res) ? res : (res?.data || []);
                setReceiverSuggestions(list);
            })
            .catch(err => {
                console.error("Failed to load receiver suggestions:", err);
            });
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const drId = parseInt(params.id as string);
                const [propertyTypesData, articlesData, drData, usedSerialsData] = await Promise.all([
                    getPropertyTypes(),
                    getActiveArticles(),
                    getDeliveryReceipt(drId),
                    getUsedSerialNumbers(drId)
                ]);
                setPropertyTypes(propertyTypesData);
                setArticles(articlesData);
                setUsedSerials(usedSerialsData || []);

                setValue('dr_number', drData.DRNumber);
                setValue('supplier_id', (drData.SupplierID ?? 0) as number);
                setValue('supplier_name', drData.SupplierName || '');
                setSupplierQuery(drData.SupplierName || '');
                setValue('requested_by_user_id', (drData.RequestedBy ?? drData.requestedByUser?.UserID ?? 0) as number);
                const reqName = drData.RequestedByName || drData.requestedByUser?.FullName || '';
                const deptName = drData.DepartmentName || drData.requestedByUser?.department?.DepartmentName || '';
                setRequesterQuery(reqName ? (deptName ? `${reqName} - ${deptName}` : reqName) : '');
                setValue('pr_number', drData.PRNumber || '');
                setValue('po_number', drData.PONumber || '');
                setValue('invoice_number', drData.InvoiceNumber || '');
                const zonedDate = toZonedTime(new Date(drData.DateReceived), 'Asia/Manila');
                setValue('date_received', formatInTimeZone(zonedDate, 'Asia/Manila', 'yyyy-MM-dd'));
                setValue('remarks', drData.Remarks || '');
                setValue('items_still_pending_delivery', Boolean(drData.IsPartial ?? drData.is_partial ?? false));
                if (drData.dr_picture_url) {
                    setPicturePreview(drData.dr_picture_url);
                }

                const loadedDetails = drData.details?.map(detail => ({
                    dr_detail_id: detail.DRDetailID,
                    article_id: detail.ArticleID || 0,
                    item_description: detail.ItemDescription,
                    brand: detail.Brand || '',
                    model_number: detail.ModelNumber || '',
                    serial_number: detail.SerialNumber || '',
                    property_type_id: detail.PropertyTypeID,
                    unit_of_measure_id: detail.UnitOfMeasureID || 1,
                    quantity_delivered: detail.QuantityDelivered,
                    quantity_requested: detail.QuantityRequested ?? detail.QuantityDelivered,
                    change_reason: detail.ChangeReason ?? '',
                    unit_cost: parseFloat(String(detail.UnitCost)),
                })) || [];

                setValue('details', loadedDetails);

                const loadedAssignments: DRAssignmentRow[] = [];

                const detailIdToIndex = new Map<number, number>();
                (drData.details || []).forEach((d, idx) => {
                    if (d.DRDetailID) detailIdToIndex.set(Number(d.DRDetailID), idx);
                });

                (drData.details || []).forEach((detail, idx) => {
                    const invDetails = detail.inventoryDetails || detail.inventoryDetails || [];
                    const endUserAssignments = detail.end_user_assignments || [];

                    const assignByInvId = new Map<number, { receiver_name: string; position_office: string }>();
                    endUserAssignments.forEach((a) => {
                        if (a && a.inventory_detail_id) {
                            assignByInvId.set(Number(a.inventory_detail_id), {
                                receiver_name: (a.receiver_name || '').toString(),
                                position_office: (a.position_office || '').toString(),
                            });
                        }
                    });

                    let hasAssignedForDetail = false;
                    const grouped = new Map<string, DRAssignmentRow>();
                    invDetails.forEach((inv) => {
                        const invId = Number(inv.InventoryDetailID || 0);
                        const a = assignByInvId.get(invId);
                        if (!a || !a.receiver_name) return;
                        hasAssignedForDetail = true;
                        const key = `${a.receiver_name}||${a.position_office}`;
                        if (grouped.has(key)) {
                            grouped.get(key)!.quantity += 1;
                        } else {
                            grouped.set(key, {
                                id: Math.random().toString(36).slice(2, 9),
                                item_index: idx,
                                receiver_name: a.receiver_name,
                                position_office: a.position_office,
                                quantity: 1,
                            });
                        }
                    });

                    if (!hasAssignedForDetail && endUserAssignments.length > 0) {
                        endUserAssignments.forEach(a => {
                            if (!a?.receiver_name) return;
                            const key = `${a.receiver_name}||${a.position_office || ''}`;
                            if (grouped.has(key)) {
                                grouped.get(key)!.quantity += 1;
                            } else {
                                grouped.set(key, {
                                    id: Math.random().toString(36).slice(2, 9),
                                    item_index: idx,
                                    receiver_name: a.receiver_name,
                                    position_office: a.position_office || '',
                                    quantity: 1,
                                });
                            }
                        });
                    }

                    grouped.forEach(row => loadedAssignments.push(row));
                });

                setAssignments(loadedAssignments);
            } catch {
                toast.error('Failed to load form data');
                router.push(`${baseRoute}/delivery-receipts`);
            } finally {
                setIsLoading(false);
            }
        };

        if (params.id) {
            fetchData();
        }
    }, [params.id, router, setValue, baseRoute]);

    const { data: unitsData } = useAllUnitsOfMeasure();
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

    const totalDeliveredQty = (details || []).reduce(
        (sum, item) => sum + (Number(item?.quantity_delivered) || 0),
        0
    );
    const totalAssignedQty = assignments.reduce(
        (sum, a) => sum + (Number(a.quantity) || 0),
        0
    );
    const isEverythingAssigned = totalDeliveredQty > 0 && totalAssignedQty >= totalDeliveredQty;

    const getItemAssignedQty = (itemIndex: number) =>
        assignments
            .filter(a => a.item_index === itemIndex)
            .reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);

    const isItemFullyAssigned = (itemIndex: number) => {
        const delivered = Number(details?.[itemIndex]?.quantity_delivered) || 0;
        return delivered > 0 && getItemAssignedQty(itemIndex) >= delivered;
    };

    const unassignedItems = (details || [])
        .map((item, idx) => {
            const delivered = Number(item?.quantity_delivered) || 0;
            const assigned = getItemAssignedQty(idx);
            const remaining = Math.max(0, delivered - assigned);
            return { idx, delivered, assigned, remaining };
        })
        .filter(x => x.remaining > 0);

    const hasUnassignedItems = unassignedItems.length > 0;

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

    const [comboboxOpen, setComboboxOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const comboboxRef = useRef<HTMLDivElement | null>(null);
    const comboboxInputRef = useRef<HTMLInputElement | null>(null);
    const comboboxListRef = useRef<HTMLUListElement | null>(null);

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
        const requester = requesters.find((user) => user.UserID === watchedRequesterId);
        if (requester && requesterQuery.trim().length === 0) {
            const departmentName = requester.DepartmentName || `Department ${requester.DepartmentID}`;
            setRequesterQuery(`${requester.FullName} - ${departmentName}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedRequesterId, requesters]);

    useEffect(() => {
        const supplierName = watch('supplier_name');
        if (supplierName && supplierQuery.trim().length === 0) {
            setSupplierQuery(supplierName);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watch('supplier_name'), suppliers]);

    const onSubmit = async (data: DRFormValues) => {
        if (data.date_received > manilaToday) {
            toast.error('Date received cannot be in the future.');
            return;
        }
        if (data.date_received < manilaMin) {
            toast.error(`Date received is too old. Minimum allowed is ${manilaMin}.`);
            return;
        }

        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (key === 'details') {
                const details = value as typeof data.details;
                details.forEach((item, index) => {
                    Object.entries(item).forEach(([itemKey, itemValue]) => {
                        if (itemValue !== undefined && itemValue !== null) {
                            formData.append(`details[${index}][${itemKey}]`, String(itemValue));
                        }
                    });
                });
            } else if (key === 'dr_picture') {
                const fileList = value as FileList;
                if (fileList && fileList.length > 0) {
                    formData.append(key, fileList[0]);
                }
            } else if (value !== undefined && value !== null) {
                if (typeof value === 'boolean') {
                    formData.append(key, value ? '1' : '0');
                } else {
                    formData.append(key, String(value));
                }
            }
        });

        // Always send assignments so backend always re-processes end user assignments.
        // Empty array => backend falls back all items to requesting officer.
        const payloadAssignments = assignments
            .filter(a => Number(a.quantity) > 0)
            .map(a => {
                const targetDetail = details?.[a.item_index];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const detailId = (targetDetail as any)?.dr_detail_id || (targetDetail as any)?.DRDetailID;
                return {
                    item_index: Number(a.item_index),
                    dr_detail_id: detailId ? Number(detailId) : undefined,
                    receiver_name: a.receiver_name ? a.receiver_name.trim() : '',
                    position_office: a.position_office?.trim() || null,
                    quantity: Number(a.quantity) || 1,
                };
            });

        formData.append('assignments', JSON.stringify(payloadAssignments));

        try {
            await updateMutation.mutateAsync({
                id: parseInt(params.id as string),
                data: formData
            });
            toast.success('Delivery receipt updated successfully');
            router.push(`${baseRoute}/delivery-receipts`);
        } catch (err: unknown) {
            console.error('Full error object:', err);
            const resp = (err as { response?: { data?: { errors?: Record<string, string | string[]>; message?: string } } })?.response?.data;
            console.error('Response data:', resp);

            if (resp?.errors) {
                Object.entries(resp.errors).forEach(([field, messages]) => {
                    const message = Array.isArray(messages) ? messages[0] : String(messages);
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
            article_id: item?.article_id || 0,
            item_description: item?.item_description || '',
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

    const handleRemoveItem = (index: number) => {
        remove(index);
        setAssignments(prev =>
            prev
                .filter(a => a.item_index !== index)
                .map(a => (a.item_index > index ? { ...a, item_index: a.item_index - 1 } : a))
        );
    };

    const addAssignmentRow = (itemIndex = 0, defaultReceiver = '', defaultPosition = '') => {
        if (isEverythingAssigned) {
            toast.info('All delivered quantities are already assigned.');
            return;
        }

        const targetItem = details?.[itemIndex];
        const deliveredQty = targetItem ? Number(targetItem.quantity_delivered) || 1 : 1;
        const alreadyAssigned = assignments
            .filter(a => a.item_index === itemIndex)
            .reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
        const remaining = Math.max(1, deliveredQty - alreadyAssigned);

        const newId = Math.random().toString(36).slice(2, 9);
        setAssignments(prev => [
            ...prev,
            {
                id: newId,
                item_index: itemIndex,
                receiver_name: defaultReceiver,
                position_office: defaultPosition,
                quantity: remaining,
            }
        ]);
    };

    const removeAssignmentRow = (id: string) => {
        setAssignments(prev => prev.filter(a => a.id !== id));
    };

    const updateAssignmentRow = (id: string, patch: Partial<DRAssignmentRow>) => {
        setAssignments(prev => prev.map(a => {
            if (a.id !== id) return a;
            const updated = { ...a, ...patch };
            if (patch.item_index !== undefined && patch.item_index !== a.item_index) {
                const targetItem = details?.[patch.item_index];
                const deliveredQty = targetItem ? Number(targetItem.quantity_delivered) || 1 : 1;
                const otherAssigned = prev
                    .filter(row => row.item_index === patch.item_index && row.id !== id)
                    .reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
                updated.quantity = Math.max(1, deliveredQty - otherAssigned);
            }
            return updated;
        }));
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
            setValue(`details.${index}.unit_of_measure_id`, 1);
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

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 w-full space-y-6">
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

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
                        <p className="mt-3 text-sm text-slate-500">Loading delivery receipt...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Basic Information */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                                <td className="py-3 px-3 text-sm text-slate-700">
                                                    {articles.find(a => a.id === details[index]?.article_id)?.name || '—'}
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
                                                    <div className="text-xs text-slate-500 mt-1">
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
                                                        <Copy className="w-4 h-4" />
                                                    </button>

                                                    {fields.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(index)}
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
                            existingSerials={Array.from(new Set([
                                ...usedSerials,
                                ...(details || [])
                                    .filter((_, idx) => isAddingItem || idx !== editingIndex)
                                    .flatMap(item => String(item?.serial_number || '').split(',').map(s => s.trim()).filter(Boolean))
                            ]))}
                        />

                        {/* End User Assignments Section */}
                        <div id="assignments-section" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-lg font-semibold text-slate-900">End User Assignments</h2>
                                        <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                                            Property Issuance
                                        </span>
                                        {isEverythingAssigned && (
                                            <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                                                All assigned ✓
                                            </span>
                                        )}
                                        {!isEverythingAssigned && fields.length > 0 && (
                                            <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-full border border-amber-200 inline-flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                {unassignedItems.reduce((s, x) => s + x.remaining, 0)} unassigned
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 text-xs mt-1">
                                        All delivered quantities must be assigned to end users before saving.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={fields.length === 0 || isEverythingAssigned}
                                        onClick={() => addAssignmentRow(0)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        title={
                                            isEverythingAssigned
                                                ? 'All delivered quantities are already assigned'
                                                : fields.length === 0
                                                    ? 'Add delivered items first'
                                                    : 'Add a new assignment row'
                                        }
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Assignment
                                    </button>
                                </div>
                            </div>

                            {fields.length > 0 && (
                                <div className="mb-5">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Allocation Status by Item
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {fields.map((field, idx) => {
                                            const item = details?.[idx];
                                            const articleName = articles.find(a => a.id === item?.article_id)?.name || 'Item';
                                            const desc = [item?.brand, item?.model_number].filter(Boolean).join(' ') || item?.item_description || '';
                                            const label = `${articleName}${desc ? ` (${desc})` : ''}`;
                                            const delivered = Number(item?.quantity_delivered) || 1;
                                            const assigned = assignments
                                                .filter(a => a.item_index === idx)
                                                .reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
                                            const isComplete = assigned === delivered;
                                            const isOver = assigned > delivered;

                                            return (
                                                <span
                                                    key={field.id}
                                                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${isOver
                                                        ? 'bg-red-50 border-red-200 text-red-700'
                                                        : isComplete
                                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                            : 'bg-amber-50 border-amber-200 text-amber-700'
                                                        }`}
                                                >
                                                    <span className="truncate max-w-[220px]">{label}</span>
                                                    <span className="font-bold">
                                                        {assigned}/{delivered}
                                                    </span>
                                                    {isComplete && <span className="text-[10px]">✓</span>}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {fields.length === 0 ? (
                                <div className="py-8 text-center text-sm text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    Add items in the &quot;Items Delivered&quot; section above first to configure end-user assignments.
                                </div>
                            ) : assignments.length === 0 ? (
                                <div className="py-6 px-4 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <p className="font-medium text-slate-700 mb-1">No assignments added yet</p>
                                    <p className="text-xs text-slate-400 mb-3">
                                        Every delivered item must be assigned to an end user before you can save.
                                    </p>
                                    <div className="flex items-center justify-center">
                                        <button
                                            type="button"
                                            onClick={() => addAssignmentRow(0)}
                                            disabled={isEverythingAssigned}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-lg shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add Assignment
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {assignments.map((row, rowIdx) => {
                                        const chosenItem = details?.[row.item_index];
                                        const deliveredQty = chosenItem ? Number(chosenItem.quantity_delivered) || 1 : 1;
                                        const otherAssigned = assignments
                                            .filter(r => r.item_index === row.item_index && r.id !== row.id)
                                            .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
                                        const maxAllowed = Math.max(1, deliveredQty - otherAssigned);
                                        const rowItemFullyAssigned = isItemFullyAssigned(row.item_index);

                                        return (
                                            <div
                                                key={row.id}
                                                className="relative border border-slate-200 hover:border-slate-300 rounded-xl bg-white shadow-xs transition-all"
                                            >
                                                <div className="absolute -top-2.5 left-3 bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                    #{rowIdx + 1}
                                                </div>

                                                <div className="p-4 pt-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                                                    <div className="sm:col-span-4 relative">
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                            Receiver Name *
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={row.receiver_name}
                                                            onFocus={() => setActiveReceiverDropdown(row.id)}
                                                            onChange={(e) => {
                                                                updateAssignmentRow(row.id, { receiver_name: e.target.value });
                                                                setActiveReceiverDropdown(row.id);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Escape') setActiveReceiverDropdown(null);
                                                            }}
                                                            placeholder="Enter complete name..."
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none font-medium text-slate-800"
                                                        />

                                                        {activeReceiverDropdown === row.id && (
                                                            <>
                                                                <div
                                                                    className="fixed inset-0 z-10"
                                                                    onClick={() => setActiveReceiverDropdown(null)}
                                                                />
                                                                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 max-h-56 overflow-y-auto divide-y divide-slate-100">
                                                                    {(() => {
                                                                        const q = (row.receiver_name || '').toLowerCase().trim();
                                                                        const matches = receiverSuggestions.filter(s =>
                                                                            !q ||
                                                                            s.receiver_name.toLowerCase().includes(q) ||
                                                                            (s.position_office && s.position_office.toLowerCase().includes(q))
                                                                        );

                                                                        if (matches.length === 0) {
                                                                            return (
                                                                                <div className="p-3 text-xs text-slate-400 italic text-center">
                                                                                    {q ? 'No matching receiver found' : 'No previous receivers found'}
                                                                                </div>
                                                                            );
                                                                        }

                                                                        return matches.map((s, sIdx) => (
                                                                            <button
                                                                                key={`${s.receiver_name}_${s.position_office || ''}_${sIdx}`}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    updateAssignmentRow(row.id, {
                                                                                        receiver_name: s.receiver_name,
                                                                                        position_office: s.position_office || row.position_office || '',
                                                                                    });
                                                                                    setActiveReceiverDropdown(null);
                                                                                }}
                                                                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                                                                            >
                                                                                <div className="flex flex-col min-w-0 pr-2">
                                                                                    <span className="font-semibold text-slate-800 group-hover:text-[var(--primary)] transition-colors truncate">
                                                                                        {s.receiver_name}
                                                                                    </span>
                                                                                    {s.position_office && (
                                                                                        <span className="text-[11px] text-slate-500 truncate mt-0.5">
                                                                                            {s.position_office}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                {s.position_office && (
                                                                                    <span className="shrink-0 text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                                                                        {s.position_office}
                                                                                    </span>
                                                                                )}
                                                                            </button>
                                                                        ));
                                                                    })()}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className="sm:col-span-3">
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                            Position / Office
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={row.position_office}
                                                            onChange={(e) => updateAssignmentRow(row.id, { position_office: e.target.value })}
                                                            placeholder="e.g. Admin Officer"
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none font-medium text-slate-800"
                                                        />
                                                    </div>

                                                    <div className="sm:col-span-3">
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                            Assigned Item *
                                                        </label>
                                                        <select
                                                            value={row.item_index}
                                                            onChange={(e) => updateAssignmentRow(row.id, { item_index: Number(e.target.value) })}
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none font-medium text-slate-800 bg-white"
                                                        >
                                                            {fields.map((f, fIdx) => {
                                                                const it = details?.[fIdx];
                                                                const artName = articles.find(a => a.id === it?.article_id)?.name || 'Item';
                                                                const dsc = [it?.brand, it?.model_number].filter(Boolean).join(' ') || it?.item_description || '';
                                                                const fullLabel = `${artName}${dsc ? ` - ${dsc}` : ''} (Qty: ${it?.quantity_delivered || 1})`;
                                                                return (
                                                                    <option key={f.id} value={fIdx}>
                                                                        {fullLabel}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>

                                                    <div className="sm:col-span-1">
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                            Qty *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={maxAllowed}
                                                            value={row.quantity}
                                                            onChange={(e) => updateAssignmentRow(row.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                                                            className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm text-center font-bold focus:ring-2 focus:ring-[var(--primary)] outline-none"
                                                        />
                                                    </div>

                                                    <div className="sm:col-span-1 flex items-center justify-end gap-1.5 pt-6">
                                                        <button
                                                            type="button"
                                                            onClick={() => addAssignmentRow(row.item_index, row.receiver_name, row.position_office)}
                                                            disabled={rowItemFullyAssigned}
                                                            title={
                                                                rowItemFullyAssigned
                                                                    ? 'This item is fully assigned'
                                                                    : 'Add another item for this receiver'
                                                            }
                                                            className="p-1.5 text-slate-400 hover:text-[var(--primary)] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeAssignmentRow(row.id)}
                                                            title="Remove assignment"
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
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
                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        {...register('items_still_pending_delivery')}
                                        className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]/20"
                                    />
                                    <span>
                                        <span className="block text-sm font-medium text-slate-900">Items Still Pending Delivery</span>
                                        <span className="block text-sm text-slate-500 mt-1">
                                            Check if some items are missing, broken, or not yet ready. The DR will remain Partial / For Issuance until finalized.
                                        </span>
                                    </span>
                                </label>
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
                                disabled={updateMutation.isPending || hasUnassignedItems}
                                title={
                                    hasUnassignedItems
                                        ? 'All delivered items must be assigned to an end user before saving'
                                        : 'Update delivery receipt'
                                }
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
                )}
            </div>
        </div>
    );
}