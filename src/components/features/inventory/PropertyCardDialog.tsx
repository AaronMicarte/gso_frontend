'use client';

import { usePathname } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';

type PropertyCardDialogProps = {
    inventoryDetailId: number;
    propertyNumber?: string;
    itemName: string;
    description?: string;
    category?: string;
    custodianName?: string;
};

export function PropertyCardDialog({
    inventoryDetailId,
}: PropertyCardDialogProps) {
    const pathname = usePathname();
    const rolePrefix = pathname?.startsWith('/staff')
        ? '/staff'
        : pathname?.startsWith('/department_head')
            ? '/department_head'
            : '/admin';

    const handleOpenPrintView = () => {
        const url = `${rolePrefix}/inventory/property-card/${inventoryDetailId}/print`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <button
            type="button"
            onClick={handleOpenPrintView}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Open Property Card Print View"
        >
            <FileSpreadsheet className="w-4 h-4" />
        </button>
    );
}
