'use client';

import { IssuanceDocumentsListPage } from './IssuanceDocumentsListPage';

interface IssuanceCombinedDocumentsPageProps {
    baseRoute: string;
}

export function IssuanceCombinedDocumentsPage({ baseRoute }: IssuanceCombinedDocumentsPageProps) {
    return (
        <IssuanceDocumentsListPage
            baseRoute={baseRoute}
            pageTitle="PAR & ICS Documents"
            pageDescription="Consolidated register of Property Acknowledgment Receipts (PAR) and Inventory Custodian Slips (ICS)"
        />
    );
}
