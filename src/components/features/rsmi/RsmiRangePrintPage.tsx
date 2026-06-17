'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useAuth } from '@/lib/hooks/useAuth';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, FileSpreadsheet } from 'lucide-react'; // Added spreadsheet icon
// Changed import from 'RsmiExport' component to function name
import { exportRsmiToExcel } from './RsmiExport';
import { toast } from 'sonner';
import { getRsmiReport, listRsmiReports } from '@/lib/api/rsmi';
import type { RsmiRecapitulationItem, RsmiReport, RsmiReportItem } from '@/types/rsmi';
import { RsmiPrintView } from './RsmiPrintView';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateValue = (value: string) => DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

const parseTrailingNumber = (value: string): { prefix: string; number: number; width: number } | null => {
    const trimmed = value.trim();
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (!match) return null;
    const numberText = match[2];
    return {
        prefix: match[1],
        number: Number(numberText),
        width: numberText.length,
    };
};

const formatStockRange = (values: string[]): string => {
    const unique = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
    if (unique.length === 0) return '';
    if (unique.length === 1) return unique[0];

    const parsed = unique.map((value) => ({ value, parsed: parseTrailingNumber(value) }));
    const firstParsed = parsed[0].parsed;
    const canCompact = !!firstParsed && parsed.every((item) => (
        item.parsed
        && item.parsed.prefix === firstParsed.prefix
        && item.parsed.width === firstParsed.width
    ));

    if (canCompact) {
        const sorted = parsed
            .map((item) => ({
                parsed: item.parsed!,
            }))
            .sort((a, b) => a.parsed.number - b.parsed.number);

        const blocks: string[] = [];
        let start = sorted[0].parsed.number;
        let previous = sorted[0].parsed.number;

        const pushBlock = (rangeStart: number, rangeEnd: number) => {
            const startFull = `${firstParsed.prefix}${String(rangeStart).padStart(firstParsed.width, '0')}`;
            if (rangeStart === rangeEnd) {
                blocks.push(startFull);
                return;
            }
            const endSuffix = String(rangeEnd).padStart(firstParsed.width, '0');
            blocks.push(`${startFull}/${endSuffix}`);
        };

        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i].parsed.number;
            if (current !== previous + 1) {
                pushBlock(start, previous);
                start = current;
            }
            previous = current;
        }

        pushBlock(start, previous);

        return blocks.join(', ');
    }

    return unique.slice().sort((a, b) => a.localeCompare(b)).join(', ');
};

const formatRangeLabel = (startDate: string, endDate: string) => {
    const start = toZonedTime(new Date(`${startDate}T00:00:00`), 'Asia/Manila');
    const end = toZonedTime(new Date(`${endDate}T00:00:00`), 'Asia/Manila');

    // same day
    if (startDate === endDate) {
        return format(start, 'MMMM d, yyyy').toUpperCase();
    }

    const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
    const sameYear = start.getFullYear() === end.getFullYear();

    if (sameMonth && sameYear) {
        return `${format(start, 'MMMM')} ${start.getDate()}–${end.getDate()}, ${format(start, 'yyyy')}`.toUpperCase();
    }

    if (sameYear) {
        return `${format(start, 'MMMM d')} – ${format(end, 'MMMM d')}, ${format(start, 'yyyy')}`.toUpperCase();
    }

    return `${format(start, 'MMMM d, yyyy')} – ${format(end, 'MMMM d, yyyy')}`.toUpperCase();
};

const buildCombinedReport = (reports: RsmiReport[], startDate: string, endDate: string): RsmiReport | null => {
    if (reports.length === 0) return null;

    const itemMap = new Map<string, { item: RsmiReportItem; stockNos: string[] }>();
    const recapMap = new Map<string, { stockNos: string[]; quantity: number }>();

    for (const report of reports) {
        for (const item of report.items ?? []) {
            const key = [item.ris_no, item.responsibility_center_code, item.item_description, item.unit].join('||');
            const existing = itemMap.get(key);

            if (existing) {
                existing.item.quantity_issued += Number(item.quantity_issued ?? 0);
                if (item.stock_no) {
                    existing.stockNos.push(item.stock_no);
                }
            } else {
                itemMap.set(key, {
                    item: {
                        ...item,
                        id: itemMap.size + 1,
                        quantity_issued: Number(item.quantity_issued ?? 0),
                    },
                    stockNos: item.stock_no ? [item.stock_no] : [],
                });
            }

            const recapExisting = recapMap.get(key);
            if (recapExisting) {
                recapExisting.quantity += Number(item.quantity_issued ?? 0);
                if (item.stock_no) {
                    recapExisting.stockNos.push(item.stock_no);
                }
            } else {
                recapMap.set(key, {
                    stockNos: item.stock_no ? [item.stock_no] : [],
                    quantity: Number(item.quantity_issued ?? 0),
                });
            }
        }
    }

    const combinedItems = [...itemMap.entries()].map(([, { item, stockNos }]) => ({
        ...item,
        stock_no: formatStockRange(stockNos),
    })).sort((a, b) => {
        const risCompare = String(a.ris_no ?? '').localeCompare(String(b.ris_no ?? ''));
        if (risCompare !== 0) return risCompare;
        return String(a.stock_no ?? '').localeCompare(String(b.stock_no ?? ''));
    });

    const recapitulation: RsmiRecapitulationItem[] = [...recapMap.values()]
        .map(({ stockNos, quantity }) => ({
            stock_no: formatStockRange(stockNos),
            quantity,
        }))
        .sort((a, b) => a.stock_no.localeCompare(b.stock_no));

    const first = reports[0];
    const rangeLabel = formatRangeLabel(startDate, endDate);

    return {
        id: first.id,
        serial_no: `${first.serial_no}`,
        report_date: first.report_date,
        report_date_label: rangeLabel,
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
    const [isExporting, setIsExporting] = useState(false); // Local handler state tracking running exports
    const { user } = useAuth();

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



    // Wrapper trigger function to safely request the Excel compilation layout

    const handleExcelExport = async () => {

        if (!combinedReport) return;

        try {

            setIsExporting(true);

            await exportRsmiToExcel(combinedReport, user?.FullName ?? '');

            toast.success('Range Excel file generated and downloaded successfully.');

        } catch (error) {

            console.error(error);

            toast.error('Failed to generate range spreadsheet file.');

        } finally {

            setIsExporting(false);

        }

    };



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

                    <div className="text-sm text-slate-600 mr-2">

                        Range: <span className="font-medium text-slate-900">{combinedReport?.report_date_label ?? `${startDate} to ${endDate}`}</span>

                    </div>

                    <div className="flex items-center gap-2">

                        {/* Fixed broken <RsmiExport /> component with operational action button */}

                        <button

                            onClick={handleExcelExport}

                            disabled={isExporting || !combinedReport}

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

                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"

                        >

                            <Printer className="h-4 w-4" /> Print

                        </button>

                    </div>

                </div>

            </div>



            {!combinedReport ? (

                <div className="text-slate-700">No RSMI reports found for this date range.</div>

            ) : (

                <RsmiPrintView report={combinedReport} custodianName={user?.FullName ?? ''} />

            )}

        </div>

    );

}