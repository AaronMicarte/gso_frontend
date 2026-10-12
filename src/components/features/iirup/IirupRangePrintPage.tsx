'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { listUnserviceable } from '@/lib/api/propertyWaste';
import type { UnserviceableItemRow } from '@/types/propertyWaste';
import { IirupPrintView } from './IirupPrintView';
import { IiruspPrintView } from './IiruspPrintView';
import { exportIirupToExcel } from './IirupExport';
import { exportIiruspToExcel } from './IiruspExport';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDateValue = (value: string) => DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

export type IirupPrintAssetType = 'non_expendable' | 'semi_expendable';

export interface IirupRangePrintPageProps {
    baseRoute?: '/admin' | '/staff';
    forcedType?: IirupPrintAssetType;
}

function IirupRangePrintPageContent({ baseRoute = '/admin', forcedType }: IirupRangePrintPageProps) {
    const params = useParams<{ startDate: string; endDate: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();

    const startDate = String(params?.startDate ?? '');
    const endDate = String(params?.endDate ?? '');
    const mode = (searchParams.get('mode') || 'custom') as 'month' | 'custom';

    const typeParam = searchParams.get('type') || searchParams.get('asset_type');
    const assetType: IirupPrintAssetType = useMemo(() => {
        if (forcedType) return forcedType;
        if (typeParam === 'semi' || typeParam === 'semi_expendable' || typeParam === 'iirusp') {
            return 'semi_expendable';
        }
        return 'non_expendable';
    }, [forcedType, typeParam]);

    const isPPE = assetType === 'non_expendable';

    const [rows, setRows] = useState<UnserviceableItemRow[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const isRangeValid = useMemo(() => {
        if (!isValidDateValue(startDate) || !isValidDateValue(endDate)) return false;
        return startDate <= endDate;
    }, [endDate, startDate]);

    useEffect(() => {
        document.body.classList.add('print-scope-active');
        return () => {
            document.body.classList.remove('print-scope-active');
        };
    }, []);

    useEffect(() => {
        const run = async () => {
            if (!isRangeValid) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const data = await listUnserviceable({
                    asset_type: assetType,
                    start_date: startDate,
                    end_date: endDate,
                    per_page: 100,
                });
                const rawItems = data?.data || [];

                const formattedItems: UnserviceableItemRow[] = rawItems.map((it: any) => {
                    const inv = it?.inventoryDetail || null;
                    return {
                        id: it.InventoryDetailID ?? it.PropertyUnserviceableItemID ?? it.PropertyWasteItemID ?? Math.floor(Math.random() * 1000000),
                        dateAcquired: it.DateAcquired || null,
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
                toast.error(`Failed to load unserviceable ${isPPE ? 'PPE' : 'semi-expendable'} items for the selected range`);
                setRows([]);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [assetType, endDate, isPPE, isRangeValid, startDate]);

    const handleExcelExport = async () => {
        if (!rows || rows.length === 0) return;
        setIsExporting(true);
        try {
            if (isPPE) {
                await exportIirupToExcel({ rows, startDate, endDate, mode });
            } else {
                await exportIiruspToExcel({ rows, startDate, endDate, mode });
            }
            toast.success(`Exported ${isPPE ? 'IIRUP' : 'IIRUSP'} Excel file successfully`);
        } catch (e) {
            console.error(e);
            toast.error('Failed to export Excel');
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) return <div className="p-6 text-center text-slate-600">Loading print preview...</div>;

    if (!isRangeValid) {
        return (
            <div className="p-6">
                <button onClick={() => router.back()} className="inline-flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="mt-4 text-slate-700 font-semibold">Invalid date range.</div>
            </div>
        );
    }

    return (
        <div className="print-scope p-4 bg-white min-h-screen">
            <div className="no-print flex items-center justify-between mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-white">
                            {isPPE ? 'IIRUP (PPE)' : 'IIRUSP (Semi-Expendable)'}
                        </span>
                        <span>Date Range: <span className="font-semibold text-slate-900">{startDate} to {endDate}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExcelExport}
                            disabled={isExporting || !rows || rows.length === 0}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 border border-green-200 rounded-lg shadow-sm transition-colors"
                        >
                            {isExporting ? (
                                <>
                                    <span className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                    Export Excel
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 shadow-sm transition-colors font-medium text-sm"
                        >
                            <Printer className="h-4 w-4" /> Print
                        </button>
                    </div>
                </div>
            </div>

            {!rows || rows.length === 0 ? (
                <div className="text-slate-700 p-8 text-center border border-dashed rounded-lg">
                    No unserviceable {isPPE ? 'PPE' : 'semi-expendable'} items found for this date range.
                </div>
            ) : isPPE ? (
                <IirupPrintView rows={rows} startDate={startDate} endDate={endDate} mode={mode} />
            ) : (
                <IiruspPrintView rows={rows} startDate={startDate} endDate={endDate} mode={mode} />
            )}
        </div>
    );
}

export function IirupRangePrintPage(props: IirupRangePrintPageProps) {
    return (
        <Suspense fallback={<div className="p-6 text-center text-slate-600">Loading print preview...</div>}>
            <IirupRangePrintPageContent {...props} />
        </Suspense>
    );
}