'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { getDeliveryReceipt } from '@/lib/api/deliveryReceipts';
import { DeliveryReceipt } from '@/types/procurement';
import { DRPrintView } from '@/components/features/delivery-receipts/DRPrintView';
import exportDRToExcel from '@/components/features/delivery-receipts/IARExport';

export default function StaffDeliveryReceiptPrintPage() {
    const params = useParams();
    const router = useRouter();
    const [dr, setDr] = useState<DeliveryReceipt | null>(null);
    const [loading, setLoading] = useState(true);

    const drId = params?.id ? parseInt(params.id as string, 10) : null;

    const loadDR = useCallback(async () => {
        if (!drId) return;

        try {
            setLoading(true);
            const data = await getDeliveryReceipt(drId);
            setDr(data);
        } catch {
            toast.error('Failed to load delivery receipt');
            router.push('/staff/delivery-receipts');
        } finally {
            setLoading(false);
        }
    }, [drId, router]);

    useEffect(() => {
        loadDR();
    }, [loadDR]);

    useEffect(() => {
        document.body.classList.add('print-scope-active');
        return () => {
            document.body.classList.remove('print-scope-active');
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                    <span className="ml-3 text-gray-600">Loading document…</span>
                </div>
            </div>
        );
    }

    if (!dr) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Delivery receipt not found</div>
                    <div className="text-sm text-slate-600 mt-1">The document could not be loaded.</div>
                    <div className="mt-4">
                        <Link href="/staff/delivery-receipts" className="text-sm text-[var(--primary)] underline">
                            Back to delivery receipts
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="print-scope min-h-screen bg-slate-100 py-6">
            <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex items-center justify-between">
                <Link href={`/staff/delivery-receipts/${dr.DRID}`} className="text-sm text-[var(--primary)] underline">
                    Back to DR
                </Link>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => exportDRToExcel(dr!)}
                        className="inline-flex items-center px-4 py-2 rounded-md text-white bg-[var(--secondary)] hover:bg-[var(--secondary-dark)]"
                    >
                        Export Excel
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center px-4 py-2 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                    >
                        Print
                    </button>
                </div>
            </div>

            <DRPrintView dr={dr} />
        </div>
    );
}
