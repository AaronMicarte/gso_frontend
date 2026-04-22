'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { getRsmiReport, listRsmiReports } from '@/lib/api/rsmi';
import type { RsmiRecapitulationItem, RsmiReport, RsmiReportItem } from '@/types/rsmi';
import { RsmiPrintView } from './RsmiPrintView';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateValue = (value: string) => DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

const buildCombinedReport = (reports: RsmiReport[], startDate: string, endDate: string): RsmiReport | null => {
    if (reports.length === 0) return null;

    const itemMap = new Map<string, RsmiReportItem>();
    const recapMap = new Map<string, number>();

    for (const report of reports) {
        for (const item of report.items ?? []) {
            const key = [item.ris_no, item.responsibility_center_code, item.stock_no, item.item_description, item.unit].join('||');
            const existing = itemMap.get(key);

            if (existing) {
                existing.quantity_issued += Number(item.quantity_issued ?? 0);
            } else {
                itemMap.set(key, {
                    ...item,
                    id: itemMap.size + 1,
                    quantity_issued: Number(item.quantity_issued ?? 0),
                });
            }

            const stockKey = String(item.stock_no ?? '');
            recapMap.set(stockKey, (recapMap.get(stockKey) ?? 0) + Number(item.quantity_issued ?? 0));
        }
    }

    const combinedItems = [...itemMap.values()].sort((a, b) => {
        const risCompare = String(a.ris_no ?? '').localeCompare(String(b.ris_no ?? ''));
        if (risCompare !== 0) return risCompare;
        return String(a.stock_no ?? '').localeCompare(String(b.stock_no ?? ''));
    });

    const recapitulation: RsmiRecapitulationItem[] = [...recapMap.entries()]
        .map(([stock_no, quantity]) => ({ stock_no, quantity }))
        .sort((a, b) => a.stock_no.localeCompare(b.stock_no));

    const first = reports[0];

    return {
        id: first.id,
        serial_no: `${first.serial_no}`,
        report_date: first.report_date,
        report_date_label: `${startDate} to ${endDate}`,
        entity_name: first.entity_name,
        fund_cluster: first.fund_cluster,
        items: combinedItems,
        recapitulation,
    };
};

export function RsmiRangePrintPage() {
    const params = useParams<{ startDate: string; endDate: string }>();
    const router = useRouter();

    const startDate = String(params?.startDate ?? '');
    const endDate = String(params?.endDate ?? '');

    const [combinedReport, setCombinedReport] = useState<RsmiReport | null>(null);
    const [loading, setLoading] = useState(true);

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

                const list = await listRsmiReports({
                    start_date: startDate,
                    end_date: endDate,
                });

                if (list.length === 0) {
                    setCombinedReport(null);
                    return;
                }

                const detailedReports = await Promise.all(list.map((entry) => getRsmiReport(entry.id)));
                detailedReports.sort((a, b) => a.report_date.localeCompare(b.report_date));
                setCombinedReport(buildCombinedReport(detailedReports, startDate, endDate));
            } catch {
                toast.error('Failed to load RSMI reports for the selected range');
                setCombinedReport(null);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [endDate, isRangeValid, startDate]);

    if (loading) return null;

    if (!isRangeValid) {
        return (
            <div className="p-6">
                <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="mt-4 text-slate-700">Invalid RSMI date range.</div>
            </div>
        );
    }

    return (
        <div className="print-scope p-4">
            <div className="no-print flex items-center justify-between mb-4">
                <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex items-center gap-2">
                    <div className="text-sm text-slate-600">
                        Range: <span className="font-medium text-slate-900">{startDate}</span> to{' '}
                        <span className="font-medium text-slate-900">{endDate}</span>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"
                    >
                        <Printer className="h-4 w-4" /> Print
                    </button>
                </div>
            </div>

            {!combinedReport ? (
                <div className="text-slate-700">No RSMI reports found for this date range.</div>
            ) : (
                <RsmiPrintView report={combinedReport} />
            )}
        </div>
    );
}
