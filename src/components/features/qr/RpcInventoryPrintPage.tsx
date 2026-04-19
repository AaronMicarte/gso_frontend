'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { getRpcInventoryReport } from '@/lib/api/rpcInventory';
import type { RpcInventoryReportResponse, RpcType } from '@/types/rpcInventory';
import { RpcInventoryPrintView } from './RpcInventoryPrintView';

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
                <Button size="sm" className="w-auto" onClick={() => window.print()}>
                    Print / Save PDF
                </Button>
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
