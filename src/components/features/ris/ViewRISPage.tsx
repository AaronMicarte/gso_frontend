'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Printer, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { getRis } from '@/lib/api/ris';
import type { RisRecord } from '@/types/ris';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { exportRISToExcel } from './RISExport';

const fmt = (d?: string | null) => {
    if (!d) return 'Not recorded';
    return format(toZonedTime(new Date(d), 'Asia/Manila'), 'PP');
};

const text = (v: unknown, fb: string) => {
    const t = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
    return t.length ? t : fb;
};

function parseTrailingNumber(value: string): { prefix: string; number: number; width: number } | null {
    const trimmed = value.trim();
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (!match) return null;
    const numberText = match[2];
    return {
        prefix: match[1],
        number: Number(numberText),
        width: numberText.length,
    };
}

function formatRange(values: string[]): string {
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
            .map((item) => ({ parsed: item.parsed! }))
            .sort((a, b) => a.parsed.number - b.parsed.number);

        const blocks: string[] = [];
        let start = sorted[0].parsed.number;
        let previous = sorted[0].parsed.number;

        const pushBlock = (rangeStart: number, rangeEnd: number) => {
            const startFull = `${firstParsed!.prefix}${String(rangeStart).padStart(firstParsed!.width, '0')}`;
            if (rangeStart === rangeEnd) {
                blocks.push(startFull);
                return;
            }
            const endSuffix = String(rangeEnd).padStart(firstParsed!.width, '0');
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
}

const currency = (n: number | null | undefined) => {
    if (n == null || Number.isNaN(Number(n))) return '';
    return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function ViewRISPage({ baseRoute }: { baseRoute: string }) {
    const params = useParams();
    const router = useRouter();
    const id = Number(params?.id);

    const [ris, setRis] = useState<RisRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        const run = async () => {
            try {
                setLoading(true);
                const data = await getRis(id);
                setRis(data);
            } catch {
                toast.error('Failed to load RIS');
            } finally {
                setLoading(false);
            }
        };
        if (Number.isFinite(id)) run();
    }, [id]);

    const handleExcelExport = async () => {
        if (!ris) return;
        try {
            setIsExporting(true);
            await exportRISToExcel(ris);
        } catch {
            toast.error('Failed to export RIS to Excel');
        } finally {
            setIsExporting(false);
        }
    };

    const statusLabel = useMemo(() => {
        const s = ris?.status;
        if (!s) return 'Unknown';
        if (s === 'for_issuance') return 'For issuance';
        if (s === 'issued') return 'Issued';
        if (s === 'received') return 'Received';
        if (s === 'cancelled') return 'Cancelled';
        return s;
    }, [ris?.status]);

    // Mirrors RISExport.tsx field resolution: req, office, docDate, supplier, ris number
    const req = ris?.request ?? ris?.asset_request ?? null;

    const docDate = useMemo(
        () => text(fmt(req?.RequestDate), fmt(new Date().toISOString())),
        [req?.RequestDate],
    );

    const officeText = text(
        req?.Office ?? req?.office ?? req?.department?.DepartmentName ?? '',
        'N/A',
    );

    const supplierText = text((req as { supplier_name?: string } | null)?.supplier_name ?? '', 'N/A');

    const risNumberText = text(ris?.ris_number, '0000-00-0000');

    const requesterName = text(
        ris?.signatures?.received_by?.issued_to_name
        || ris?.signatures?.received_by?.user?.FullName
        || req?.requester?.FullName
        || ris?.signatures?.approved_by?.user?.FullName
        || '',
        'N/A',
    );

    const itemRows = useMemo(() => {
        return (ris?.items ?? []).map((it, idx) => {
            const key = `${idx}:${[
                String(it.stock_no ?? '').trim(),
                String(it.description ?? '').trim(),
                String(it.unit ?? '').trim(),
                String(it.brand ?? '').trim(),
                String(it.model ?? '').trim(),
                String(it.serial ?? '').trim(),
            ].join('|')}`;

            const propNumbers = it.property_numbers?.length
                ? it.property_numbers
                : (it.stock_no ? [String(it.stock_no)] : []);
            const stockNoText = formatRange(propNumbers) || text(it.stock_no, '');

            const descriptionText = [it.description, it.brand, it.model, it.serial]
                .map((v) => text(v ?? '', ''))
                .filter(Boolean)
                .join(', ');

            const qty = typeof it.quantity_requested === 'number' ? it.quantity_requested : Number(it.quantity_requested ?? 0) || 0;
            const unitCost = it.unit_cost == null ? null : Number(it.unit_cost);
            const total = unitCost == null ? null : qty * unitCost;

            return {
                key,
                stockNoText,
                unit: text(it.unit, ''),
                descriptionText: descriptionText || 'N/A',
                qty: it.quantity_requested ?? '',
                unitCost,
                total,
            };
        });
    }, [ris?.items]);

    const grandTotal = useMemo(
        () => itemRows.reduce((sum, r) => sum + (r.total ?? 0), 0),
        [itemRows],
    );

    if (loading) {
        return null;
    }

    if (!ris) {
        return (
            <div
                className="flex items-center justify-center min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden"
                style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}
            >
                <div className="text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                    <p className="text-slate-600">RIS not found</p>
                    <button onClick={() => router.back()} className="text-[var(--primary)] hover:underline">Back to list</button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="p-6 space-y-4 min-h-screen bg-fixed bg-cover bg-center bg-no-repeat print:hidden"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <div className="mt-2">
                        <div className="text-xl font-bold text-slate-900">RIS {risNumberText}</div>
                        <div className="text-sm text-slate-600">Status: {statusLabel}</div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExcelExport}
                        disabled={isExporting}
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
                    <Link
                        href={`${baseRoute}/${ris.id}/print`}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"
                    >
                        <Printer className="h-4 w-4" /> Print
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="text-sm font-semibold text-slate-900">Header</div>

                    <div className="text-sm">
                        <span className="text-slate-600">Supplier:</span> {supplierText}
                    </div>

                    <div className="text-sm">
                        <span className="text-slate-600">Office:</span> {officeText}
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="text-sm font-semibold text-slate-900">Request</div>
                    <div className="text-sm"><span className="text-slate-600">RIS No:</span> {risNumberText}</div>
                    <div className="text-sm"><span className="text-slate-600">Requester:</span> {requesterName}</div>
                    <div className="text-sm"><span className="text-slate-600">Date:</span> {docDate}</div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-sm font-semibold text-slate-900 mb-3">Items</div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-600">
                                <th className="text-left py-2 pr-3">Stock No.</th>
                                <th className="text-center py-2 px-3">Unit</th>
                                <th className="text-left py-2 px-3">Description</th>
                                <th className="text-center py-2 px-3">Quantity</th>
                                <th className="text-right py-2 px-3">Cost</th>
                                <th className="text-right py-2 pl-3">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {itemRows.map((r) => (
                                <tr key={r.key}>
                                    <td className="py-2 pr-3">{r.stockNoText || 'N/A'}</td>
                                    <td className="py-2 px-3 text-center">{r.unit || 'N/A'}</td>
                                    <td className="py-2 px-3">{r.descriptionText}</td>
                                    <td className="py-2 px-3 text-center">{r.qty}</td>
                                    <td className="py-2 px-3 text-right">{r.unitCost != null ? currency(r.unitCost) : ''}</td>
                                    <td className="py-2 pl-3 text-right">{r.total != null ? currency(r.total) : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-slate-200">
                                <td colSpan={5} className="py-2 px-3 text-right font-semibold text-slate-700">Grand Total</td>
                                <td className="py-2 pl-3 text-right font-semibold text-slate-900">{currency(grandTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-sm font-semibold text-slate-900 mb-2">Purpose</div>
                <div className="text-sm text-slate-800">{text(ris.purpose, 'N/A')}</div>
            </div>
        </div>
    );
}