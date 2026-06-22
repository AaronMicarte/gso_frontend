'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { FileSpreadsheet } from 'lucide-react';
import { getInventoryPropertyCard, type PropertyCardResponse } from '@/lib/api/inventory';
import { PropertyCardPrintView } from './PropertyCardPrintView';
import { exportPropertyCardToExcel } from './PropertyCardExport';

type PropertyCardPrintPageProps = {
    baseRoute: '/admin' | '/staff' | '/department_head';
};

export function PropertyCardPrintPage({ baseRoute }: PropertyCardPrintPageProps) {
    const params = useParams<{ detailId?: string }>();
    const [data, setData] = useState<PropertyCardResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const detailId = params?.detailId ? Number(params.detailId) : NaN;

    const load = useCallback(async () => {
        if (!detailId || Number.isNaN(detailId)) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const result = await getInventoryPropertyCard(detailId);
            setData(result);
        } catch {
            toast.error('Failed to load property card print data');
        } finally {
            setLoading(false);
        }
    }, [detailId]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        document.body.classList.add('print-scope-active');
        return () => {
            document.body.classList.remove('print-scope-active');
        };
    }, []);

    const handleExport = useCallback(async () => {
        if (!data) return;
        try {
            setExporting(true);
            await exportPropertyCardToExcel(data);
            toast.success('Property card exported successfully');
        } catch {
            toast.error('Failed to export property card');
        } finally {
            setExporting(false);
        }
    }, [data]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
                    <span className="ml-3 text-gray-600">Loading property card...</span>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Property card not found</div>
                    <div className="text-sm text-slate-600 mt-1">The property card could not be loaded.</div>
                    <div className="mt-4">
                        <Link href={`${baseRoute}/inventory`} className="text-sm text-[var(--primary)] underline">
                            Back to inventory
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="print-scope min-h-screen bg-slate-100 py-6">
            <div className="no-print max-w-6xl mx-auto px-4 mb-4 flex items-center justify-between">
                <Link href={`${baseRoute}/inventory`} className="text-sm text-[var(--primary)] underline">
                    Back to inventory
                </Link>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        disabled={exporting || !data.rows || data.rows.length === 0}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 border border-green-200 rounded-lg shadow-sm transition-colors"
                    >
                        {exporting ? (
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
                        className="inline-flex items-center px-4 py-2 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                    >
                        Print
                    </button>
                </div>
            </div>

            <PropertyCardPrintView data={data} />
        </div>
    );
}