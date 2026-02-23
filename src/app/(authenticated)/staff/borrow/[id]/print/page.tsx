'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import borrowAPI from '@/lib/api/borrow';
import { PropertyBorrow } from '@/types/propertyBorrow';
import { BorrowPrintView } from '@/components/features/borrow';

export default function StaffBorrowPrintPage() {
    const params = useParams();
    const router = useRouter();
    const [borrow, setBorrow] = useState<PropertyBorrow | null>(null);
    const [loading, setLoading] = useState(true);

    const borrowId = params?.id ? parseInt(params.id as string) : null;

    const loadBorrow = useCallback(async () => {
        if (!borrowId) return;

        try {
            setLoading(true);
            const data = await borrowAPI.getById(borrowId);
            setBorrow(data);
        } catch {
            toast.error('Failed to load borrow request');
            router.push('/staff/borrow');
        } finally {
            setLoading(false);
        }
    }, [borrowId, router]);

    useEffect(() => {
        loadBorrow();
    }, [loadBorrow]);

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

    if (!borrow) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Borrow not found</div>
                    <div className="text-sm text-slate-600 mt-1">The document could not be loaded.</div>
                    <div className="mt-4">
                        <Link href="/staff/borrow" className="text-sm text-[var(--primary)] underline">
                            Back to borrows
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 py-6">
            <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex items-center justify-between">
                <Link href={`/staff/borrow/${borrow.BorrowID}`} className="text-sm text-[var(--primary)] underline">
                    Back to borrow
                </Link>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center px-4 py-2 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
                >
                    Print
                </button>
            </div>

            <BorrowPrintView borrow={borrow} />
        </div>
    );
}
