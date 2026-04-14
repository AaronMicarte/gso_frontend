'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Printer } from 'lucide-react';
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

    useEffect(() => {
        document.body.classList.add('print-scope-active');
        return () => {
            document.body.classList.remove('print-scope-active');
        };
    }, []);

    const doPrint = () => {
        window.print();
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
                <button onClick={doPrint} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90">
                    <Printer className="h-4 w-4" /> Print
                </button>
            </div>

            {/* Print-only strong borders applied here so RISPrintView source remains unchanged */}
            <div className="ris-print-root">
                <style dangerouslySetInnerHTML={{
                    __html: `@media print {
                        .ris-print-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }`
                }} />

                <RISPrintView ref={printRef} ris={ris} />
            </div>
        </div>
    );
}
