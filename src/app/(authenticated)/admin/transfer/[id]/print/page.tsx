'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import transferAPI from '@/lib/api/transfer';
import { PropertyTransfer } from '@/types/propertyTransfer';
import { PTRPrintView } from '@/components/features/transfer';

export default function AdminTransferPrintPage() {
    const params = useParams();
    const router = useRouter();
    const [transfer, setTransfer] = useState<PropertyTransfer | null>(null);
    const [loading, setLoading] = useState(true);

    const transferId = params?.id ? parseInt(params.id as string) : null;

    const loadTransfer = useCallback(async () => {
        if (!transferId) return;

        try {
            setLoading(true);
            const data = await transferAPI.getById(transferId);
            setTransfer(data);
        } catch {
            toast.error('Failed to load transfer');
            router.push('/admin/transfer');
        } finally {
            setLoading(false);
        }
    }, [transferId, router]);

    useEffect(() => {
        loadTransfer();
    }, [loadTransfer]);

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

    if (!transfer) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Transfer not found</div>
                    <div className="text-sm text-slate-600 mt-1">The document could not be loaded.</div>
                    <div className="mt-4">
                        <Link href="/admin/transfer" className="text-sm text-[var(--primary)] underline">
                            Back to transfers
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="print-scope min-h-screen bg-slate-100 py-6">
            <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex items-center justify-between">
                <Link href={`/admin/transfer/${transfer.TransferID}`} className="text-sm text-[var(--primary)] underline">
                    Back to transfer
                </Link>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center px-4 py-2 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
                >
                    Print
                </button>
            </div>

            <PTRPrintView transfer={transfer} />
        </div>
    );
}
