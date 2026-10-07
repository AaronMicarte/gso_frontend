'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { getRis } from '@/lib/api/ris';
import type { RisRecord } from '@/types/ris';
import { RISPrintView } from './RISPrintView';
import { exportRISToExcel } from './RISExport';

export function RISPrintPage() {
    const params = useParams();
    const router = useRouter();
    const id = Number(params?.id);

    const printRef = useRef<HTMLDivElement>(null);
    const [ris, setRis] = useState<RisRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

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

    useEffect(() => {
        document.body.classList.add('print-scope-active');
        return () => {
            document.body.classList.remove('print-scope-active');
        };
    }, []);


    const doExport = async () => {
        if (!ris) return;
        try {
            setExporting(true);
            await exportRISToExcel(ris);
        } catch (err) {
            console.error(err);
            toast.error('Failed to export RIS to Excel');
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return null;
    }

    if (!ris) {
        return (
            <div className="p-6">
                <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="mt-4 text-slate-700">RIS not found.</div>
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
                    <button
                        onClick={doExport}
                        disabled={exporting}
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
                    {/* <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90">
                        <Printer className="h-4 w-4" /> Print
                    </button> */}
                </div>
            </div>

            {/* Print-only strong borders applied here so RISPrintView source remains unchanged */}
            <div className="ris-print-root">
                <RISPrintView ref={printRef} ris={ris} />
            </div>
        </div>
    );
}