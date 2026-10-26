'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search,
    PlusCircle,
    Trash2,
    CalendarClock,
    ArrowRight,
    ArrowLeft,
    Check,
    CheckCircle2,
    Building2,
    User,
    UserCheck,
    ArrowRightLeft,
    ShieldCheck,
    Package,
} from 'lucide-react';
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
import { ArticlePreviewModal } from '@/components/ui/ArticlePreviewModal';
import { resolveStorageUrl } from '@/lib/utils/signature';

interface TransferCreatePageProps {
    baseRoute: string;
}

type Step = 1 | 2 | 3 | 4;

type GroupedAvailableItem = {
    key: string;
    items: TransferableItem[];
    article: string;
    itemDescription: string;
    fullSpecs: string;
    unitName: string;
};

export function TransferCreatePage({ baseRoute }: TransferCreatePageProps) {
    const router = useRouter();

    const [currentStep, setCurrentStep] = useState<Step>(1);

    const [departments, setDepartments] = useState<TransferDepartment[]>([]);

    // Step 1
    const [fromDepartmentId, setFromDepartmentId] = useState<number | ''>('');
    const [fromDepartmentQuery, setFromDepartmentQuery] = useState('');
    const [fromDeptComboboxOpen, setFromDeptComboboxOpen] = useState(false);
    const fromDeptComboboxRef = useRef<HTMLDivElement | null>(null);

    const [fromEndUsers, setFromEndUsers] = useState<TransferEndUser[]>([]);
    const [loadingFromEndUsers, setLoadingFromEndUsers] = useState(false);
    const [fromEndUserId, setFromEndUserId] = useState<number | ''>('');
    const [fromEndUserQuery, setFromEndUserQuery] = useState('');
    const [fromUserComboboxOpen, setFromUserComboboxOpen] = useState(false);
    const fromUserComboboxRef = useRef<HTMLDivElement | null>(null);

    const [selectedReleasingPerson, setSelectedReleasingPerson] = useState<TransferEndUser | null>(null);

    // Step 2: Assets State (Selected by exact property number / InventoryDetailID)
    const [availableItems, setAvailableItems] = useState<TransferableItem[]>([]);
    const [itemLoading, setItemLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [paginationMeta, setPaginationMeta] = useState<{
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    } | null>(null);

    // Exact selected items mapping: InventoryDetailID -> TransferableItem
    const [selectedItemsMap, setSelectedItemsMap] = useState<Record<number, TransferableItem>>({});

    // Step 3
    const [transferMode, setTransferMode] = useState<'different' | 'same'>('different');
    const [toDepartmentId, setToDepartmentId] = useState<number | ''>('');
    const [toDepartmentQuery, setToDepartmentQuery] = useState('');
    const [toDeptComboboxOpen, setToDeptComboboxOpen] = useState(false);
    const toDeptComboboxRef = useRef<HTMLDivElement | null>(null);

    const [toEndUsers, setToEndUsers] = useState<TransferEndUser[]>([]);
    const [loadingToEndUsers, setLoadingToEndUsers] = useState(false);
    const [toEndUserId, setToEndUserId] = useState<number | ''>('');
    const [toEndUserQuery, setToEndUserQuery] = useState('');
    const [toUserComboboxOpen, setToUserComboboxOpen] = useState(false);
    const toUserComboboxRef = useRef<HTMLDivElement | null>(null);

    const [selectedReceivingPerson, setSelectedReceivingPerson] = useState<TransferEndUser | null>(null);

    // Step 4
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Image preview
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    const formattedToday = format(toZonedTime(new Date(), 'Asia/Manila'), 'MMMM dd, yyyy');

    useEffect(() => {
        transferAPI.getDepartments()
            .then(setDepartments)
            .catch(() => toast.error('Failed to load departments'));
    }, []);

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (fromDeptComboboxRef.current && !fromDeptComboboxRef.current.contains(target)) {
                setFromDeptComboboxOpen(false);
            }
            if (fromUserComboboxRef.current && !fromUserComboboxRef.current.contains(target)) {
                setFromUserComboboxOpen(false);
            }
            if (toDeptComboboxRef.current && !toDeptComboboxRef.current.contains(target)) {
                setToDeptComboboxOpen(false);
            }
            if (toUserComboboxRef.current && !toUserComboboxRef.current.contains(target)) {
                setToUserComboboxOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    useEffect(() => {
        if (!fromDepartmentId) {
            setFromEndUsers([]);
            setFromEndUserId('');
            setSelectedReleasingPerson(null);
            setFromEndUserQuery('');
            return;
        }

        let isMounted = true;
        setLoadingFromEndUsers(true);
        transferAPI.getEndUsers(Number(fromDepartmentId), { excludeGso: true })
            .then((users) => {
                if (!isMounted) return;
                setFromEndUsers(users);
            })
            .catch(() => {
                if (isMounted) toast.error('Failed to load employees for the selected department');
            })
            .finally(() => {
                if (isMounted) setLoadingFromEndUsers(false);
            });

        return () => { isMounted = false; };
    }, [fromDepartmentId]);

    useEffect(() => {
        if (!toDepartmentId) {
            setToEndUsers([]);
            setToEndUserId('');
            setSelectedReceivingPerson(null);
            setToEndUserQuery('');
            return;
        }

        let isMounted = true;
        setLoadingToEndUsers(true);
        transferAPI.getEndUsers(Number(toDepartmentId))
            .then((users) => {
                if (!isMounted) return;
                setToEndUsers(users);
            })
            .catch(() => {
                if (isMounted) toast.error('Failed to load employees for the receiving department');
            })
            .finally(() => {
                if (isMounted) setLoadingToEndUsers(false);
            });

        return () => { isMounted = false; };
    }, [toDepartmentId]);

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
            toast.error('Failed to load transferable assets');
            setAvailableItems([]);
            setPaginationMeta(null);
        } finally {
            setItemLoading(false);
        }
    }, [fromDepartmentId, fromEndUserId, searchTerm, currentPage]);

    useEffect(() => {
        if (currentStep === 2) {
            loadAvailableItems();
        }
    }, [currentStep, loadAvailableItems]);

    useEffect(() => {
        setSelectedItemsMap({});
        setCurrentPage(1);
        setPaginationMeta(null);
    }, [fromDepartmentId, fromEndUserId]);

    const buildItemDescription = useCallback((item: TransferableItem) => (
        item.ItemDescription || item.InventoryDescription || item.AssignedDescription || 'Item'
    ), []);

    const buildFullSpecs = useCallback((item: TransferableItem) => (
        [item.Brand, item.ModelNumber].filter(Boolean).join(' | ')
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
                    article: item.ArticleName || 'Asset Item',
                    itemDescription: buildItemDescription(item),
                    fullSpecs: buildFullSpecs(item) || 'No specifications',
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
            .sort((a, b) => a.article.toLowerCase().localeCompare(b.article.toLowerCase()));
    }, [availableItems, buildGroupKey, buildItemDescription, buildFullSpecs]);

    // Toggle specific item / property number
    const toggleItemSelection = (item: TransferableItem) => {
        setSelectedItemsMap((prev) => {
            const next = { ...prev };
            if (next[item.InventoryDetailID]) {
                delete next[item.InventoryDetailID];
            } else {
                next[item.InventoryDetailID] = item;
            }
            return next;
        });
    };

    // Toggle all items in a group
    const toggleGroupSelection = (group: GroupedAvailableItem) => {
        const allSelected = group.items.every((it) => Boolean(selectedItemsMap[it.InventoryDetailID]));
        setSelectedItemsMap((prev) => {
            const next = { ...prev };
            if (allSelected) {
                for (const it of group.items) {
                    delete next[it.InventoryDetailID];
                }
            } else {
                for (const it of group.items) {
                    next[it.InventoryDetailID] = it;
                }
            }
            return next;
        });
    };

    const isItemSelected = (inventoryDetailId: number) => Boolean(selectedItemsMap[inventoryDetailId]);

    const resolveArticleImageUrl = (raw?: string | null): string | null => {
        const value = (raw || '').trim();
        if (!value) return null;
        const normalized = value.replace(/^\/+/, '');
        const mapped = normalized.startsWith('article_images/') ? `/storage/${normalized}` : value;
        return resolveStorageUrl(mapped);
    };

    const filteredFromDepartments = useMemo(() => {
        const term = fromDepartmentQuery.trim().toLowerCase();
        if (!term) return departments;
        return departments.filter((d) => d.DepartmentName.toLowerCase().includes(term));
    }, [departments, fromDepartmentQuery]);

    const filteredFromEndUsers = useMemo(() => {
        const term = fromEndUserQuery.trim().toLowerCase();
        if (!term) return fromEndUsers;
        return fromEndUsers.filter((u) => {
            const name = u.FullName.toLowerCase();
            const pos = (u.PositionName || '').toLowerCase();
            return name.includes(term) || pos.includes(term);
        });
    }, [fromEndUsers, fromEndUserQuery]);

    const filteredToDepartments = useMemo(() => {
        const term = toDepartmentQuery.trim().toLowerCase();
        if (!term) return departments;
        return departments.filter((d) => d.DepartmentName.toLowerCase().includes(term));
    }, [departments, toDepartmentQuery]);

    const filteredToEndUsers = useMemo(() => {
        const term = toEndUserQuery.trim().toLowerCase();
        const eligible = toEndUsers.filter((u) => {
            if (fromDepartmentId && toDepartmentId && Number(fromDepartmentId) === Number(toDepartmentId)) {
                return Number(u.EndUserID) !== Number(fromEndUserId);
            }
            return true;
        });

        if (!term) return eligible;
        return eligible.filter((u) => {
            const name = u.FullName.toLowerCase();
            const pos = (u.PositionName || '').toLowerCase();
            return name.includes(term) || pos.includes(term);
        });
    }, [toEndUsers, toEndUserQuery, fromDepartmentId, toDepartmentId, fromEndUserId]);

    const selectFromDepartment = (dept: TransferDepartment) => {
        setFromDepartmentId(dept.DepartmentID);
        setFromDepartmentQuery(dept.DepartmentName);
        setFromDeptComboboxOpen(false);
        setFromEndUserId('');
        setSelectedReleasingPerson(null);
        setFromEndUserQuery('');
    };

    const selectFromPerson = (person: TransferEndUser) => {
        setFromEndUserId(person.EndUserID);
        setSelectedReleasingPerson(person);
        setFromEndUserQuery(person.FullName);
        setFromUserComboboxOpen(false);

        if (transferMode === 'same') {
            setToDepartmentId(person.DepartmentID || fromDepartmentId);
            setToDepartmentQuery(person.DepartmentName || fromDepartmentQuery);
        }
    };

    const selectToDepartment = (dept: TransferDepartment) => {
        setToDepartmentId(dept.DepartmentID);
        setToDepartmentQuery(dept.DepartmentName);
        setToDeptComboboxOpen(false);
        setToEndUserId('');
        setSelectedReceivingPerson(null);
        setToEndUserQuery('');
    };

    const selectToPerson = (person: TransferEndUser) => {
        setToEndUserId(person.EndUserID);
        setSelectedReceivingPerson(person);
        setToEndUserQuery(person.FullName);
        setToUserComboboxOpen(false);
    };

    const handleSetTransferMode = (mode: 'same' | 'different') => {
        setTransferMode(mode);
        if (mode === 'same' && fromDepartmentId) {
            const releasingDept = departments.find(d => d.DepartmentID === Number(fromDepartmentId));
            setToDepartmentId(Number(fromDepartmentId));
            setToDepartmentQuery(releasingDept?.DepartmentName || fromDepartmentQuery);
            setToEndUserId('');
            setSelectedReceivingPerson(null);
            setToEndUserQuery('');
        } else if (mode === 'different') {
            setToDepartmentId('');
            setToDepartmentQuery('');
            setToEndUserId('');
            setSelectedReceivingPerson(null);
            setToEndUserQuery('');
        }
    };

    const selectedItemsList = useMemo(() => Object.values(selectedItemsMap), [selectedItemsMap]);
    const totalSelectedQty = selectedItemsList.length;

    const handleSubmit = async () => {
        if (!fromDepartmentId || !fromEndUserId) {
            toast.error('Releasing person is required');
            return;
        }
        if (selectedItemsList.length === 0) {
            toast.error('Select at least one property number to transfer');
            return;
        }
        if (!toDepartmentId || !toEndUserId) {
            toast.error('Receiving person is required');
            return;
        }
        if (Number(fromEndUserId) === Number(toEndUserId)) {
            toast.error('The releasing and receiving custodian cannot be the same person');
            return;
        }

        const inventoryDetailIds = selectedItemsList.map(it => it.InventoryDetailID);

        const payload: PropertyTransferCreatePayload = {
            from_department_id: Number(fromDepartmentId),
            to_department_id: Number(toDepartmentId),
            from_end_user_id: Number(fromEndUserId),
            to_end_user_id: Number(toEndUserId),
            reason: reason.trim() || null,
            items: inventoryDetailIds.map((id) => ({
                inventory_detail_id: id,
                quantity: 1,
            })),
        };

        try {
            setSubmitting(true);
            const response = await transferAPI.create(payload);
            toast.success('Transfer request submitted successfully');
            router.push(`${baseRoute}/${response.transfer.TransferID}`);
        } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { message?: string } } };
            const message = maybeAxios?.response?.data?.message;
            toast.error(message || 'Failed to submit transfer request');
        } finally {
            setSubmitting(false);
        }
    };

    const steps = [
        { number: 1, label: 'Releasing Person', desc: 'Select department & custodian' },
        { number: 2, label: 'Select Assets', desc: 'Choose property numbers' },
        { number: 3, label: 'Receiving Person', desc: 'Select recipient & department' },
        { number: 4, label: 'Review & Submit', desc: 'Review summary & submit' },
    ];

    const canProceedToStep2 = Boolean(selectedReleasingPerson && fromDepartmentId);
    const canProceedToStep3 = Boolean(canProceedToStep2 && selectedItemsList.length > 0);
    const canProceedToStep4 = Boolean(canProceedToStep3 && selectedReceivingPerson && toDepartmentId);

    const isStepClickable = (stepNumber: Step) => {
        if (stepNumber === 1) return true;
        if (stepNumber === 2) return canProceedToStep2;
        if (stepNumber === 3) return canProceedToStep3;
        if (stepNumber === 4) return canProceedToStep4;
        return false;
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            <div className="w-full px-4 md:px-6 py-5 space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Transfer Assets</h1>
                            <p className="text-sm text-slate-500">Transfer property custody between employees or departments</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Request Date</div>
                            <div className="text-sm font-semibold text-slate-700">{formattedToday}</div>
                        </div>
                    </div>
                </div>

                {/* Stepper */}
                <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 p-2.5 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {steps.map((s) => {
                            const isCurrent = currentStep === s.number;
                            const isCompleted = currentStep > s.number;
                            const clickable = isStepClickable(s.number as Step);

                            return (
                                <button
                                    key={s.number}
                                    type="button"
                                    onClick={() => clickable && setCurrentStep(s.number as Step)}
                                    disabled={!clickable}
                                    className={`flex items-center gap-2.5 p-2.5 rounded-lg transition-all text-left ${isCurrent
                                        ? 'bg-[var(--primary)] text-white shadow-sm'
                                        : isCompleted
                                            ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 cursor-pointer'
                                            : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    <div
                                        className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${isCurrent
                                            ? 'bg-white/20 text-white'
                                            : isCompleted
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-200 text-slate-500'
                                            }`}
                                    >
                                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.number}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase tracking-wider font-semibold opacity-70">
                                            Step {s.number}
                                        </div>
                                        <div className="text-xs font-bold truncate">
                                            {s.label}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Step 1 */}
                {currentStep === 1 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                        <div>
                            <div className="flex items-center gap-1.5 text-[var(--primary)] font-semibold text-xs uppercase tracking-wider">
                                <Building2 className="w-3.5 h-3.5" />
                                Step 1 of 4: Releasing Side
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 mt-0.5">Select Releasing Custodian</h2>
                            <p className="text-sm text-slate-500">
                                Choose the department and employee or Department Head who currently holds the assets.
                            </p>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                            {/* Releasing Department */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                    Releasing Department <span className="text-red-500">*</span>
                                </label>
                                <div className="relative" ref={fromDeptComboboxRef}>
                                    <input
                                        type="text"
                                        value={fromDepartmentQuery}
                                        onChange={(e) => {
                                            setFromDepartmentQuery(e.target.value);
                                            setFromDepartmentId('');
                                            setFromDeptComboboxOpen(true);
                                        }}
                                        onFocus={() => setFromDeptComboboxOpen(true)}
                                        placeholder="Search releasing department..."
                                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent text-sm"
                                    />
                                    {fromDeptComboboxOpen && (
                                        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto py-1">
                                            {filteredFromDepartments.length === 0 ? (
                                                <li className="px-3.5 py-2.5 text-sm text-slate-400">No departments found</li>
                                            ) : (
                                                filteredFromDepartments.map((dept) => (
                                                    <li
                                                        key={dept.DepartmentID}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            selectFromDepartment(dept);
                                                        }}
                                                        className={`px-3.5 py-2 text-sm cursor-pointer flex items-center justify-between ${fromDepartmentId === dept.DepartmentID
                                                            ? 'bg-[var(--primary)] text-white'
                                                            : 'hover:bg-slate-50 text-slate-700'
                                                            }`}
                                                    >
                                                        <span className="font-medium">{dept.DepartmentName}</span>
                                                        {dept.DepartmentCode && (
                                                            <span className="text-[10px] opacity-75 uppercase tracking-wider">{dept.DepartmentCode}</span>
                                                        )}
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* Releasing Person */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    Releasing Person <span className="text-red-500">*</span>
                                </label>
                                <div className="relative" ref={fromUserComboboxRef}>
                                    <input
                                        type="text"
                                        disabled={!fromDepartmentId || loadingFromEndUsers}
                                        value={fromEndUserQuery}
                                        onChange={(e) => {
                                            setFromEndUserQuery(e.target.value);
                                            setFromEndUserId('');
                                            setSelectedReleasingPerson(null);
                                            setFromUserComboboxOpen(true);
                                        }}
                                        onFocus={() => {
                                            if (fromDepartmentId) setFromUserComboboxOpen(true);
                                        }}
                                        placeholder={
                                            !fromDepartmentId
                                                ? 'Select department first...'
                                                : loadingFromEndUsers
                                                    ? 'Loading employees...'
                                                    : 'Search employee or Department Head...'
                                        }
                                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent text-sm disabled:bg-slate-100 disabled:text-slate-400"
                                    />
                                    {fromUserComboboxOpen && fromDepartmentId && (
                                        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto py-1">
                                            {filteredFromEndUsers.length === 0 ? (
                                                <li className="px-3.5 py-2.5 text-sm text-slate-400">
                                                    No employees or Department Heads found
                                                </li>
                                            ) : (
                                                filteredFromEndUsers.map((user) => (
                                                    <li
                                                        key={user.EndUserID}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            selectFromPerson(user);
                                                        }}
                                                        className={`px-3.5 py-2 text-sm cursor-pointer border-b border-slate-100 last:border-0 ${fromEndUserId === user.EndUserID
                                                            ? 'bg-[var(--primary)] text-white'
                                                            : 'hover:bg-slate-50 text-slate-800'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="font-semibold">{user.FullName}</div>
                                                            {user.is_department_head ? (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-0.5">
                                                                    <ShieldCheck className="w-2.5 h-2.5" />
                                                                    Head
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                                    Employee
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] opacity-70 mt-0.5">
                                                            {user.PositionName || 'Employee'}
                                                        </div>
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>

                        {selectedReleasingPerson && (
                            <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-4">
                                <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--primary)] mb-2 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Selected Releasing Person
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                            {selectedReleasingPerson.FullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="text-sm font-bold text-slate-900">{selectedReleasingPerson.FullName}</h3>
                                                {selectedReleasingPerson.is_department_head && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-0.5">
                                                        <ShieldCheck className="w-2.5 h-2.5" />
                                                        Dept Head
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-600">
                                                {selectedReleasingPerson.PositionName || 'Employee'} · {selectedReleasingPerson.DepartmentName || fromDepartmentQuery}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFromEndUserId('');
                                            setSelectedReleasingPerson(null);
                                            setFromEndUserQuery('');
                                        }}
                                        className="text-[11px] text-slate-500 hover:text-slate-800 underline self-start sm:self-auto"
                                    >
                                        Change
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                disabled={!canProceedToStep2}
                                onClick={() => setCurrentStep(2)}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--primary)] text-white font-semibold text-sm hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                            >
                                Continue to Select Assets
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Select Assets by Property Number */}
                {currentStep === 2 && (
                    <div className="space-y-4">
                        <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 p-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                                    <Package className="w-4 h-4 text-[var(--primary)]" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Releasing From</div>
                                    <div className="text-xs font-bold text-slate-900">
                                        {selectedReleasingPerson?.FullName}{' '}
                                        <span className="text-slate-500 font-normal">
                                            ({selectedReleasingPerson?.DepartmentName || fromDepartmentQuery})
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(1)}
                                className="text-[11px] text-[var(--primary)] font-semibold hover:underline"
                            >
                                Change
                            </button>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
                            {/* Assets list */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-bold text-slate-900">Available Assets</h2>
                                        <p className="text-[11px] text-slate-500">
                                            Click any property number below to select or unselect it for transfer.
                                        </p>
                                    </div>
                                    <div className="relative w-full sm:max-w-xs">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search property #, article, brand..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                {itemLoading ? (
                                    <div className="py-12 text-center text-sm text-slate-500">
                                        Loading available assets...
                                    </div>
                                ) : groupedAvailableItems.length === 0 ? (
                                    <div className="py-12 text-center space-y-2 border-2 border-dashed border-slate-200 rounded-lg p-6">
                                        <Package className="w-8 h-8 text-slate-300 mx-auto" />
                                        <div className="text-sm font-semibold text-slate-700">No transferable assets found</div>
                                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                            There are no issued assets currently in the custody of this person that are eligible for transfer.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {groupedAvailableItems.map((group) => {
                                            const totalInGroup = group.items.length;
                                            const selectedCountInGroup = group.items.filter(it => isItemSelected(it.InventoryDetailID)).length;
                                            const allGroupSelected = totalInGroup > 0 && selectedCountInGroup === totalInGroup;

                                            return (
                                                <div
                                                    key={group.key}
                                                    className={`rounded-lg border transition-all p-3.5 ${selectedCountInGroup > 0
                                                        ? 'border-emerald-500/80 bg-emerald-50/20 shadow-xs'
                                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                                        }`}
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
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
                                                                        className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0"
                                                                        title={imgUrl ? 'Preview' : 'No image'}
                                                                    >
                                                                        {imgUrl ? (
                                                                            // eslint-disable-next-line @next/next/no-img-element
                                                                            <img src={imgUrl} alt={group.article} className="h-full w-full object-cover" />
                                                                        ) : (
                                                                            <span className="text-[9px] text-slate-400 font-medium">No image</span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })()}
                                                            <div>
                                                                <div className="text-sm font-bold text-slate-900">{group.article}</div>
                                                                <div className="text-[11px] text-slate-600 line-clamp-1">{group.itemDescription}</div>
                                                                <div className="text-[10px] text-slate-400 mt-0.5">{group.fullSpecs}</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                                                            <div className="text-[11px] font-semibold text-slate-600">
                                                                Selected: <span className="text-slate-900 font-bold">{selectedCountInGroup}</span> / {totalInGroup}
                                                            </div>
                                                            {totalInGroup > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleGroupSelection(group)}
                                                                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${allGroupSelected
                                                                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                                        : 'bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20'
                                                                        }`}
                                                                >
                                                                    {allGroupSelected ? 'Deselect All' : 'Select All'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Selectable Property Numbers Chips */}
                                                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                                                        <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                                                            <span>Select Property Number(s):</span>
                                                            <span className="text-slate-400 font-normal text-[10px]">(click to select / deselect)</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {group.items.map((item) => {
                                                                const isSelected = isItemSelected(item.InventoryDetailID);
                                                                return (
                                                                    <button
                                                                        key={item.InventoryDetailID}
                                                                        type="button"
                                                                        onClick={() => toggleItemSelection(item)}
                                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all border ${isSelected
                                                                            ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-xs hover:bg-emerald-700'
                                                                            : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                                                                            }`}
                                                                    >
                                                                        {isSelected ? (
                                                                            <Check className="w-3.5 h-3.5" />
                                                                        ) : (
                                                                            <PlusCircle className="w-3 h-3 text-slate-400" />
                                                                        )}
                                                                        <span>{item.PropertyNumber || 'No Property #'}</span>
                                                                        {item.SerialNumber && (
                                                                            <span className={`text-[10px] font-normal ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                                                                                (SN: {item.SerialNumber})
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {paginationMeta && paginationMeta.last_page > 1 && (
                                    <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                                        <div>
                                            {((paginationMeta.current_page - 1) * paginationMeta.per_page) + 1}–{Math.min(paginationMeta.current_page * paginationMeta.per_page, paginationMeta.total)} of {paginationMeta.total}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                                disabled={currentPage === 1 || itemLoading}
                                                className="px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                Prev
                                            </button>
                                            <span className="font-bold text-slate-700">
                                                {paginationMeta.current_page} / {paginationMeta.last_page}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentPage(Math.min(paginationMeta.last_page, currentPage + 1))}
                                                disabled={currentPage === paginationMeta.last_page || itemLoading}
                                                className="px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Selected tray - listing exact property numbers */}
                            <div className="space-y-3">
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3 sticky top-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900">Selected Assets</h3>
                                            <p className="text-[10px] text-slate-500">Chosen property numbers</p>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary)] text-white">
                                            {totalSelectedQty} selected
                                        </span>
                                    </div>

                                    {selectedItemsList.length === 0 ? (
                                        <div className="py-8 text-center text-[11px] text-slate-400">
                                            No property numbers selected yet.<br />Click on any property number badge to add it.
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[380px] overflow-auto pr-0.5">
                                            {selectedItemsList.map((item) => (
                                                <div
                                                    key={item.InventoryDetailID}
                                                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-2"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-bold text-slate-900 truncate">
                                                            {item.ArticleName || 'Asset Item'}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 truncate">
                                                            {item.ItemDescription || item.InventoryDescription || item.AssignedDescription}
                                                        </div>
                                                        <div className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded border border-emerald-300 mt-1">
                                                            PN: {item.PropertyNumber || 'N/A'}
                                                            {item.SerialNumber && (
                                                                <span className="text-slate-500 font-normal"> · SN: {item.SerialNumber}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleItemSelection(item)}
                                                        className="text-slate-400 hover:text-red-500 p-0.5 shrink-0"
                                                        title="Remove this asset"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                        <button
                                            type="button"
                                            disabled={!canProceedToStep3}
                                            onClick={() => setCurrentStep(3)}
                                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)] text-white font-semibold text-xs hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                                        >
                                            Continue to Receiving Person
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-[11px] font-semibold"
                                        >
                                            <ArrowLeft className="w-3 h-3" />
                                            Back
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3 */}
                {currentStep === 3 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                        <div>
                            <div className="flex items-center gap-1.5 text-[var(--primary)] font-semibold text-xs uppercase tracking-wider">
                                <UserCheck className="w-3.5 h-3.5" />
                                Step 3 of 4: Receiving Side
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 mt-0.5">Select Receiving Custodian</h2>
                            <p className="text-sm text-slate-500">
                                Choose who will receive the assets.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Transfer Type
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSetTransferMode('same')}
                                    className={`p-3 rounded-lg border-2 text-left flex items-start gap-2.5 transition-all ${transferMode === 'same'
                                        ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                >
                                    <div className={`p-1.5 rounded-md ${transferMode === 'same' ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <UserCheck className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs text-slate-900">Same Department</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">Internal transfer</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSetTransferMode('different')}
                                    className={`p-3 rounded-lg border-2 text-left flex items-start gap-2.5 transition-all ${transferMode === 'different'
                                        ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                >
                                    <div className={`p-1.5 rounded-md ${transferMode === 'different' ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs text-slate-900">Inter-Department</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">Different office</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                    Receiving Department <span className="text-red-500">*</span>
                                </label>
                                {transferMode === 'same' ? (
                                    <input
                                        type="text"
                                        readOnly
                                        value={selectedReleasingPerson?.DepartmentName || fromDepartmentQuery || 'Same'}
                                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-800 font-medium text-sm"
                                    />
                                ) : (
                                    <div className="relative" ref={toDeptComboboxRef}>
                                        <input
                                            type="text"
                                            value={toDepartmentQuery}
                                            onChange={(e) => {
                                                setToDepartmentQuery(e.target.value);
                                                setToDepartmentId('');
                                                setToDeptComboboxOpen(true);
                                            }}
                                            onFocus={() => setToDeptComboboxOpen(true)}
                                            placeholder="Search receiving department..."
                                            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent text-sm"
                                        />
                                        {toDeptComboboxOpen && (
                                            <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto py-1">
                                                {filteredToDepartments.length === 0 ? (
                                                    <li className="px-3.5 py-2.5 text-sm text-slate-400">No departments found</li>
                                                ) : (
                                                    filteredToDepartments.map((dept) => (
                                                        <li
                                                            key={dept.DepartmentID}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                selectToDepartment(dept);
                                                            }}
                                                            className={`px-3.5 py-2 text-sm cursor-pointer flex items-center justify-between ${toDepartmentId === dept.DepartmentID
                                                                ? 'bg-[var(--primary)] text-white'
                                                                : 'hover:bg-slate-50 text-slate-700'
                                                                }`}
                                                        >
                                                            <span className="font-medium">{dept.DepartmentName}</span>
                                                            {dept.DepartmentCode && (
                                                                <span className="text-[10px] opacity-75 uppercase tracking-wider">{dept.DepartmentCode}</span>
                                                            )}
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    Receiving Person <span className="text-red-500">*</span>
                                </label>
                                <div className="relative" ref={toUserComboboxRef}>
                                    <input
                                        type="text"
                                        disabled={!toDepartmentId || loadingToEndUsers}
                                        value={toEndUserQuery}
                                        onChange={(e) => {
                                            setToEndUserQuery(e.target.value);
                                            setToEndUserId('');
                                            setSelectedReceivingPerson(null);
                                            setToUserComboboxOpen(true);
                                        }}
                                        onFocus={() => {
                                            if (toDepartmentId) setToUserComboboxOpen(true);
                                        }}
                                        placeholder={
                                            !toDepartmentId
                                                ? 'Select department first...'
                                                : loadingToEndUsers
                                                    ? 'Loading...'
                                                    : 'Search recipient...'
                                        }
                                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent text-sm disabled:bg-slate-100 disabled:text-slate-400"
                                    />
                                    {toUserComboboxOpen && toDepartmentId && (
                                        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto py-1">
                                            {filteredToEndUsers.length === 0 ? (
                                                <li className="px-3.5 py-2.5 text-sm text-slate-400">
                                                    No eligible recipients
                                                </li>
                                            ) : (
                                                filteredToEndUsers.map((user) => (
                                                    <li
                                                        key={user.EndUserID}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            selectToPerson(user);
                                                        }}
                                                        className={`px-3.5 py-2 text-sm cursor-pointer border-b border-slate-100 last:border-0 ${toEndUserId === user.EndUserID
                                                            ? 'bg-[var(--primary)] text-white'
                                                            : 'hover:bg-slate-50 text-slate-800'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="font-semibold">{user.FullName}</div>
                                                            {user.is_department_head ? (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-0.5">
                                                                    <ShieldCheck className="w-2.5 h-2.5" />
                                                                    Head
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                                    Employee
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] opacity-70 mt-0.5">
                                                            {user.PositionName || 'Employee'}
                                                        </div>
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>

                        {selectedReceivingPerson && (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/20 p-4">
                                <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 mb-2 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Selected Receiving Person
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                                            {selectedReceivingPerson.FullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="text-sm font-bold text-slate-900">{selectedReceivingPerson.FullName}</h3>
                                                {selectedReceivingPerson.is_department_head && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-0.5">
                                                        <ShieldCheck className="w-2.5 h-2.5" />
                                                        Dept Head
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-600">
                                                {selectedReceivingPerson.PositionName || 'Employee'} · {selectedReceivingPerson.DepartmentName || toDepartmentQuery}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setToEndUserId('');
                                            setSelectedReceivingPerson(null);
                                            setToEndUserQuery('');
                                        }}
                                        className="text-[11px] text-slate-500 hover:text-slate-800 underline self-start sm:self-auto"
                                    >
                                        Change
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(2)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back
                            </button>
                            <button
                                type="button"
                                disabled={!canProceedToStep4}
                                onClick={() => setCurrentStep(4)}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--primary)] text-white font-semibold text-sm hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                            >
                                Review Transfer
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4 */}
                {currentStep === 4 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                        <div>
                            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs uppercase tracking-wider">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Step 4 of 4: Review & Submit
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 mt-0.5">Transfer Summary</h2>
                            <p className="text-sm text-slate-500">
                                Verify all details and selected property numbers before submitting.
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                                <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Releasing From
                                    </div>
                                    <div className="text-sm font-bold text-slate-900">
                                        {selectedReleasingPerson?.FullName}
                                    </div>
                                    <div className="text-[11px] text-slate-600">
                                        {selectedReleasingPerson?.PositionName || 'Employee'} · {selectedReleasingPerson?.DepartmentName || fromDepartmentQuery}
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-center gap-1">
                                    <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-sm">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${Number(fromDepartmentId) === Number(toDepartmentId)
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-indigo-100 text-indigo-800'
                                        }`}>
                                        {Number(fromDepartmentId) === Number(toDepartmentId) ? 'Same Dept' : 'Inter-Dept'}
                                    </span>
                                </div>

                                <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Receiving Custodian
                                    </div>
                                    <div className="text-sm font-bold text-slate-900">
                                        {selectedReceivingPerson?.FullName}
                                    </div>
                                    <div className="text-[11px] text-slate-600">
                                        {selectedReceivingPerson?.PositionName || 'Employee'} · {selectedReceivingPerson?.DepartmentName || toDepartmentQuery}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Selected Property Numbers Table */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900">Assets to Transfer</h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                    {totalSelectedQty} property item{totalSelectedQty !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                                        <tr>
                                            <th className="px-3 py-2">Asset / Description</th>
                                            <th className="px-3 py-2">Property Number</th>
                                            <th className="px-3 py-2">Serial Number</th>
                                            <th className="px-3 py-2">Specs</th>
                                            <th className="px-3 py-2 text-right">Remove</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedItemsList.map((item) => (
                                            <tr key={item.InventoryDetailID} className="hover:bg-slate-50/50">
                                                <td className="px-3 py-2">
                                                    <div className="font-semibold text-xs text-slate-900">
                                                        {item.ArticleName || 'Asset Item'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        {item.ItemDescription || item.InventoryDescription || item.AssignedDescription}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                        {item.PropertyNumber || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-xs text-slate-600">
                                                    {item.SerialNumber || '—'}
                                                </td>
                                                <td className="px-3 py-2 text-[10px] text-slate-600">
                                                    {[item.Brand, item.ModelNumber].filter(Boolean).join(' · ') || '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleItemSelection(item)}
                                                        className="text-slate-400 hover:text-red-500 p-1"
                                                        title="Remove property"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">
                                Reason / Notes <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                placeholder="Purpose or justification for this transfer..."
                                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] text-sm"
                            />
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(3)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back
                            </button>

                            <button
                                type="button"
                                disabled={submitting || selectedItemsList.length === 0}
                                onClick={handleSubmit}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>Submitting...</>
                                ) : (
                                    <>
                                        <CalendarClock className="w-3.5 h-3.5" />
                                        Submit Transfer
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <ArticlePreviewModal
                open={isImageModalOpen && !!previewImageUrl}
                onClose={() => {
                    setIsImageModalOpen(false);
                    setPreviewImageUrl(null);
                }}
                imageUrl={previewImageUrl || ''}
                alt="Asset image preview"
            />
        </div>
    );
}