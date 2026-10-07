'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';

import { getRpcInventoryReport } from '@/lib/api/rpcInventory';
import type { RpcInventoryReportResponse, RpcType } from '@/types/rpcInventory';
import { RpcInventoryPrintView } from './RpcInventoryPrintView';
import { exportRPCPPEToExcel } from './RpcppeExport';

export function RpcInventoryPrintPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const id = Number(params?.id);

    const reportType = useMemo<RpcType>(() => {
        const input = (searchParams.get('type') || 'RPCPPE').toUpperCase();
        return input === 'RPCSEP' ? 'RPCSEP' : 'RPCPPE';
    }, [searchParams]);

    const [report, setReport] = useState<RpcInventoryReportResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (!Number.isInteger(id) || id <= 0) return;

        const load = async () => {
            try {
                setLoading(true);
                const data = await getRpcInventoryReport(id);
                setReport(data);
            } catch {
                toast.error('Failed to load RPC report');
                setReport(null);
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [id]);

    const handleExcelExport = async () => {
        if (!report) return;
        try {
            setIsExporting(true);
            await exportRPCPPEToExcel(report, reportType);
        } catch {
            toast.error('Failed to export Excel');
        } finally {
            setIsExporting(false);
        }
    };

    if (!Number.isInteger(id) || id <= 0) {
        return <div className="p-6 text-red-700">Invalid report ID.</div>;
    }

    if (loading) {
        return <div className="p-6">Loading report...</div>;
    }

    if (!report) {
        return <div className="p-6 text-red-700">Report not found.</div>;
    }

    const bucket = reportType === 'RPCPPE' ? report.rpcppe : report.rpcsep;

    return (
        <div className="p-6 space-y-4 bg-slate-100 min-h-screen">
            <div className="print:hidden flex items-center justify-between">
                <h1 className="text-lg font-semibold text-slate-900">
                    {reportType} Report - {report.cycle.cycle_label}
                </h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.location.href = `?type=${reportType}&fresh=1`}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh report
                    </button>
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
                    {/* <Button size="sm" className="w-auto" onClick={() => window.print()}>
                        Print / Save PDF
                    </Button> */}
                </div>
            </div>

            <RpcInventoryPrintView
                cycleLabel={report.cycle.cycle_label}
                type={reportType}
                generatedAt={report.generated_at}
                rows={bucket.rows}
                propertyTypes={bucket.property_types || []}
                scannedCount={bucket.scanned_count}
                totalCount={bucket.total_count}
            />
        </div>
    );
}