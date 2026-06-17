'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
// Changed import from 'RsmiExport' to the actual export function name
import { exportRsmiToExcel } from './RsmiExport';
import { getRsmiReport } from '@/lib/api/rsmi';
import type { RsmiReport } from '@/types/rsmi';
import { useAuth } from '@/lib/hooks/useAuth';
import { RsmiPrintView } from './RsmiPrintView';
import { ArrowLeft, Printer, FileSpreadsheet } from 'lucide-react'; // Added explicit spreadsheet icon for the action

export function RsmiPrintPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const id = Number(params?.id);

    const printRef = useRef<HTMLDivElement>(null);
    const [report, setReport] = useState<RsmiReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false); // Local handler state tracking running exports

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

    // Wrapper function to process the file extraction safely
    const handleExcelExport = async () => {
        if (!report) return;
        try {
            setIsExporting(true);
            await exportRsmiToExcel(report, user?.FullName);
            toast.success('Excel file downloaded successfully.');
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate Excel export.');
        } finally {
            setIsExporting(false);
        }
    };

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
                <div className="flex items-center gap-2">
                    {/* Replaced broken <RsmiExport /> tag with a functional action button */}
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

                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"
                    >
                        <Printer className="h-4 w-4" /> Print
                    </button>
                </div>
            </div>

            <RsmiPrintView ref={printRef} report={report} custodianName={user?.FullName} />
        </div>
    );
}