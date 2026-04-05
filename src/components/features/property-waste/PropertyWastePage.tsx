'use client';

import { type ComponentType, Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, ChevronDown, ChevronRight, Gift, Gavel, HandCoins, Recycle, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import propertyWasteApi from '@/lib/api/propertyWaste';
import type { PropertyWasteDisposalMethod, PropertyWasteItem, PropertyWasteItemStatus, PropertyWasteReport, PropertyWasteStatus } from '@/types/propertyWaste';

interface PropertyWastePageProps {
    title: string;
    description: string;
    canManage: boolean;
}

const reportStatusClasses: Record<PropertyWasteStatus, string> = {
    draft: 'bg-slate-100 text-slate-800',
    for_approval: 'bg-amber-100 text-amber-800',
    approved: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-rose-100 text-rose-800',
};

const itemStatusClasses: Record<PropertyWasteItemStatus, string> = {
    pending_method: 'bg-slate-100 text-slate-700',
    method_selected: 'bg-indigo-100 text-indigo-800',
    for_disposal: 'bg-amber-100 text-amber-800',
    disposed: 'bg-emerald-100 text-emerald-800',
};

const iconByKey: Record<string, ComponentType<{ className?: string }>> = {
    gavel: Gavel,
    gift: Gift,
    recycle: Recycle,
    'hand-coins': HandCoins,
    'badge-dollar-sign': HandCoins,
    'trash-2': Trash2,
};

const statusLabel = (value: string) => value.replaceAll('_', ' ');

export function PropertyWastePage({ title, description, canManage }: PropertyWastePageProps) {
    const [rows, setRows] = useState<PropertyWasteReport[]>([]);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'all' | PropertyWasteStatus>('all');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const [expandedReports, setExpandedReports] = useState<Record<number, boolean>>({});
    const [disposalMethods, setDisposalMethods] = useState<PropertyWasteDisposalMethod[]>([]);
    const [editingMethodId, setEditingMethodId] = useState<number | ''>('');
    const [methodModalOpen, setMethodModalOpen] = useState(false);
    const [modalTarget, setModalTarget] = useState<{ reportId: number; item: PropertyWasteItem } | null>(null);

    const load = useCallback(async (targetPage = 1) => {
        try {
            setLoading(true);
            const response = await propertyWasteApi.getAll({
                page: targetPage,
                per_page: 15,
                search: search || undefined,
                status: status === 'all' ? undefined : status,
            });

            setRows(response.data ?? []);
            setPage(response.current_page ?? 1);
            setLastPage(response.last_page ?? 1);
        } catch {
            toast.error('Failed to load property waste records');
        } finally {
            setLoading(false);
        }
    }, [search, status]);

    useEffect(() => {
        load(1);
    }, [load]);

    useEffect(() => {
        propertyWasteApi
            .getDisposalMethods()
            .then(setDisposalMethods)
            .catch(() => {
                toast.error('Failed to load disposal methods');
            });
    }, []);

    const reportCounts = useMemo(() => {
        return rows.reduce(
            (acc, report) => {
                acc.total += 1;
                acc[report.Status] += 1;
                return acc;
            },
            {
                total: 0,
                draft: 0,
                for_approval: 0,
                approved: 0,
                completed: 0,
                cancelled: 0,
            } as Record<PropertyWasteStatus | 'total', number>
        );
    }, [rows]);

    const saveMethod = async (report: PropertyWasteReport, item: PropertyWasteItem) => {
        if (!editingMethodId) {
            toast.error('Please select a disposal method.');
            return;
        }

        try {
            await propertyWasteApi.update(report.PropertyWasteReportID, {
                items: [
                    {
                        property_waste_item_id: item.PropertyWasteItemID,
                        disposal_method_id: Number(editingMethodId),
                        status: 'method_selected',
                    },
                ],
            });

            toast.success('Disposal method saved.');
            setEditingMethodId('');
            await load(page);
        } catch {
            toast.error('Failed to save disposal method');
        }
    };

    const openMethodModal = (report: PropertyWasteReport, item: PropertyWasteItem) => {
        setModalTarget({ reportId: report.PropertyWasteReportID, item });
        setEditingMethodId(item.DisposalMethodID ?? '');
        setMethodModalOpen(true);
    };

    const closeMethodModal = () => {
        setMethodModalOpen(false);
        setModalTarget(null);
        setEditingMethodId('');
    };

    const saveMethodFromModal = async () => {
        if (!modalTarget) return;
        const report = rows.find((row) => row.PropertyWasteReportID === modalTarget.reportId);
        if (!report) return;

        await saveMethod(report, modalTarget.item);
        closeMethodModal();
    };

    const methodIcon = (item: PropertyWasteItem) => {
        const iconKey = item.disposalMethod?.IconKey?.toLowerCase().trim();
        const Icon = (iconKey && iconByKey[iconKey]) || iconByKey['trash-2'];
        return <Icon className="w-4 h-4" />;
    };

    return (
        <div className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: 'fixed' }}>
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                        <p className="text-slate-500 text-sm">{description}</p>
                    </div>
                    <button
                        onClick={() => load(page)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-xl font-bold text-slate-900">{reportCounts.total}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <p className="text-xs text-slate-500">Draft</p>
                        <p className="text-xl font-bold text-slate-700">{reportCounts.draft}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <p className="text-xs text-slate-500">For Approval</p>
                        <p className="text-xl font-bold text-amber-700">{reportCounts.for_approval}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <p className="text-xs text-slate-500">Approved</p>
                        <p className="text-xl font-bold text-blue-700">{reportCounts.approved}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <p className="text-xs text-slate-500">Completed</p>
                        <p className="text-xl font-bold text-emerald-700">{reportCounts.completed}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <p className="text-xs text-slate-500">Cancelled</p>
                        <p className="text-xl font-bold text-rose-700">{reportCounts.cancelled}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by waste #, service #, property #, item"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as 'all' | PropertyWasteStatus)}
                            className="px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        >
                            <option value="all">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="for_approval">For Approval</option>
                            <option value="approved">Approved</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Waste #</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Source Service #</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Items</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loading ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No property waste records found.</td></tr>
                                ) : (
                                    rows.map((report) => (
                                        <Fragment key={report.PropertyWasteReportID}>
                                            <tr className="hover:bg-slate-50">
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{report.WasteNumber}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">{report.sourceServiceRecord?.ServiceNumber || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">{report.department?.DepartmentCode || report.department?.DepartmentName || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                                                        onClick={() => setExpandedReports((prev) => ({ ...prev, [report.PropertyWasteReportID]: !prev[report.PropertyWasteReportID] }))}
                                                    >
                                                        {expandedReports[report.PropertyWasteReportID] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        {report.items?.length || 0}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${reportStatusClasses[report.Status]}`}>
                                                        {statusLabel(report.Status)}
                                                    </span>
                                                </td>
                                            </tr>
                                            {expandedReports[report.PropertyWasteReportID] && (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-3 bg-slate-50/70">
                                                        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                                            {(report.items ?? []).map((item) => (
                                                                <div key={item.PropertyWasteItemID} className="rounded-md border border-slate-100 p-2 text-xs text-slate-700 flex flex-col gap-2">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <div className="space-x-2">
                                                                            <span className="font-semibold">{item.PropertyNumber || '-'}</span>
                                                                            <span>{item.ItemDescription || '-'}</span>
                                                                        </div>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${itemStatusClasses[item.Status]}`}>
                                                                            {statusLabel(item.Status)}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-2">
                                                                        {item.disposalMethod ? (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                                                                                {methodIcon(item)}
                                                                                {item.disposalMethod.MethodName}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-100 text-rose-700">
                                                                                <Ban className="w-4 h-4" />
                                                                                No disposal method selected
                                                                            </span>
                                                                        )}

                                                                        {canManage && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openMethodModal(report, item)}
                                                                                className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-100"
                                                                            >
                                                                                Set method
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {lastPage > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                            <button
                                onClick={() => page > 1 && load(page - 1)}
                                disabled={page <= 1}
                                className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">Page {page} of {lastPage}</span>
                            <button
                                onClick={() => page < lastPage && load(page + 1)}
                                disabled={page >= lastPage}
                                className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {methodModalOpen && modalTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={closeMethodModal} />
                    <div className="relative w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                        <h2 className="text-lg font-semibold text-slate-900">Select Disposal Method</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Item: <span className="font-medium">{modalTarget.item.ItemDescription || modalTarget.item.PropertyNumber || '-'}</span>
                        </p>

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[40vh] overflow-auto pr-1">
                            {disposalMethods.map((method) => {
                                const iconKey = method.IconKey?.toLowerCase().trim();
                                const Icon = (iconKey && iconByKey[iconKey]) || iconByKey['trash-2'];
                                const selected = editingMethodId === method.DisposalMethodID;

                                return (
                                    <button
                                        key={method.DisposalMethodID}
                                        type="button"
                                        onClick={() => setEditingMethodId(method.DisposalMethodID)}
                                        className={`text-left rounded-lg border p-3 transition ${selected ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center gap-2 text-slate-800">
                                            <Icon className="w-4 h-4" />
                                            <span className="font-medium">{method.MethodName}</span>
                                        </div>
                                        {method.Description && (
                                            <p className="mt-1 text-xs text-slate-500">{method.Description}</p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeMethodModal}
                                className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveMethodFromModal}
                                disabled={!editingMethodId}
                                className="px-3 py-2 text-sm rounded-md bg-[var(--primary)] text-white disabled:opacity-50"
                            >
                                Save method
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
