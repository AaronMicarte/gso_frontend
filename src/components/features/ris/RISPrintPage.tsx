'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { getRis } from '@/lib/api/ris';
import type { RisRecord } from '@/types/ris';
import { RISPrintView } from './RISPrintView';

export function RISPrintPage() {
    const params = useParams();
    const router = useRouter();
    const id = Number(params?.id);

    const printRef = useRef<HTMLDivElement>(null);
    const [ris, setRis] = useState<RisRecord | null>(null);
    const [loading, setLoading] = useState(true);

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

    const doPrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat print:hidden" style={{ backgroundImage: "url('/assets/images/background/bg.jpg')" }}>
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mx-auto" />
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        );
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
        <div className="p-4">
            <div className="no-print flex items-center justify-between mb-4">
                <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={doPrint} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90">
                    <Printer className="h-4 w-4" /> Print
                </button>
            </div>

            {/* Print-only strong borders applied here so RISPrintView source remains unchanged */}
            <div className="ris-print-root">
                <style dangerouslySetInnerHTML={{
                    __html: `@media print {
                        .ris-print-root .ris-table { border: 1px solid #000 !important; border-collapse: collapse !important; }
                        .ris-print-root .ris-table th, .ris-print-root .ris-table td { border: 1px solid #000 !important; box-shadow: none !important; }

                        /* FORCE a clear horizontal rule under the top-group header (Requisition / Stock Available? / Issue) */
                        .ris-print-root .ris-table thead tr.top-group th {
                            border-bottom: 1px solid #000 !important;
                            background: #fff !important;
                        }

                        /* vertical divider and cell padding */
                        .ris-print-root .ris-table .vertical-divider { border-left: 1px solid #000 !important; }

                        /* Ensure Yes/No cells don't render a darker boxed look in print */
                        .ris-print-root .ris-table td.ris-yesno {
                            box-shadow: none !important;
                            border-left-width: 1px !important;
                            border-right-width: 1px !important;
                            border-color: #000 !important;
                            background: transparent !important;
                            padding-top: 6px !important;
                            padding-bottom: 6px !important;
                        }

                        /* fallback: ensure normal cell padding for all cells */
                        .ris-print-root .ris-table td { padding: 6px 6px !important; }
                        .ris-print-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }`
                }} />

                <RISPrintView ref={printRef} ris={ris} />
            </div>
        </div>
    );
}
