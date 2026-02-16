'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import issuanceAPI from '@/lib/api/issuance';
import { AssetIssuance } from '@/types/assetIssuance';
import { PARPrintView } from '@/components/features/issuance/PARPrintView';
import { ICSPrintView } from '@/components/features/issuance/ICSPrintView';

export default function AdminIssuancePrintPage() {
    const params = useParams();
    const router = useRouter();
    const [issuance, setIssuance] = useState<AssetIssuance | null>(null);
    const [loading, setLoading] = useState(true);

    const issuanceId = params?.id ? parseInt(params.id as string) : null;

    const loadIssuance = useCallback(async () => {
        if (!issuanceId) return;

        try {
            setLoading(true);
            const data = await issuanceAPI.getById(issuanceId);
            setIssuance(data);
        } catch {
            toast.error('Failed to load issuance');
            router.push('/admin/issuance');
        } finally {
            setLoading(false);
        }
    }, [issuanceId, router]);

    useEffect(() => {
        loadIssuance();
    }, [loadIssuance]);

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

    if (!issuance) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Issuance not found</div>
                    <div className="text-sm text-slate-600 mt-1">The document could not be loaded.</div>
                    <div className="mt-4">
                        <Link href="/admin/issuance" className="text-sm text-[var(--primary)] underline">
                            Back to issuances
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 py-6">
            <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex items-center justify-between">
                <Link href={`/admin/issuance/${issuance.IssuanceID}`} className="text-sm text-[var(--primary)] underline">
                    Back to issuance
                </Link>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center px-4 py-2 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                >
                    Print
                </button>
            </div>

            {issuance.DocumentType === 'PAR' ? (
                <PARPrintView issuance={issuance} />
            ) : (
                <ICSPrintView issuance={issuance} />
            )}
        </div>
    );
}
