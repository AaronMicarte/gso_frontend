'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, Search, Package, X, Edit3, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import { useQrProperties, useUpdatePropertyCondition } from '@/lib/hooks/useQrProperties';
import { useAllPropertyStatuses } from '@/lib/hooks/masterData/usePropertyStatuses';
import { useAllConditions } from '@/lib/hooks/masterData/useConditions';
import type { QrScanAssignedProperty } from '@/types/qr';

interface PropertyOversightListPageProps {
    baseRoute: string;
}

type DocumentTypeFilter = 'ALL' | 'PAR' | 'ICS';

function text(value: string | null | undefined, fallback: string): string {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function formatPHDate(dateString: string | null | undefined): string {
    if (!dateString) return 'Not recorded';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return format(toZonedTime(date, 'Asia/Manila'), 'MMM dd, yyyy');
}

function getItemName(p: QrScanAssignedProperty): string {
    // Real item name comes from Delivery Receipt detail (ItemDescription).
    // propertyinventorydetail.Description is often just remarks/specs (e.g., "good").
    return text(
        p.inventoryDetail?.drDetail?.ItemDescription
        ?? p.inventoryDetail?.Description
        ?? p.Description,
        'Item not recorded'
    );
}

function getRequesterName(p: QrScanAssignedProperty): string {
    // For ICS issuances, show the requester (who requested the asset).
    // For PAR issuances, show the end user (who is assigned the asset).
    if (p.documentType === 'ICS') {
        return text(p.requester, 'Requester not recorded');
    }
    return text(p.endUser?.FullName, 'End user not recorded');
}

function getStatusName(p: QrScanAssignedProperty): string {
    return text(p.propertyStatus?.StatusName, 'Not recorded');
}

function getConditionName(p: QrScanAssignedProperty): string {
    return text(p.condition?.ConditionName, 'Not recorded');
}

function isUnserviceableCondition(name: string): boolean {
    return name.trim().toLowerCase().includes('unserviceable');
}

function getDocumentType(p: QrScanAssignedProperty): DocumentTypeFilter {
    if (p.documentType === 'PAR') return 'PAR';
    if (p.documentType === 'ICS') return 'ICS';
    // Fallback to infer from PropertyCardNumber
    const card = (p.PropertyCardNumber ?? '').trim().toUpperCase();
    if (card.startsWith('PAR-')) return 'PAR';
    if (card.startsWith('ICS-')) return 'ICS';
    return 'ALL';
}

function getArticleName(p: QrScanAssignedProperty): string {
    return text(
        p.inventoryDetail?.drDetail?.article?.ArticleName
        ?? p.inventoryDetail?.drDetail?.ItemDescription
        ?? p.inventoryDetail?.PropertyName
        ?? p.inventoryDetail?.Description
        ?? p.Description,
        'Item not recorded'
    );
}

function getItemDescription(p: QrScanAssignedProperty): string {
    return text(
        p.inventoryDetail?.drDetail?.ItemDescription
        ?? p.inventoryDetail?.Description
        ?? p.Description,
        'No description'
    );
}

export function PropertyOversightListPage({ baseRoute }: PropertyOversightListPageProps) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');

    const [docType, setDocType] = useState<DocumentTypeFilter>('ALL');
    const [status, setStatus] = useState<number | 'ALL'>('ALL');
    const [condition, setCondition] = useState<number | 'ALL'>('ALL');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProperty, setSelectedProperty] = useState<QrScanAssignedProperty | null>(null);

    const [editingConditionPropertyId, setEditingConditionPropertyId] = useState<number | null>(null);
    const [editingConditionId, setEditingConditionId] = useState<number | ''>('');

    const updatePropertyCondition = useUpdatePropertyCondition();

    const openPropertyModal = (property: QrScanAssignedProperty) => {
        setSelectedProperty(property);
        setEditingConditionPropertyId(null);
        setEditingConditionId('');
        setIsModalOpen(true);
    };

    const closePropertyModal = () => {
        setIsModalOpen(false);
        setSelectedProperty(null);
    };

    const query = useQrProperties({
        page,
        per_page: 10,
        search: search.trim() ? search.trim() : undefined,
    });

    useEffect(() => {
        if (!query.error) return;
        const message = query.error instanceof Error ? query.error.message : 'Failed to load properties';
        toast.error(message);
    }, [query.error]);

    const data = query.data;
    const properties = useMemo(() => data?.data ?? [], [data]);

    const totalPages = data?.last_page ?? 1;
    const currentPage = data?.current_page ?? page;

    const { data: allStatuses } = useAllPropertyStatuses();
    const { data: allConditions } = useAllConditions();

    const statusOptions = useMemo(() => {
        const allowed = new Set(['for issuance', 'issued']);
        return (allStatuses ?? [])
            .filter(s => allowed.has((s.name ?? '').trim().toLowerCase()))
            .map((s) => ({ id: s.id, name: s.name }));
    }, [allStatuses]);

    const allConditionOptions = useMemo(() => {
        return (allConditions ?? [])
            .filter(c => (c.name ?? '').trim().toLowerCase() !== 'under repair')
            .map((c) => ({ id: c.id, name: c.name }));
    }, [allConditions]);

    const editableConditionOptions = useMemo(() => {
        const allowed = new Set(['serviceable', 'unserviceable']);
        return (allConditions ?? [])
            .filter((c) => allowed.has((c.name ?? '').trim().toLowerCase()))
            .map((c) => ({ id: c.id, name: c.name }));
    }, [allConditions]);

    const filtered = useMemo(() => {
        return properties.filter((p) => {
            if (docType !== 'ALL' && getDocumentType(p) !== docType) return false;
            if (status !== 'ALL') {
                if (p.PropertyStatusID !== status) return false;
            }
            if (condition !== 'ALL') {
                if (p.ConditionID !== condition) return false;
            }
            return true;
        });
    }, [properties, docType, status, condition]);

    const canGoPrev = currentPage > 1;
    const canGoNext = currentPage < totalPages;

    const handleSaveRowCondition = async (property: QrScanAssignedProperty) => {
        if (!editingConditionId) {
            toast.error('Choose a condition before saving.');
            return;
        }

        try {
            await updatePropertyCondition.mutateAsync({ propertyId: property.PropertyID, conditionId: Number(editingConditionId) });
            toast.success('Condition updated successfully.');
            setEditingConditionPropertyId(null);
            setEditingConditionId('');
        } catch (error) {
            const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || 'Failed to update condition');
        }
    };

    return (
        <div
            className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}
        >
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Property Oversight</h1>
                        <p className="text-slate-500 text-sm">Monitor accountable PAR/ICS assets in your department</p>
                    </div>
                    <button
                        onClick={() => query.refetch()}
                        disabled={query.isFetching}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        type="button"
                    >
                        <RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search property card no., property no., serial, model, brand, description, end user..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            value={docType}
                            onChange={(e) => {
                                setDocType(e.target.value as DocumentTypeFilter);
                                setPage(1);
                            }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        >
                            <option value="ALL">All Documents</option>
                            <option value="PAR">PAR</option>
                            <option value="ICS">ICS</option>
                        </select>

                        <select
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                                setPage(1);
                            }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        >
                            <option value="ALL">All Status</option>
                            {statusOptions.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>

                        <select
                            value={condition}
                            onChange={(e) => {
                                setCondition(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                                setPage(1);
                            }}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                        >
                            <option value="ALL">All Condition</option>
                            {allConditionOptions.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Article</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4">Property No.</th>
                                    <th className="px-6 py-4">End User</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Condition</th>
                                    <th className="px-6 py-4">Assigned</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-200">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            No properties found
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((p) => {
                                        const itemName = getItemName(p);
                                        const title = itemName;

                                        const article = getArticleName(p);
                                        const description = getItemDescription(p);
                                        const propertyNo = text(p.inventoryDetail?.PropertyNumber, 'Not recorded');
                                        const endUserName = getRequesterName(p);
                                        const deptName = text(p.department?.DepartmentName ?? p.endUser?.department?.DepartmentName, 'Not recorded');

                                        return (
                                            <tr key={p.PropertyID} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 font-medium text-slate-900 max-w-[400px]">
                                                    <div className="truncate" title={article}>{article}</div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        Dept: {deptName}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-700 truncate" title={description}>{description}</td>
                                                <td className="px-6 py-4 text-slate-700">{propertyNo}</td>
                                                <td className="px-6 py-4 text-slate-700">{endUserName}</td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                        {getStatusName(p)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {editingConditionPropertyId === p.PropertyID ? (
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={editingConditionId}
                                                                onChange={(e) => setEditingConditionId(e.target.value ? Number(e.target.value) : '')}
                                                                className="px-2 py-1 border border-slate-300 rounded-lg text-sm"
                                                            >
                                                                <option value="">Select</option>
                                                                {editableConditionOptions.map((c) => (
                                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveRowCondition(p)}
                                                                disabled={updatePropertyCondition.isPending || !editingConditionId}
                                                                className="text-green-600 hover:text-green-800"
                                                                title="Save condition"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setEditingConditionPropertyId(null); setEditingConditionId(''); }}
                                                                className="text-slate-400 hover:text-slate-700"
                                                                title="Cancel"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isUnserviceableCondition(getConditionName(p)) ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                {getConditionName(p)}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingConditionPropertyId(p.PropertyID);
                                                                    setEditingConditionId(p.ConditionID || p.condition?.ConditionID || '');
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-slate-700"
                                                                title="Edit condition"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-slate-700">{formatPHDate(p.AssignedDate)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openPropertyModal(p)}
                                                            className="p-2 text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                                                            title="View property oversight"
                                                            type="button"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm text-slate-600">Page {currentPage} of {totalPages} | {data?.total ?? 0} total assets</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={!canGoPrev || query.isFetching}
                                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    type="button"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={!canGoNext || query.isFetching}
                                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    type="button"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {isModalOpen && selectedProperty && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/50" onClick={closePropertyModal} />
                        <div className="relative z-10 w-full max-w-2xl bg-white rounded-xl shadow-xl p-6">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Property Details</h2>
                                    <p className="text-sm text-slate-500">Key oversight fields for quick review.</p>
                                </div>
                                <button
                                    onClick={closePropertyModal}
                                    className="text-slate-500 hover:text-slate-700 rounded-full p-2 transition-colors"
                                    type="button"
                                    aria-label="Close property modal"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">Article</p>
                                    <p className="text-base font-semibold text-slate-800">{getArticleName(selectedProperty)}</p>

                                    <p className="text-xs text-slate-500 uppercase tracking-wide">Description</p>
                                    <p className="text-base text-slate-700">{getItemDescription(selectedProperty)}</p>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">Property No.</p>
                                    <p className="text-base font-semibold text-slate-800">{text(selectedProperty.inventoryDetail?.PropertyNumber, 'Not recorded')}</p>

                                    <p className="text-xs text-slate-500 uppercase tracking-wide">Assigned</p>
                                    <p className="text-base text-slate-700">{formatPHDate(selectedProperty.AssignedDate)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-700">
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">Brand</p>
                                    <p className="font-medium text-slate-800">{text(selectedProperty.inventoryDetail?.Brand, 'Not recorded')}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">Model</p>
                                    <p className="font-medium text-slate-800">{text(selectedProperty.inventoryDetail?.ModelNumber, 'Not recorded')}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">Serial Number</p>
                                    <p className="font-medium text-slate-800">{text(selectedProperty.inventoryDetail?.SerialNumber, 'Not recorded')}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">Condition</p>
                                    <p className="font-medium text-slate-800">{getConditionName(selectedProperty)}</p>
                                </div>
                            </div>

                            <div className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-700">
                                <p className="text-xs text-slate-500 uppercase tracking-wide">End User / Department</p>
                                <p className="font-medium text-slate-800">
                                    {`${getRequesterName(selectedProperty)} / ${text(selectedProperty.department?.DepartmentName ?? selectedProperty.endUser?.department?.DepartmentName, 'Not recorded')}`}
                                </p>
                            </div>

                            <div className="mt-6 text-right">
                                <button
                                    onClick={closePropertyModal}
                                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                    type="button"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
