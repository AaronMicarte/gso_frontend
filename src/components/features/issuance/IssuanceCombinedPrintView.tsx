'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import issuanceAPI from '@/lib/api/issuance';
import { AssetIssuance } from '@/types/assetIssuance';
import { PARPrintView } from './PARPrintView';
import { ICSPrintView } from './ICSPrintView';
import { exportPARToExcel } from './PARExport';

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

function parseSelectedDetailIds(rawValue: string | null): number[] | undefined {
    if (!rawValue) return undefined;
    const parsed = rawValue
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
    return parsed.length > 0 ? parsed : undefined;
}

export function IssuanceCombinedPrintView({ backHref }: CombinedIssuancePrintViewProps) {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [issuances, setIssuances] = useState<AssetIssuance[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const issuanceId = params?.id ? parseInt(params.id as string) : null;
    const requestedType = searchParams.get('type') as DocumentType | null;
    const selectedDetailIds = useMemo(
        () => parseSelectedDetailIds(searchParams.get('details')),
        [searchParams],
    );

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
                    .filter((issuance) => {
                        if (!requestedType) return true;
                        return issuance.DocumentType === requestedType;
                    })
                    .sort((left, right) => {
                        const leftTime = getIssuanceTimestamp(left);
                        const rightTime = getIssuanceTimestamp(right);
                        if (leftTime !== rightTime) return rightTime - leftTime;
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
    }, [backHref, issuanceId, requestedType, router]);

    const printLabel = useMemo(() => {
        const types = issuances
            .map((i) => i.DocumentType)
            .filter((t): t is DocumentType => t === 'PAR' || t === 'ICS');
        if (types.length === 0) return 'PAR/ICS';
        if (types.length === 1) return types[0];
        return 'PAR/ICS';
    }, [issuances]);

    const handleExcelExport = async () => {
        const parIssuance = issuances.find((i) => i.DocumentType === 'PAR');
        if (!parIssuance) {
            toast.error('No PAR document available for export');
            return;
        }
        try {
            setIsExporting(true);
            await exportPARToExcel(parIssuance, selectedDetailIds);
        } catch (err) {
            console.error(err);
            toast.error('Failed to export PAR to Excel');
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
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

    const hasPAR = issuances.some((i) => i.DocumentType === 'PAR');

    return (
        <div className="print-scope min-h-screen bg-slate-100 py-6">

            <div className="no-print max-w-4xl mx-auto px-4 mb-4 flex items-center justify-between">
                <Link href={backHref} className="text-sm text-[var(--primary)] underline">
                    Back to issuance
                </Link>
                <div className="flex items-center gap-2">
                    {hasPAR && (
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
                    )}
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center px-4 py-2 rounded-md text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                    >
                        Print {printLabel}
                    </button>
                </div>
            </div>

            {issuances.map((issuance, index) => (
                <div key={issuance.IssuanceID} className={index === 0 ? '' : 'issuance-doc-break'}>
                    {issuance.DocumentType === 'PAR' ? (
                        <PARPrintView issuance={issuance} selectedDetailIds={selectedDetailIds} />
                    ) : (
                        <ICSPrintView issuance={issuance} selectedDetailIds={selectedDetailIds} />
                    )}
                </div>
            ))}
        </div>
    );
}