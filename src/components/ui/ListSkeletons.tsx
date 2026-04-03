'use client';

interface TableSkeletonRowsProps {
    columns: number;
    rows?: number;
    cellClassName?: string;
}

export function TableSkeletonRows({ columns, rows = 10, cellClassName = 'px-6 py-4' }: TableSkeletonRowsProps) {
    return (
        <>
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={`skeleton-row-${rowIndex}`} className="animate-pulse">
                    {Array.from({ length: columns }).map((_, colIndex) => {
                        const widthClass = colIndex === 0
                            ? 'w-28'
                            : colIndex === columns - 1
                                ? 'w-20'
                                : colIndex % 3 === 0
                                    ? 'w-32'
                                    : 'w-24';

                        return (
                            <td key={`skeleton-cell-${rowIndex}-${colIndex}`} className={cellClassName}>
                                <div className={`h-3 rounded bg-slate-200 ${widthClass}`} />
                            </td>
                        );
                    })}
                </tr>
            ))}
        </>
    );
}

interface CardListSkeletonProps {
    cards?: number;
}

export function CardListSkeleton({ cards = 4 }: CardListSkeletonProps) {
    return (
        <div className="grid gap-4 p-4 sm:p-6">
            {Array.from({ length: cards }).map((_, index) => (
                <div key={`skeleton-card-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-3 flex-1">
                            <div className="h-4 w-48 rounded bg-slate-200" />
                            <div className="h-3 w-64 rounded bg-slate-200" />
                        </div>
                        <div className="h-6 w-24 rounded-full bg-slate-200" />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="h-14 rounded-xl bg-slate-100" />
                        <div className="h-14 rounded-xl bg-slate-100" />
                        <div className="h-14 rounded-xl bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}
