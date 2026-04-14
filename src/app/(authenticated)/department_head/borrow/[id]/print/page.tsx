'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import borrowAPI from '@/lib/api/borrow';
import { PropertyBorrow } from '@/types/propertyBorrow';
import { BorrowPrintView } from '@/components/features/borrow';

export default function DepartmentHeadBorrowPrintPage() {
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
            router.push('/department_head/borrow');
        } finally {
            setLoading(false);
        }
    }, [borrowId, router]);

    useEffect(() => {
        loadBorrow();
    }, [loadBorrow]);

    useEffect(() => {
        document.body.classList.add('print-scope-active');
        return () => {
            document.body.classList.remove('print-scope-active');
        };
    }, []);

    if (loading) {
        return null;
    }

    if (!borrow) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Borrow not found</div>
                    <div className="text-sm text-slate-600 mt-1">The document could not be loaded.</div>
                    <div className="mt-4">
                        <Link href="/department_head/borrow" className="text-sm text-[var(--primary)] underline">
                            Back to borrows
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="print-scope min-h-screen bg-slate-100 py-6">
            <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex items-center justify-start">
                <Link href={`/department_head/borrow/${borrow.BorrowID}`} className="text-sm text-[var(--primary)] underline">
                    Back to borrow
                </Link>
            </div>

            <BorrowPrintView borrow={borrow} />
        </div>
    );
}
