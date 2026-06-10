'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import issuanceAPI from '@/lib/api/issuance';
import { AssetIssuance } from '@/types/assetIssuance';
import { PARPrintView } from './PARPrintView';
import { ICSPrintView } from './ICSPrintView';

interface CombinedIssuancePrintViewProps {
    backHref: string;
}

type DocumentType = 'PAR' | 'ICS';

function getIssuanceTimestamp(issuance: AssetIssuance): number {
    const rawDate = issuance.IssuanceDate;
    if (!rawDate) return 0;
    const parsed = new Date(rawDate).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function IssuanceCombinedPrintView({ backHref }: CombinedIssuancePrintViewProps) {
    const params = useParams();
    const router = useRouter();
    const [issuances, setIssuances] = useState<AssetIssuance[]>([]);
    const [loading, setLoading] = useState(true);

    const issuanceId = params?.id ? parseInt(params.id as string) : null;

    useEffect(() => {
        document.body.classList.add('print-scope-active');
        return () => {
            document.body.classList.remove('print-scope-active');
        };
    }, []);

    useEffect(() => {
        const loadIssuance = async () => {
            if (!issuanceId) return;

            try {
                setLoading(true);
                const current = await issuanceAPI.getById(issuanceId);
                const related = current.issuances_by_document_type ?? null;

                const siblingIds = [related?.PAR?.IssuanceID, related?.ICS?.IssuanceID]
                    .filter((id): id is number => typeof id === 'number' && id > 0 && id !== current.IssuanceID);

                const siblingIssuances = siblingIds.length > 0
                    ? await Promise.all(siblingIds.map((id) => issuanceAPI.getById(id)))
                    : [];

                const merged = [current, ...siblingIssuances]
                    .reduce<AssetIssuance[]>((accumulator, issuance) => {
                        const docType = issuance.DocumentType as DocumentType;
                        if (docType === 'PAR' || docType === 'ICS') {
                            if (!accumulator.some((item) => item.DocumentType === docType)) {
                                accumulator.push(issuance);
                            }
                        }
                        return accumulator;
                    }, [])
                    .sort((left, right) => {
                        const leftTime = getIssuanceTimestamp(left);
                        const rightTime = getIssuanceTimestamp(right);
                        if (leftTime !== rightTime) {
                            return rightTime - leftTime;
                        }
                        return right.IssuanceID - left.IssuanceID;
                    });

                setIssuances(merged);
            } catch {
                toast.error('Failed to load issuance');
                router.push(backHref);
            } finally {
                setLoading(false);
            }
        };

        loadIssuance();
    }, [backHref, issuanceId, router]);

    const printLabel = useMemo(() => {
        const types = issuances.map((issuance) => issuance.DocumentType).filter((type): type is DocumentType => type === 'PAR' || type === 'ICS');
        if (types.length === 0) return 'PAR/ICS';
        if (types.length === 1) return types[0];
        return 'PAR/ICS';
    }, [issuances]);

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

    if (issuances.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
                    <div className="text-slate-900 font-semibold">Issuance not found</div>
                    <div className="text-sm text-slate-600 mt-1">The document could not be loaded.</div>
                    <div className="mt-4">
                        <Link href={backHref} className="text-sm text-[var(--primary)] underline">
                            Back to issuances
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="print-scope min-h-screen bg-slate-100 py-6">

            <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex items-center justify-between">
                <Link href={backHref} className="text-sm text-[var(--primary)] underline">
                    Back to issuance
                </Link>
                <button
                    onClick={() => window.print()}
                    className="inline-flex items-center px-4 py-2 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                >
                    Print {printLabel}
                </button>
            </div>

            {issuances.map((issuance, index) => {
                const isFirst = index === 0;
                const wrapperClassName = isFirst ? '' : 'issuance-doc-break';

                return (
                    <div key={issuance.IssuanceID} className={wrapperClassName}>
                        {issuance.DocumentType === 'PAR' ? (
                            <PARPrintView issuance={issuance} />
                        ) : (
                            <ICSPrintView issuance={issuance} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
