"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Package, RefreshCw, Printer, ShieldAlert, Boxes } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { UnserviceableItemRow } from '@/types/propertyWaste';
import { listUnserviceable } from '@/lib/api/propertyWaste';

export type IirupAssetType = 'non_expendable' | 'semi_expendable';
type IirupFilterMode = 'month' | 'custom';

export interface IirupPageProps {
    baseRoute?: '/admin' | '/staff';
    initialType?: IirupAssetType;
}

function IirupPageContent({ baseRoute = '/admin', initialType }: IirupPageProps) {
    const searchParams = useSearchParams();
    const typeFromQuery = searchParams.get('type') || searchParams.get('asset_type');
    const resolvedInitialType: IirupAssetType = useMemo(() => {
        if (typeFromQuery === 'semi' || typeFromQuery === 'semi_expendable' || typeFromQuery === 'iirusp') {
            return 'semi_expendable';
        }
        if (typeFromQuery === 'ppe' || typeFromQuery === 'non_expendable' || typeFromQuery === 'iirup') {
            return 'non_expendable';
        }
        return initialType || 'non_expendable';
    }, [typeFromQuery, initialType]);

    const [assetType, setAssetType] = useState<IirupAssetType>(resolvedInitialType);

    // Sync if URL query param or initialType changes
    useEffect(() => {
        if (typeFromQuery === 'semi' || typeFromQuery === 'semi_expendable' || typeFromQuery === 'iirusp') {
            setAssetType('semi_expendable');
        } else if (typeFromQuery === 'ppe' || typeFromQuery === 'non_expendable' || typeFromQuery === 'iirup') {
            setAssetType('non_expendable');
        }
    }, [typeFromQuery]);

    const today = useMemo(() => new Date(), []);
    const [monthFilter, setMonthFilter] = useState(format(today, 'yyyy-MM'));
    const [filterMode, setFilterMode] = useState<IirupFilterMode>('month');
    const [rangeStartDate, setRangeStartDate] = useState(format(today, 'yyyy-MM-01'));
    const [rangeEndDate, setRangeEndDate] = useState(format(today, 'yyyy-MM-dd'));
    const [appliedRange, setAppliedRange] = useState({
        startDate: format(today, 'yyyy-MM-01'),
        endDate: format(today, 'yyyy-MM-dd'),
    });

    const [rows, setRows] = useState<UnserviceableItemRow[] | null>(null);
    const [loading, setLoading] = useState(true);

    const monthYear = useMemo(() => {
        const parsed = new Date(`${monthFilter}-01T00:00:00`);
        return {
            month: parsed.getMonth() + 1,
            year: parsed.getFullYear(),
        };
    }, [monthFilter]);

    const monthRange = useMemo(() => {
        const parts = monthFilter.split('-');
        if (parts.length !== 2) return null;
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        if (Number.isNaN(year) || Number.isNaN(month)) return null;
        const lastDay = new Date(year, month, 0).getDate();
        const formattedMonth = String(month).padStart(2, '0');
        return {
            startDate: `${year}-${formattedMonth}-01`,
            endDate: `${year}-${formattedMonth}-${String(lastDay).padStart(2, '0')}`,
        };
    }, [monthFilter]);

    const listParams = useMemo(() => {
        if (filterMode === 'custom') {
            return {
                asset_type: assetType,
                start_date: appliedRange.startDate,
                end_date: appliedRange.endDate,
            };
        }

        return {
            asset_type: assetType,
            month: monthYear.month,
            year: monthYear.year,
        };
    }, [appliedRange.endDate, appliedRange.startDate, assetType, filterMode, monthYear.month, monthYear.year]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await listUnserviceable({ ...listParams, per_page: 100 });
            const rawItems = data?.data || [];

            const formattedItems: UnserviceableItemRow[] = rawItems.map((it: any) => {
                const inv = it?.inventoryDetail || null;

                return {
                    id: it.PropertyUnserviceableItemID ?? it.PropertyWasteItemID ?? Math.floor(Math.random() * 1000000),
                    dateAcquired: it.DateAcquired || null, // Maps the true history tracking date
                    particulars: it.ItemDescription || inv?.Description || '-',
                    propertyNumber: it.PropertyNumber || inv?.PropertyNumber || '-',
                    quantity: inv?.Quantity ?? 1,
                    unitCost: inv?.UnitCost ? Number(inv.UnitCost) : null,
                    totalCost: inv?.TotalCost ? Number(inv.TotalCost) : null,
                    markedAt: it.marked_at || null,
                    markedBy: it.marked_by_fullname || null,
                };
            });

            setRows(formattedItems);
        } catch (e) {
            console.error(e);
            toast.error(`Failed to load unserviceable ${assetType === 'non_expendable' ? 'PPE' : 'semi-expendable'} items`);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [assetType, listParams]);

    useEffect(() => {
        load();
    }, [load]);

    const applyCustomRange = () => {
        if (!rangeStartDate || !rangeEndDate) {
            toast.error('Please select both start and end dates');
            return;
        }

        if (rangeStartDate > rangeEndDate) {
            toast.error('Start date must not be later than end date');
            return;
        }

        setAppliedRange({ startDate: rangeStartDate, endDate: rangeEndDate });
    };

    const isPPE = assetType === 'non_expendable';
    const printTypeQuery = isPPE ? 'ppe' : 'semi';

    return (
        <div className="min-h-screen p-6 space-y-6 bg-fixed bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}>
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {isPPE
                            ? 'IIRUP — Inventory & Inspection Report of Unserviceable Property'
                            : 'IIRUSP — Inventory & Inspection Report of Unserviceable Semi-Expendable Property'}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {isPPE
                            ? 'Property, Plant & Equipment (PPE / Non-Expendable) marked unserviceable'
                            : 'Semi-Expendable assets marked unserviceable'}
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="self-start md:self-auto flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 bg-white shadow-sm font-medium text-sm"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Asset Type Selector Toggle */}
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm inline-flex items-center gap-1.5 w-full sm:w-auto">
                <button
                    type="button"
                    onClick={() => setAssetType('non_expendable')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        isPPE
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <ShieldAlert className="w-4 h-4" />
                    <span>PPE (Non-Expendable)</span>
                </button>
                <button
                    type="button"
                    onClick={() => setAssetType('semi_expendable')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        !isPPE
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Boxes className="w-4 h-4" />
                    <span>Semi-Expendable</span>
                </button>
            </div>

            {/* Filters Section */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFilterMode('month')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${filterMode === 'month'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            Monthly Filter
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('custom')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${filterMode === 'custom'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            Custom Range
                        </button>
                    </div>

                    {filterMode === 'month' ? (
                        <div className="flex flex-col gap-3">
                            <label className="text-sm text-slate-700 inline-block">
                                <span className="mb-1 block font-medium">Month Filter</span>
                                <div className="relative">
                                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="month"
                                        value={monthFilter}
                                        onChange={(e) => setMonthFilter(e.target.value)}
                                        className="w-full md:w-72 pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                                    />
                                </div>
                            </label>
                            {rows && rows.length > 0 && monthRange && (
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <Link
                                        href={`${baseRoute}/iirup/print/${monthRange.startDate}/${monthRange.endDate}?mode=month&type=${printTypeQuery}`}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors text-sm font-medium shadow-sm"
                                    >
                                        <Printer className="w-4 h-4" /> Print Month Range ({isPPE ? 'IIRUP' : 'IIRUSP'})
                                    </Link>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                <label className="text-sm text-slate-700">
                                    <span className="mb-1 block font-medium">Start Date</span>
                                    <input
                                        type="date"
                                        value={rangeStartDate}
                                        onChange={(e) => setRangeStartDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                                    />
                                </label>

                                <label className="text-sm text-slate-700">
                                    <span className="mb-1 block font-medium">End Date</span>
                                    <input
                                        type="date"
                                        value={rangeEndDate}
                                        onChange={(e) => setRangeEndDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                                    />
                                </label>

                                <button
                                    type="button"
                                    onClick={applyCustomRange}
                                    className="h-[42px] px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors bg-white font-medium shadow-sm"
                                >
                                    Apply Range
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                <span>
                                    Active range: <span className="font-semibold text-slate-900">{appliedRange.startDate}</span> to{' '}
                                    <span className="font-semibold text-slate-900">{appliedRange.endDate}</span>
                                </span>

                                {rows && rows.length > 0 && (
                                    <Link
                                        href={`${baseRoute}/iirup/print/${appliedRange.startDate}/${appliedRange.endDate}?mode=custom&type=${printTypeQuery}`}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors text-sm font-medium shadow-sm"
                                    >
                                        <Printer className="w-4 h-4" /> Print Active Range ({isPPE ? 'IIRUP' : 'IIRUSP'})
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Table Listing */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                {loading ? (
                    <div className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                        Loading unserviceable {isPPE ? 'PPE' : 'semi-expendable'} items...
                    </div>
                ) : !rows || rows.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                        <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        {filterMode === 'custom'
                            ? `No unserviceable ${isPPE ? 'PPE' : 'semi-expendable'} items for this date range`
                            : `No unserviceable ${isPPE ? 'PPE' : 'semi-expendable'} items for this month`}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3">Date Acquired</th>
                                    <th className="px-6 py-3">Particulars / Articles</th>
                                    <th className="px-6 py-3">{isPPE ? 'Property No.' : 'ICS No. / Property No.'}</th>
                                    <th className="px-6 py-3">Qty</th>
                                    <th className="px-6 py-3">Unit Cost</th>
                                    <th className="px-6 py-3">Total Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {rows.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 text-slate-700">
                                            {r.dateAcquired ? format(new Date(r.dateAcquired), 'MMMM dd, yyyy') : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-700 font-medium">{r.particulars || '-'}</td>
                                        <td className="px-6 py-3 text-slate-700 font-mono text-xs">{r.propertyNumber || '-'}</td>
                                        <td className="px-6 py-3 text-slate-700">{r.quantity ?? '-'}</td>
                                        <td className="px-6 py-3 text-slate-700">
                                            {r.unitCost != null ? `₱${Number(r.unitCost).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-700 font-medium">
                                            {r.totalCost != null ? `₱${Number(r.totalCost).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function IirupPage(props: IirupPageProps) {
    return (
        <Suspense fallback={<div className="p-6 text-center text-slate-600">Loading page...</div>}>
            <IirupPageContent {...props} />
        </Suspense>
    );
}