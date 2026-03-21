'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import transferAPI from '@/lib/api/transfer';
import { PropertyTransfer } from '@/types/propertyTransfer';
import { PTRPrintView } from '@/components/features/transfer';

export default function DepartmentHeadTransferPrintPage() {
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
            router.push('/department_head/transfer');
        } finally {
            setLoading(false);
        }
    }, [transferId, router]);

    useEffect(() => {
        loadTransfer();
    }, [loadTransfer]);

    if (loading) {
        return null;
    }

    if (!transfer) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Transfer not found</div>
                    <div className="text-sm text-slate-600 mt-1">The document could not be loaded.</div>
                    <div className="mt-4">
                        <Link href="/department_head/transfer" className="text-sm text-[var(--primary)] underline">
                            Back to transfers
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 py-6">
            <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex items-center justify-start">
                <Link href={`/department_head/transfer/${transfer.TransferID}`} className="text-sm text-[var(--primary)] underline">
                    Back to transfer
                </Link>
            </div>

            <PTRPrintView transfer={transfer} />
        </div>
    );
}
