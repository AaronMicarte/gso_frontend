'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, PlusCircle, Trash2, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import transferAPI from '@/lib/api/transfer';
import {
    PropertyTransferCreatePayload,
    TransferDepartment,
    TransferEndUser,
    TransferableItem,
} from '@/types/propertyTransfer';
import { useAuth } from '@/lib/hooks/useAuth';
import { ArticlePreviewModal } from '@/components/ui/ArticlePreviewModal';
import { resolveStorageUrl } from '@/lib/utils/signature';

interface TransferCreatePageProps {
    baseRoute: string;
}

export function TransferCreatePage({ baseRoute }: TransferCreatePageProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [departments, setDepartments] = useState<TransferDepartment[]>([]);
    const [fromEndUsers, setFromEndUsers] = useState<TransferEndUser[]>([]);
    const [availableItems, setAvailableItems] = useState<TransferableItem[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<Array<{ key: string; quantity: number }>>([]);
    const [availableQuantities, setAvailableQuantities] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [itemLoading, setItemLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [reason, setReason] = useState('');
    const [fromEndUserSearch, setFromEndUserSearch] = useState('');
    const [releasingComboboxOpen, setReleasingComboboxOpen] = useState(false);
    const [releasingHighlightedIndex, setReleasingHighlightedIndex] = useState(-1);
    const releasingComboboxRef = useRef<HTMLDivElement | null>(null);
    const [receivingDepartmentQuery, setReceivingDepartmentQuery] = useState('');
    const [receivingDepartmentComboboxOpen, setReceivingDepartmentComboboxOpen] = useState(false);
    const [receivingDepartmentHighlightedIndex, setReceivingDepartmentHighlightedIndex] = useState(-1);
    const receivingDepartmentComboboxRef = useRef<HTMLDivElement | null>(null);
    const [requestingDepartmentQuery, setRequestingDepartmentQuery] = useState('');
    const [requestingDepartmentComboboxOpen, setRequestingDepartmentComboboxOpen] = useState(false);
    const [requestingDepartmentHighlightedIndex, setRequestingDepartmentHighlightedIndex] = useState(-1);
    const requestingDepartmentComboboxRef = useRef<HTMLDivElement | null>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [paginationMeta, setPaginationMeta] = useState<{
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    } | null>(null);

    const [fromDepartmentId, setFromDepartmentId] = useState<number | ''>('');
    const [toDepartmentId, setToDepartmentId] = useState<number | ''>('');
    const [fromEndUserId, setFromEndUserId] = useState<number | ''>('');
    const [toEndUserId, setToEndUserId] = useState<number | ''>('');

    const [receivingEndUser, setReceivingEndUser] = useState<TransferEndUser | null>(null);
    const [receivingError, setReceivingError] = useState<string | null>(null);

    const isDepartmentHead = user?.UserRoleID === 4;

    const formattedToday = format(toZonedTime(new Date(), 'Asia/Manila'), 'MMM dd, yyyy');

    const loadHelpers = useCallback(async () => {
        try {
            const [deptData, releasingEndUsers] = await Promise.all([
                transferAPI.getDepartments(),
                transferAPI.getEndUsers(undefined, { excludeGso: true }),
            ]);
            setDepartments(deptData);
            setFromEndUsers(releasingEndUsers);
        } catch {
            toast.error('Failed to load transfer helpers');
        }
    }, []);

    const loadAvailableItems = useCallback(async () => {
        if (!fromDepartmentId || !fromEndUserId) {
            setAvailableItems([]);
            setPaginationMeta(null);
            return;
        }

        try {
            setItemLoading(true);
            const response = await transferAPI.getAvailableItems({
                search: searchTerm || undefined,
                from_department_id: Number(fromDepartmentId),
                from_end_user_id: Number(fromEndUserId),
                per_page: 10,
                page: currentPage,
            });

            setAvailableItems(response.data || []);
            setPaginationMeta({
                current_page: response.current_page || 1,
                last_page: response.last_page || 1,
                per_page: response.per_page || 10,
                total: response.total || 0,
            });
        } catch {
            toast.error('Failed to load transfer items');
            setAvailableItems([]);
            setPaginationMeta(null);
        } finally {
            setItemLoading(false);
        }
    }, [fromDepartmentId, fromEndUserId, searchTerm, currentPage]);

    useEffect(() => {
        loadHelpers();
    }, [loadHelpers]);

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (releasingComboboxRef.current && !releasingComboboxRef.current.contains(event.target as Node)) {
                setReleasingComboboxOpen(false);
                setReleasingHighlightedIndex(-1);
            }
            if (receivingDepartmentComboboxRef.current
                && !receivingDepartmentComboboxRef.current.contains(event.target as Node)) {
                setReceivingDepartmentComboboxOpen(false);
                setReceivingDepartmentHighlightedIndex(-1);
            }
            if (requestingDepartmentComboboxRef.current
                && !requestingDepartmentComboboxRef.current.contains(event.target as Node)) {
                setRequestingDepartmentComboboxOpen(false);
                setRequestingDepartmentHighlightedIndex(-1);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    useEffect(() => {
        if (isDepartmentHead && user?.DepartmentID) {
            setToDepartmentId(user.DepartmentID);
            const ownDepartment = departments.find((dept) => dept.DepartmentID === user.DepartmentID);
            if (ownDepartment) {
                setReceivingDepartmentQuery(ownDepartment.DepartmentName);
            }
        }
    }, [isDepartmentHead, user?.DepartmentID, departments]);

    useEffect(() => {
        if (!toDepartmentId) {
            setToEndUserId('');
            setReceivingEndUser(null);
            setReceivingError(null);
            return;
        }

        transferAPI.getEndUsers(Number(toDepartmentId))
            .then((endUsers) => {
                if (endUsers.length === 0) {
                    setToEndUserId('');
                    setReceivingEndUser(null);
                    setReceivingError('No active Department Head found for the selected department.');
                    return;
                }

                if (!isDepartmentHead) {
                    const autoSelected = endUsers.find((entry) => entry.EndUserID === Number(toEndUserId)) || endUsers[0];
                    setReceivingEndUser(autoSelected);
                    setToEndUserId(autoSelected.EndUserID);
                    if (autoSelected.DepartmentName) {
                        setReceivingDepartmentQuery(autoSelected.DepartmentName);
                    }
                    setReceivingError(null);
                } else {
                    const requesterName = (user?.FullName || '').trim().toLowerCase();
                    const match = endUsers.find((entry) => entry.FullName.trim().toLowerCase() === requesterName) || null;
                    const autoSelected = match || endUsers[0];
                    setReceivingEndUser(autoSelected);
                    setToEndUserId(autoSelected.EndUserID);
                    if (autoSelected.DepartmentName) {
                        setReceivingDepartmentQuery(autoSelected.DepartmentName);
                    }
                    setReceivingError(null);
                }
            })
            .catch(() => toast.error('Failed to load receiving Department Head'));
    }, [toDepartmentId, user?.FullName, isDepartmentHead, toEndUserId]);

    useEffect(() => {
        loadAvailableItems();
    }, [loadAvailableItems]);

    useEffect(() => {
        setSelectedGroups([]);
        setAvailableQuantities({});
        setCurrentPage(1);
        setPaginationMeta(null);
    }, [fromDepartmentId, fromEndUserId])

    type GroupedAvailableItem = {
        key: string;
        items: TransferableItem[];
        article: string;
        itemDescription: string;
        fullSpecs: string;
        unitName: string;
    };

    const buildItemDescription = useCallback((item: TransferableItem) => (
        item.ItemDescription || item.InventoryDescription || item.AssignedDescription || 'Item'
    ), []);

    const buildFullSpecs = useCallback((item: TransferableItem) => (
        [item.Brand, item.ModelNumber, item.SerialNumber ? `SN: ${item.SerialNumber}` : null]
            .filter(Boolean)
            .join(' | ')
    ), []);

    const buildGroupKey = useCallback((item: TransferableItem) => {
        const articleKey = item.ArticleName || 'no-article';
        const brandKey = item.Brand || 'no-brand';
        const modelKey = item.ModelNumber || 'no-model';
        const descKey = buildItemDescription(item);
        const unitKey = item.UnitName || 'unit';
        return `${articleKey}||${brandKey}||${modelKey}||${descKey}||${unitKey}`;
    }, [buildItemDescription]);

    const groupedAvailableItems = useMemo(() => {
        const groups = new Map<string, GroupedAvailableItem>();

        for (const item of availableItems) {
            const key = buildGroupKey(item);
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    items: [],
                    article: item.ArticleName || 'Missing article',
                    itemDescription: buildItemDescription(item),
                    fullSpecs: buildFullSpecs(item) || 'Missing full specs',
                    unitName: item.UnitName || 'unit',
                });
            }
            groups.get(key)!.items.push(item);
        }

        return Array.from(groups.values())
            .map((group) => {
                const sortedItems = [...group.items].sort((a, b) => {
                    const left = a.PropertyNumber || '';
                    const right = b.PropertyNumber || '';
                    return left.localeCompare(right);
                });
                return { ...group, items: sortedItems };
            })
            .sort((a, b) =>
                a.article.toLowerCase().localeCompare(b.article.toLowerCase())
            );
    }, [availableItems, buildGroupKey, buildItemDescription, buildFullSpecs]);


    useEffect(() => {
        if (groupedAvailableItems.length === 0) {
            setAvailableQuantities({});
            setSelectedGroups([]);
            return;
        }

        setAvailableQuantities((prev) => {
            const next: Record<string, number> = {};
            for (const group of groupedAvailableItems) {
                const existing = prev[group.key];
                const maxQty = group.items.length;
                const clamped = typeof existing === 'number'
                    ? Math.min(Math.max(existing, 1), maxQty)
                    : 1;
                next[group.key] = clamped;
            }
            return next;
        });

        setSelectedGroups((prev) => (
            prev
                .filter((entry) => groupedAvailableItems.some((group) => group.key === entry.key))
                .map((entry) => {
                    const group = groupedAvailableItems.find((g) => g.key === entry.key);
                    const maxQty = group ? group.items.length : entry.quantity;
                    return {
                        ...entry,
                        quantity: Math.min(Math.max(entry.quantity, 1), maxQty),
                    };
                })
        ));
    }, [groupedAvailableItems]);

    const updateAvailableQuantity = (key: string, value: number, maxQty: number) => {
        const nextValue = Math.min(Math.max(value, 1), maxQty);

        setAvailableQuantities((prev) => ({ ...prev, [key]: nextValue }));

        setSelectedGroups((prev) => prev.map((entry) => {
            if (entry.key !== key) return entry;
            const clamped = Math.min(Math.max(nextValue, 1), maxQty);
            return { ...entry, quantity: clamped };
        }));
    };

    const handleAddGroup = (group: GroupedAvailableItem) => {
        const desiredQty = availableQuantities[group.key] ?? 1;
        const maxQty = group.items.length;
        const nextQty = Math.min(Math.max(desiredQty, 1), maxQty);

        setSelectedGroups((prev) => {
            const existing = prev.find((entry) => entry.key === group.key);
            if (existing) {
                return prev.map((entry) => (
                    entry.key === group.key ? { ...entry, quantity: nextQty } : entry
                ));
            }
            return [...prev, { key: group.key, quantity: nextQty }];
        });
    };

    const handleRemoveGroup = (key: string) => {
        setSelectedGroups((prev) => prev.filter((entry) => entry.key !== key));
    };

    const isGroupSelected = (key: string) => selectedGroups.some((entry) => entry.key === key);

    const renderPropertyNumbers = (items: TransferableItem[]) => {
        if (items.length <= 1) {
            return items[0]?.PropertyNumber || 'Missing property number';
        }

        return (
            <details className="text-sm text-slate-700">
                <summary className="cursor-pointer text-slate-700">Multiple ({items.length})</summary>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {items.map((item) => (
                        <div key={item.InventoryDetailID}>{item.PropertyNumber || 'Missing property number'}</div>
                    ))}
                </div>
            </details>
        );
    };

    const resolveArticleImageUrl = (raw?: string | null): string | null => {
        const value = (raw || '').trim();
        if (!value) return null;
        const normalized = value.replace(/^\/+/, '');
        const mapped = normalized.startsWith('article_images/') ? `/storage/${normalized}` : value;
        return resolveStorageUrl(mapped);
    };

    const filteredFromEndUsers = useMemo(() => {
        const term = fromEndUserSearch.trim().toLowerCase();
        const requesterName = (user?.FullName || '').trim().toLowerCase();
        const requesterDepartmentId = user?.DepartmentID ?? null;

        return fromEndUsers.filter((endUser) => {
            if (requesterDepartmentId && endUser.DepartmentID === requesterDepartmentId) {
                return false;
            }
            if (requesterName && endUser.FullName.trim().toLowerCase() === requesterName) {
                return false;
            }
            if (fromDepartmentId && Number(endUser.DepartmentID ?? 0) !== Number(fromDepartmentId)) {
                return false;
            }
            if (!term) return true;
            const display = `${endUser.FullName} ${endUser.DepartmentName ?? ''}`.toLowerCase();
            return display.includes(term);
        });
    }, [fromEndUsers, fromEndUserSearch, user?.FullName, user?.DepartmentID, fromDepartmentId]);

    const usersByDepartment = useMemo(() => {
        const map: Record<number, string[]> = {};
        for (const endUser of fromEndUsers) {
            const depId = Number(endUser.DepartmentID ?? 0);
            if (!depId) continue;
            if (!map[depId]) map[depId] = [];
            map[depId].push(endUser.FullName);
        }
        return map;
    }, [fromEndUsers]);

    const filteredRequestingDepartments = useMemo(() => {
        const term = requestingDepartmentQuery.trim().toLowerCase();
        if (!term) return departments;
        return departments.filter((department) => {
            if (department.DepartmentName.toLowerCase().includes(term)) return true;
            const users = usersByDepartment[department.DepartmentID] || [];
            return users.some((name) => name.toLowerCase().includes(term));
        });
    }, [departments, requestingDepartmentQuery, usersByDepartment]);

    const filteredReceivingDepartments = useMemo(() => {
        const term = receivingDepartmentQuery.trim().toLowerCase();
        if (!term) return departments;

        return departments.filter((department) => (
            department.DepartmentName.toLowerCase().includes(term)
            || (usersByDepartment[department.DepartmentID] || []).some((name) => name.toLowerCase().includes(term))
        ));
    }, [departments, receivingDepartmentQuery, usersByDepartment]);

    const selectedReceivingDepartment = useMemo(() => (
        departments.find((department) => department.DepartmentID === Number(toDepartmentId)) || null
    ), [departments, toDepartmentId]);

    const requestedByDisplay = useMemo(() => {
        const departmentName = selectedReceivingDepartment?.DepartmentName
            || receivingEndUser?.DepartmentName
            || null;

        if (receivingEndUser) {
            return `${receivingEndUser.FullName}${departmentName ? ` - ${departmentName}` : ''}`;
        }

        if (departmentName) {
            return `Pending custodian selection - ${departmentName}`;
        }

        return 'Select receiving department';
    }, [receivingEndUser, selectedReceivingDepartment]);

    const selectReceivingDepartment = (department: TransferDepartment) => {
        setReceivingDepartmentQuery(department.DepartmentName);
        setToDepartmentId(department.DepartmentID);
        setReceivingDepartmentComboboxOpen(false);
        setReceivingDepartmentHighlightedIndex(-1);
    };

    const selectRequestingDepartment = (department: TransferDepartment) => {
        setRequestingDepartmentQuery(department.DepartmentName);
        setFromDepartmentId(department.DepartmentID);
        setFromEndUserId('');
        setFromEndUserSearch('');
        setRequestingDepartmentComboboxOpen(false);
        setRequestingDepartmentHighlightedIndex(-1);
    };

    const canSubmit = useMemo(() => {
        return !!fromDepartmentId
            && !!toDepartmentId
            && !!fromEndUserId
            && !!toEndUserId
            && selectedGroups.length > 0
            && fromDepartmentId !== toDepartmentId
            && !receivingError;
    }, [fromDepartmentId, toDepartmentId, fromEndUserId, toEndUserId, selectedGroups, receivingError]);

    const handleSubmit = async () => {
        if (!canSubmit) {
            toast.error('Complete all required fields before submitting');
            return;
        }

        const groupedByKey = new Map(groupedAvailableItems.map((group) => [group.key, group]));
        const inventoryDetailIds: number[] = [];

        for (const entry of selectedGroups) {
            const group = groupedByKey.get(entry.key);
            if (!group) continue;
            const maxQty = group.items.length;
            const qty = Math.min(Math.max(entry.quantity, 1), maxQty);
            const selectedItems = group.items.slice(0, qty);
            inventoryDetailIds.push(...selectedItems.map((item) => item.InventoryDetailID));
        }

        if (inventoryDetailIds.length === 0) {
            toast.error('Select at least one item to transfer');
            return;
        }

        const payload: PropertyTransferCreatePayload = {
            from_department_id: Number(fromDepartmentId),
            to_department_id: Number(toDepartmentId),
            from_end_user_id: Number(fromEndUserId),
            to_end_user_id: Number(toEndUserId),
            reason: reason.trim() || null,
            items: inventoryDetailIds.map((inventoryDetailId) => ({
                inventory_detail_id: inventoryDetailId,
                quantity: 1,
            })),
        };

        try {
            setLoading(true);
            const response = await transferAPI.create(payload);
            toast.success('Transfer request submitted');
            router.push(`${baseRoute}/${response.transfer.TransferID}`);
        } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { message?: string } } };
            const message = maybeAxios?.response?.data?.message;
            toast.error(message || 'Failed to submit transfer request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Create Transfer Request</h1>
                    <p className="text-slate-500 text-sm">Request transfer of assets from another department</p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="text-sm text-slate-600">Request Date: {formattedToday}</div>
                            <div className="text-sm text-slate-600">
                                Requested By: {requestedByDisplay}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Releasing Custodian (Department Head)</label>
                                    <div className="relative mt-2" ref={releasingComboboxRef}>
                                        <input
                                            type="text"
                                            role="combobox"
                                            aria-expanded={releasingComboboxOpen}
                                            aria-controls="releasing-listbox"
                                            aria-autocomplete="list"
                                            value={fromEndUserSearch}
                                            onChange={(event) => {
                                                setFromEndUserSearch(event.target.value);
                                                setFromEndUserId('');
                                                setFromDepartmentId('');
                                                setReleasingComboboxOpen(true);
                                                setReleasingHighlightedIndex(-1);
                                            }}
                                            onFocus={() => setReleasingComboboxOpen(true)}
                                            onKeyDown={(event) => {
                                                if (!releasingComboboxOpen) return;
                                                if (event.key === 'ArrowDown') {
                                                    event.preventDefault();
                                                    setReleasingHighlightedIndex((prev) => Math.min(prev + 1, filteredFromEndUsers.length - 1));
                                                } else if (event.key === 'ArrowUp') {
                                                    event.preventDefault();
                                                    setReleasingHighlightedIndex((prev) => Math.max(prev - 1, 0));
                                                } else if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    const selected = filteredFromEndUsers[releasingHighlightedIndex];
                                                    if (selected) {
                                                        setFromEndUserId(selected.EndUserID);
                                                        setFromDepartmentId(selected.DepartmentID ?? '');
                                                        setRequestingDepartmentQuery(selected.DepartmentName || '');
                                                        setFromEndUserSearch(`${selected.FullName} (Department Head)${selected.DepartmentName ? ` - ${selected.DepartmentName}` : ''}`);
                                                        setReleasingComboboxOpen(false);
                                                    }
                                                } else if (event.key === 'Escape') {
                                                    setReleasingComboboxOpen(false);
                                                    setReleasingHighlightedIndex(-1);
                                                }
                                            }}
                                            placeholder="Search releasing Department Head"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                        />
                                        {releasingComboboxOpen && (
                                            <ul id="releasing-listbox" role="listbox" className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-48 overflow-auto">
                                                {filteredFromEndUsers.length === 0 ? (
                                                    <li className="px-3 py-2 text-sm text-slate-500">No matching Department Heads.</li>
                                                ) : (
                                                    filteredFromEndUsers.map((endUser, idx) => (
                                                        <li
                                                            key={endUser.EndUserID}
                                                            role="option"
                                                            aria-selected={releasingHighlightedIndex === idx}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                setFromEndUserId(endUser.EndUserID);
                                                                setFromDepartmentId(endUser.DepartmentID ?? '');
                                                                setRequestingDepartmentQuery(endUser.DepartmentName || '');
                                                                setFromEndUserSearch(`${endUser.FullName} (Department Head)${endUser.DepartmentName ? ` - ${endUser.DepartmentName}` : ''}`);
                                                                setReleasingComboboxOpen(false);
                                                            }}
                                                            onMouseEnter={() => setReleasingHighlightedIndex(idx)}
                                                            className={`px-3 py-2 text-sm cursor-pointer ${releasingHighlightedIndex === idx ? 'bg-[var(--primary)] text-white' : 'hover:bg-slate-100'}`}
                                                        >
                                                            {endUser.FullName} (Department Head){endUser.DepartmentName ? ` - ${endUser.DepartmentName}` : ''}
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Requesting Department</label>
                                    <div className="relative mt-2" ref={requestingDepartmentComboboxRef}>
                                        <input
                                            type="text"
                                            role="combobox"
                                            aria-expanded={requestingDepartmentComboboxOpen}
                                            aria-controls="requesting-department-listbox"
                                            aria-autocomplete="list"
                                            value={requestingDepartmentQuery}
                                            onChange={(event) => {
                                                setRequestingDepartmentQuery(event.target.value);
                                                setFromDepartmentId('');
                                                setFromEndUserId('');
                                                setFromEndUserSearch('');
                                                setRequestingDepartmentComboboxOpen(true);
                                                setRequestingDepartmentHighlightedIndex(-1);
                                            }}
                                            onFocus={() => setRequestingDepartmentComboboxOpen(true)}
                                            onKeyDown={(event) => {
                                                if (!requestingDepartmentComboboxOpen) return;
                                                if (event.key === 'ArrowDown') {
                                                    event.preventDefault();
                                                    setRequestingDepartmentHighlightedIndex((prev) => Math.min(prev + 1, filteredRequestingDepartments.length - 1));
                                                } else if (event.key === 'ArrowUp') {
                                                    event.preventDefault();
                                                    setRequestingDepartmentHighlightedIndex((prev) => Math.max(prev - 1, 0));
                                                } else if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    const selected = filteredRequestingDepartments[requestingDepartmentHighlightedIndex];
                                                    if (selected) selectRequestingDepartment(selected);
                                                } else if (event.key === 'Escape') {
                                                    setRequestingDepartmentComboboxOpen(false);
                                                    setRequestingDepartmentHighlightedIndex(-1);
                                                }
                                            }}
                                            placeholder="Search requesting department"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                        />
                                        {requestingDepartmentComboboxOpen && (
                                            <ul id="requesting-department-listbox" role="listbox" className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-48 overflow-auto">
                                                {filteredRequestingDepartments.length === 0 ? (
                                                    <li className="px-3 py-2 text-sm text-slate-500">No matching departments.</li>
                                                ) : (
                                                    filteredRequestingDepartments.map((department, idx) => (
                                                        <li
                                                            key={department.DepartmentID}
                                                            role="option"
                                                            aria-selected={requestingDepartmentHighlightedIndex === idx}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                selectRequestingDepartment(department);
                                                            }}
                                                            onMouseEnter={() => setRequestingDepartmentHighlightedIndex(idx)}
                                                            className={`px-3 py-2 text-sm cursor-pointer ${requestingDepartmentHighlightedIndex === idx ? 'bg-[var(--primary)] text-white' : 'hover:bg-slate-100'}`}
                                                        >
                                                            <div>{department.DepartmentName}</div>
                                                            <div className="text-xs opacity-75">{(usersByDepartment[department.DepartmentID] || []).map(u => `${u} (Head)`).slice(0, 2).join(', ') || 'No Department Head'}</div>
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Receiving Department</label>
                                    {isDepartmentHead ? (
                                        <input
                                            type="text"
                                            value={selectedReceivingDepartment?.DepartmentName || user?.Department || 'Missing department'}
                                            readOnly
                                            className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-700"
                                        />
                                    ) : (
                                        <div className="relative mt-2" ref={receivingDepartmentComboboxRef}>
                                            <input
                                                type="text"
                                                role="combobox"
                                                aria-expanded={receivingDepartmentComboboxOpen}
                                                aria-controls="receiving-department-listbox"
                                                aria-autocomplete="list"
                                                value={receivingDepartmentQuery}
                                                onChange={(event) => {
                                                    setReceivingDepartmentQuery(event.target.value);
                                                    setToDepartmentId('');
                                                    setToEndUserId('');
                                                    setReceivingEndUser(null);
                                                    setReceivingError(null);
                                                    setReceivingDepartmentComboboxOpen(true);
                                                    setReceivingDepartmentHighlightedIndex(-1);
                                                }}
                                                onFocus={() => setReceivingDepartmentComboboxOpen(true)}
                                                onKeyDown={(event) => {
                                                    if (!receivingDepartmentComboboxOpen) return;
                                                    if (event.key === 'ArrowDown') {
                                                        event.preventDefault();
                                                        setReceivingDepartmentHighlightedIndex((prev) => Math.min(prev + 1, filteredReceivingDepartments.length - 1));
                                                    } else if (event.key === 'ArrowUp') {
                                                        event.preventDefault();
                                                        setReceivingDepartmentHighlightedIndex((prev) => Math.max(prev - 1, 0));
                                                    } else if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        const selected = filteredReceivingDepartments[receivingDepartmentHighlightedIndex];
                                                        if (selected) {
                                                            selectReceivingDepartment(selected);
                                                        }
                                                    } else if (event.key === 'Escape') {
                                                        setReceivingDepartmentComboboxOpen(false);
                                                        setReceivingDepartmentHighlightedIndex(-1);
                                                    }
                                                }}
                                                placeholder="Search receiving department"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                            />
                                            {receivingDepartmentComboboxOpen && (
                                                <ul id="receiving-department-listbox" role="listbox" className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-48 overflow-auto">
                                                    {filteredReceivingDepartments.length === 0 ? (
                                                        <li className="px-3 py-2 text-sm text-slate-500">No matching departments.</li>
                                                    ) : (
                                                        filteredReceivingDepartments.map((department, idx) => (
                                                            <li
                                                                key={department.DepartmentID}
                                                                role="option"
                                                                aria-selected={receivingDepartmentHighlightedIndex === idx}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    selectReceivingDepartment(department);
                                                                }}
                                                                onMouseEnter={() => setReceivingDepartmentHighlightedIndex(idx)}
                                                                className={`px-3 py-2 text-sm cursor-pointer ${receivingDepartmentHighlightedIndex === idx ? 'bg-[var(--primary)] text-white' : 'hover:bg-slate-100'}`}
                                                            >
                                                                <div>{department.DepartmentName}</div>
                                                                <div className="text-xs opacity-75">{(usersByDepartment[department.DepartmentID] || []).map(u => `${u} (Head)`).slice(0, 2).join(', ') || 'No Department Head'}</div>
                                                            </li>
                                                        ))
                                                    )}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Receiving Custodian (Department Head)</label>
                                    <input
                                        type="text"
                                        value={receivingEndUser
                                            ? `${receivingEndUser.FullName} (Department Head)${receivingEndUser.DepartmentName ? ` - ${receivingEndUser.DepartmentName}` : ''}`
                                            : (toDepartmentId ? 'No active Department Head for this department' : 'Auto-selected based on receiving department')}
                                        readOnly
                                        className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-700"
                                    />
                                    {receivingError && (
                                        <p className="mt-2 text-sm text-red-600">{receivingError}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700">Reason / Notes</label>
                                <textarea
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    rows={3}
                                    className="mt-2 w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)]"
                                    placeholder="Optional reason for transfer"
                                />
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Transferable Items</h2>
                                    <p className="text-sm text-slate-500">Select assets from the releasing custodian</p>
                                </div>
                                <div className="relative w-full md:max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search items"
                                        value={searchTerm}
                                        onChange={(event) => {
                                            setSearchTerm(event.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {itemLoading ? (
                                <div className="text-sm text-slate-500">Loading available items...</div>
                            ) : groupedAvailableItems.length === 0 ? (
                                <div className="text-sm text-slate-500">
                                    {(!fromDepartmentId || !fromEndUserId)
                                        ? 'Select a releasing custodian to view transferable assets.'
                                        : 'No eligible items found (issued only, not already in an active transfer).'}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {groupedAvailableItems.map((group) => {
                                        const selected = isGroupSelected(group.key);
                                        const maxQty = group.items.length;
                                        const quantity = availableQuantities[group.key] ?? 1;

                                        return (
                                            <div key={group.key} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                    <div className="flex items-start gap-3">
                                                        {(() => {
                                                            const imgUrl = resolveArticleImageUrl(group.items[0]?.ArticleImage);
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (!imgUrl) return;
                                                                        setPreviewImageUrl(imgUrl);
                                                                        setIsImageModalOpen(true);
                                                                    }}
                                                                    className="h-14 w-14 overflow-hidden rounded border border-slate-200 bg-slate-50 flex items-center justify-center"
                                                                    title={imgUrl ? 'Click to preview image' : 'No image available'}
                                                                >
                                                                    {imgUrl ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img src={imgUrl} alt={group.article} className="h-full w-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-400">No image</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-900">{group.article}</div>
                                                            <div className="text-xs text-slate-500">{group.itemDescription}</div>
                                                            <div className="text-xs text-slate-500">{group.fullSpecs}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-sm text-slate-600">Available: {maxQty}</div>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={maxQty}
                                                            value={quantity}
                                                            onChange={(event) => updateAvailableQuantity(group.key, Number(event.target.value), maxQty)}
                                                            className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)]"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddGroup(group)}
                                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm ${selected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'} hover:bg-slate-200`}
                                                        >
                                                            <PlusCircle className="w-4 h-4" />
                                                            {selected ? 'Selected' : 'Add'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-500">Property No(s): {renderPropertyNumbers(group.items)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Pagination */}
                            {paginationMeta && paginationMeta.last_page > 1 && (
                                <div className="border-t border-slate-200 pt-4 mt-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-slate-500">
                                            Showing {((paginationMeta.current_page - 1) * paginationMeta.per_page) + 1} to {Math.min(paginationMeta.current_page * paginationMeta.per_page, paginationMeta.total)} of {paginationMeta.total} groups
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                                disabled={currentPage === 1 || itemLoading}
                                                className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Previous
                                            </button>
                                            <span className="text-sm text-slate-600">
                                                Page {paginationMeta.current_page} of {paginationMeta.last_page}
                                            </span>
                                            <button
                                                onClick={() => setCurrentPage(Math.min(paginationMeta.last_page, currentPage + 1))}
                                                disabled={currentPage === paginationMeta.last_page || itemLoading}
                                                className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-slate-900">Selected Items</h3>
                                <span className="text-sm text-slate-500">{selectedGroups.length} group(s)</span>
                            </div>

                            {selectedGroups.length === 0 ? (
                                <div className="text-sm text-slate-500">No items selected yet.</div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedGroups.map((entry) => {
                                        const group = groupedAvailableItems.find((g) => g.key === entry.key);
                                        if (!group) return null;
                                        const maxQty = group.items.length;
                                        const qty = Math.min(Math.max(entry.quantity, 1), maxQty);
                                        return (
                                            <div key={entry.key} className="rounded-lg border border-slate-200 p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-start gap-3">
                                                        {(() => {
                                                            const imgUrl = resolveArticleImageUrl(group.items[0]?.ArticleImage);
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (!imgUrl) return;
                                                                        setPreviewImageUrl(imgUrl);
                                                                        setIsImageModalOpen(true);
                                                                    }}
                                                                    className="h-12 w-12 overflow-hidden rounded border border-slate-200 bg-slate-50 flex items-center justify-center"
                                                                    title={imgUrl ? 'Click to preview image' : 'No image available'}
                                                                >
                                                                    {imgUrl ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img src={imgUrl} alt={group.article} className="h-full w-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-400">No image</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-900">{group.article}</div>
                                                            <div className="text-xs text-slate-500">{group.itemDescription}</div>
                                                            <div className="text-xs text-slate-500">Qty: {qty}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveGroup(entry.key)}
                                                        className="text-slate-400 hover:text-rose-500"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!canSubmit || loading}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-white text-sm hover:bg-[var(--primary-hover)] disabled:opacity-60"
                            >
                                {loading ? 'Submitting...' : (
                                    <>
                                        <CalendarClock className="w-4 h-4" />
                                        Submit Transfer Request
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ArticlePreviewModal
                open={isImageModalOpen && !!previewImageUrl}
                onClose={() => {
                    setIsImageModalOpen(false);
                    setPreviewImageUrl(null);
                }}
                imageUrl={previewImageUrl || ''}
                alt="Article image preview"
            />
        </div>
    );
}
