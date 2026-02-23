'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, PlusCircle, Trash2, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import borrowAPI from '@/lib/api/borrow';
import {
    PropertyBorrowCreatePayload,
    BorrowDepartment,
    BorrowEndUser,
    BorrowableItem,
    BorrowAllowedPropertyType,
} from '@/types/propertyBorrow';
import { useAuth } from '@/lib/hooks/useAuth';

interface BorrowCreatePageProps {
    baseRoute: string;
}

const buildItemDescription = (item: BorrowableItem) => (
    item.ItemDescription || item.InventoryDescription || item.AssignedDescription || 'Item'
);

const buildFullSpecs = (item: BorrowableItem) => (
    [item.Brand, item.ModelNumber, item.SerialNumber ? `SN: ${item.SerialNumber}` : null]
        .filter(Boolean)
        .join(' | ')
);

const buildGroupKey = (item: BorrowableItem) => {
    const serialKey = item.SerialNumber || 'no-serial';
    const brandKey = item.Brand || 'no-brand';
    const modelKey = item.ModelNumber || 'no-model';
    const descKey = buildItemDescription(item);
    return `${serialKey}||${brandKey}||${modelKey}||${descKey}`;
};

export function BorrowCreatePage({ baseRoute }: BorrowCreatePageProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [departments, setDepartments] = useState<BorrowDepartment[]>([]);
    const [fromEndUsers, setFromEndUsers] = useState<BorrowEndUser[]>([]);
    const [toEndUsers, setToEndUsers] = useState<BorrowEndUser[]>([]);
    const [availableItems, setAvailableItems] = useState<BorrowableItem[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<Array<{ key: string; quantity: number }>>([]);
    const [availableQuantities, setAvailableQuantities] = useState<Record<string, number>>({});
    const [allowedTypes, setAllowedTypes] = useState<BorrowAllowedPropertyType[]>([]);
    const [loading, setLoading] = useState(false);
    const [itemLoading, setItemLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [purpose, setPurpose] = useState('');
    const [fromEndUserSearch, setFromEndUserSearch] = useState('');
    const [releasingComboboxOpen, setReleasingComboboxOpen] = useState(false);
    const [releasingHighlightedIndex, setReleasingHighlightedIndex] = useState(-1);
    const releasingComboboxRef = useRef<HTMLDivElement | null>(null);

    const [fromDepartmentId, setFromDepartmentId] = useState<number | ''>('');
    const [toDepartmentId, setToDepartmentId] = useState<number | ''>(user?.DepartmentID ?? '');
    const [fromEndUserId, setFromEndUserId] = useState<number | ''>('');
    const [toEndUserId, setToEndUserId] = useState<number | ''>('');
    const [dueDate, setDueDate] = useState('');

    const [receivingEndUser, setReceivingEndUser] = useState<BorrowEndUser | null>(null);
    const [receivingError, setReceivingError] = useState<string | null>(null);

    const isDepartmentHead = user?.UserRoleID === 4;

    const formattedToday = format(toZonedTime(new Date(), 'Asia/Manila'), 'MMM dd, yyyy');
    const minDueDate = format(addDays(toZonedTime(new Date(), 'Asia/Manila'), 1), 'yyyy-MM-dd');

    const loadHelpers = useCallback(async () => {
        try {
            const [deptData, receivingEndUsers, releasingEndUsers, allowedPropertyTypes] = await Promise.all([
                borrowAPI.getDepartments(),
                user?.DepartmentID ? borrowAPI.getEndUsers(user.DepartmentID) : Promise.resolve([]),
                borrowAPI.getEndUsers(),
                borrowAPI.getAllowedPropertyTypes(),
            ]);
            setDepartments(deptData);
            setToEndUsers(receivingEndUsers);
            setFromEndUsers(releasingEndUsers);
            setAllowedTypes(allowedPropertyTypes);
        } catch {
            toast.error('Failed to load borrow helpers');
        }
    }, [user?.DepartmentID]);

    const loadAvailableItems = useCallback(async () => {
        if (!fromDepartmentId || !fromEndUserId) {
            setAvailableItems([]);
            return;
        }

        try {
            setItemLoading(true);
            const data = await borrowAPI.getAvailableItems({
                search: searchTerm || undefined,
                from_department_id: Number(fromDepartmentId),
                from_end_user_id: Number(fromEndUserId),
                per_page: 20,
            });
            setAvailableItems(data.data || []);
        } catch {
            toast.error('Failed to load borrowable items');
        } finally {
            setItemLoading(false);
        }
    }, [fromDepartmentId, fromEndUserId, searchTerm]);

    useEffect(() => {
        loadHelpers();
    }, [loadHelpers]);

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (releasingComboboxRef.current && !releasingComboboxRef.current.contains(event.target as Node)) {
                setReleasingComboboxOpen(false);
                setReleasingHighlightedIndex(-1);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    useEffect(() => {
        if (user?.DepartmentID && !toDepartmentId) {
            setToDepartmentId(user.DepartmentID);
        }
    }, [user?.DepartmentID, toDepartmentId]);

    useEffect(() => {
        if (isDepartmentHead && user?.DepartmentID) {
            setToDepartmentId(user.DepartmentID);
        }
    }, [isDepartmentHead, user?.DepartmentID]);

    useEffect(() => {
        if (!toDepartmentId) {
            setToEndUsers([]);
            setToEndUserId('');
            setReceivingEndUser(null);
            setReceivingError(null);
            return;
        }

        borrowAPI.getEndUsers(Number(toDepartmentId))
            .then((endUsers) => {
                setToEndUsers(endUsers);
                const requesterName = (user?.FullName || '').trim().toLowerCase();
                const match = endUsers.find((entry) => entry.FullName.trim().toLowerCase() === requesterName) || null;
                if (!match) {
                    setReceivingEndUser(null);
                    setToEndUserId('');
                    setReceivingError('Requester must have a matching End User record in their department.');
                } else {
                    setReceivingEndUser(match);
                    setToEndUserId(match.EndUserID);
                    setReceivingError(null);
                }
            })
            .catch(() => toast.error('Failed to load borrowing end users'));
    }, [toDepartmentId, user?.FullName]);

    useEffect(() => {
        loadAvailableItems();
    }, [loadAvailableItems]);

    useEffect(() => {
        setSelectedGroups([]);
        setAvailableQuantities({});
    }, [fromDepartmentId, fromEndUserId]);

    type GroupedAvailableItem = {
        key: string;
        items: BorrowableItem[];
        article: string;
        itemDescription: string;
        fullSpecs: string;
        unitName: string;
        propertyType: string;
    };

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
                    propertyType: item.PropertyTypeName || 'Unclassified',
                });
            }
            groups.get(key)!.items.push(item);
        }

        return Array.from(groups.values()).map((group) => {
            const sortedItems = [...group.items].sort((a, b) => {
                const left = a.PropertyNumber || '';
                const right = b.PropertyNumber || '';
                return left.localeCompare(right);
            });
            return { ...group, items: sortedItems };
        });
    }, [availableItems]);

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

    const renderPropertyNumbers = (items: BorrowableItem[]) => {
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
            if (!term) return true;
            const display = `${endUser.FullName} ${endUser.DepartmentName ?? ''}`.toLowerCase();
            return display.includes(term);
        });
    }, [fromEndUsers, fromEndUserSearch, user?.FullName, user?.DepartmentID]);

    const canSubmit = useMemo(() => {
        return !!fromDepartmentId
            && !!toDepartmentId
            && !!fromEndUserId
            && !!toEndUserId
            && !!dueDate
            && selectedGroups.length > 0
            && fromDepartmentId !== toDepartmentId
            && !receivingError;
    }, [fromDepartmentId, toDepartmentId, fromEndUserId, toEndUserId, dueDate, selectedGroups, receivingError]);

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
            toast.error('Select at least one item to borrow');
            return;
        }

        const payload: PropertyBorrowCreatePayload = {
            from_department_id: Number(fromDepartmentId),
            to_department_id: Number(toDepartmentId),
            from_end_user_id: Number(fromEndUserId),
            to_end_user_id: Number(toEndUserId),
            purpose: purpose.trim() || null,
            due_date: dueDate,
            items: inventoryDetailIds.map((inventoryDetailId) => ({
                inventory_detail_id: inventoryDetailId,
                quantity: 1,
            })),
        };

        try {
            setLoading(true);
            const response = await borrowAPI.create(payload);
            toast.success('Borrow request submitted');
            router.push(`${baseRoute}/${response.borrow.BorrowID}`);
        } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { message?: string } } };
            const message = maybeAxios?.response?.data?.message;
            toast.error(message || 'Failed to submit borrow request');
        } finally {
            setLoading(false);
        }
    };

    const allowedTypeLabel = useMemo(() => {
        if (!allowedTypes.length) return 'Loading allowed property types...';
        return allowedTypes.map((type) => type.PropertyName).join(', ');
    }, [allowedTypes]);

    return (
        <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
            <div className="p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Create Borrow Request</h1>
                    <p className="text-slate-500 text-sm">Request temporary use of assets from another department</p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="text-sm text-slate-600">Request Date: {formattedToday}</div>
                            <div className="text-sm text-slate-600">
                                Requested By: {user?.FullName || 'Missing requester'}{user?.Department ? ` - ${user.Department}` : ''}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Releasing Custodian (Current Holder)</label>
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
                                                setReleasingComboboxOpen(true);
                                                setReleasingHighlightedIndex(0);
                                            }}
                                            onFocus={() => setReleasingComboboxOpen(true)}
                                            onKeyDown={(event) => {
                                                if (!releasingComboboxOpen) return;
                                                if (event.key === 'ArrowDown') {
                                                    event.preventDefault();
                                                    setReleasingHighlightedIndex((prev) => Math.min(prev + 1, filteredFromEndUsers.length - 1));
                                                }
                                                if (event.key === 'ArrowUp') {
                                                    event.preventDefault();
                                                    setReleasingHighlightedIndex((prev) => Math.max(prev - 1, 0));
                                                }
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    const selected = filteredFromEndUsers[releasingHighlightedIndex];
                                                    if (selected) {
                                                        setFromEndUserId(selected.EndUserID);
                                                        setFromDepartmentId(selected.DepartmentID ?? '');
                                                        setFromEndUserSearch(`${selected.FullName} ${selected.DepartmentName ? `- ${selected.DepartmentName}` : ''}`.trim());
                                                        setReleasingComboboxOpen(false);
                                                        setReleasingHighlightedIndex(-1);
                                                    }
                                                }
                                                if (event.key === 'Escape') {
                                                    setReleasingComboboxOpen(false);
                                                    setReleasingHighlightedIndex(-1);
                                                }
                                            }}
                                            placeholder="Search releasing custodian"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                        />

                                        {releasingComboboxOpen && (
                                            <div
                                                id="releasing-listbox"
                                                role="listbox"
                                                className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                                            >
                                                {filteredFromEndUsers.length === 0 ? (
                                                    <div className="px-3 py-2 text-sm text-slate-500">No matching end users</div>
                                                ) : (
                                                    filteredFromEndUsers.map((endUser, index) => (
                                                        <button
                                                            key={endUser.EndUserID}
                                                            type="button"
                                                            role="option"
                                                            aria-selected={fromEndUserId === endUser.EndUserID}
                                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${index === releasingHighlightedIndex ? 'bg-slate-50' : ''}`}
                                                            onMouseEnter={() => setReleasingHighlightedIndex(index)}
                                                            onClick={() => {
                                                                setFromEndUserId(endUser.EndUserID);
                                                                setFromDepartmentId(endUser.DepartmentID ?? '');
                                                                setFromEndUserSearch(`${endUser.FullName} ${endUser.DepartmentName ? `- ${endUser.DepartmentName}` : ''}`.trim());
                                                                setReleasingComboboxOpen(false);
                                                                setReleasingHighlightedIndex(-1);
                                                            }}
                                                        >
                                                            <div className="font-medium text-slate-700">{endUser.FullName}</div>
                                                            <div className="text-xs text-slate-500">{endUser.DepartmentName || 'Missing department'}</div>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Releasing Department</label>
                                    <select
                                        value={fromDepartmentId}
                                        onChange={(event) => setFromDepartmentId(Number(event.target.value))}
                                        className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                                        disabled
                                    >
                                        <option value="">Select department</option>
                                        {departments.map((dept) => (
                                            <option key={dept.DepartmentID} value={dept.DepartmentID}>
                                                {dept.DepartmentName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Borrowing Department</label>
                                    <select
                                        value={toDepartmentId}
                                        onChange={(event) => setToDepartmentId(Number(event.target.value))}
                                        className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                                        disabled
                                    >
                                        <option value="">Select department</option>
                                        {departments.map((dept) => (
                                            <option key={dept.DepartmentID} value={dept.DepartmentID}>
                                                {dept.DepartmentName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Borrowing Custodian</label>
                                    <select
                                        value={toEndUserId}
                                        onChange={(event) => setToEndUserId(Number(event.target.value))}
                                        className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                    >
                                        <option value="">Select end user</option>
                                        {toEndUsers.map((endUser) => (
                                            <option key={endUser.EndUserID} value={endUser.EndUserID}>
                                                {endUser.FullName}
                                            </option>
                                        ))}
                                    </select>
                                    {receivingError && <p className="text-xs text-rose-500 mt-1">{receivingError}</p>}
                                    {receivingEndUser && (
                                        <p className="text-xs text-emerald-600 mt-1">Auto-selected for requester match.</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Return Due Date</label>
                                    <input
                                        type="date"
                                        min={minDueDate}
                                        value={dueDate}
                                        onChange={(event) => setDueDate(event.target.value)}
                                        className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Borrowed items must be returned on or before this date.</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Purpose / Notes</label>
                                    <textarea
                                        rows={3}
                                        value={purpose}
                                        onChange={(event) => setPurpose(event.target.value)}
                                        placeholder="Explain the temporary use case"
                                        className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                Borrowable property types: {allowedTypeLabel}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Borrowable Items</h2>
                                    <p className="text-sm text-slate-500">Select assets from the releasing custodian</p>
                                </div>
                                <div className="relative w-full md:max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search items"
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {itemLoading ? (
                                <div className="text-sm text-slate-500">Loading available items...</div>
                            ) : groupedAvailableItems.length === 0 ? (
                                <div className="text-sm text-slate-500">No available items for this custodian.</div>
                            ) : (
                                <div className="space-y-3">
                                    {groupedAvailableItems.map((group) => {
                                        const selected = isGroupSelected(group.key);
                                        const maxQty = group.items.length;
                                        const quantity = availableQuantities[group.key] ?? 1;

                                        return (
                                            <div key={group.key} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm font-semibold text-slate-900">{group.article}</div>
                                                        <div className="text-xs text-slate-500">{group.itemDescription}</div>
                                                        <div className="text-xs text-slate-500">{group.fullSpecs}</div>
                                                        <div className="text-xs text-slate-500">Type: {group.propertyType}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-sm text-slate-600">Available: {maxQty}</div>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={maxQty}
                                                            value={quantity}
                                                            onChange={(event) => updateAvailableQuantity(group.key, Number(event.target.value), maxQty)}
                                                            className="w-20 px-2 py-1 border border-slate-300 rounded-md text-sm"
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
                                    {selectedGroups.map((groupEntry) => {
                                        const group = groupedAvailableItems.find((entry) => entry.key === groupEntry.key);
                                        if (!group) return null;
                                        return (
                                            <div key={groupEntry.key} className="rounded-lg border border-slate-200 p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="text-sm font-semibold text-slate-900">{group.article}</div>
                                                        <div className="text-xs text-slate-500">{group.itemDescription}</div>
                                                        <div className="text-xs text-slate-500">Qty: {groupEntry.quantity}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveGroup(groupEntry.key)}
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
                                        Submit Borrow Request
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
