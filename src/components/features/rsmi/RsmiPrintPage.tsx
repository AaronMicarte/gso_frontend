'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Printer } from 'lucide-react';
import { getRsmiReport } from '@/lib/api/rsmi';
import type { RsmiReport } from '@/types/rsmi';
import { RsmiPrintView } from './RsmiPrintView';

export function RsmiPrintPage() {
    const params = useParams();
    const router = useRouter();
    const id = Number(params?.id);

    const printRef = useRef<HTMLDivElement>(null);
    const [report, setReport] = useState<RsmiReport | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const run = async () => {
            try {
                setLoading(true);
                const data = await getRsmiReport(id);
                setReport(data);
            } catch {
                toast.error('Failed to load RSMI report');
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

    if (loading) return null;

    if (!report) {
        return (
            <div className="p-6">
                <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="mt-4 text-slate-700">RSMI report not found.</div>
            </div>
        );
    }

    return (
        <div className="print-scope p-4">
            <div className="no-print flex items-center justify-between mb-4">
                <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"
                >
                    <Printer className="h-4 w-4" /> Print
                </button>
            </div>

            <RsmiPrintView ref={printRef} report={report} />
        </div>
    );
}
