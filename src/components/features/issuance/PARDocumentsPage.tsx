'use client';

import { IssuanceDocumentsListPage } from './IssuanceDocumentsListPage';

interface PARDocumentsPageProps {
    baseRoute: string;
}

export function PARDocumentsPage({ baseRoute }: PARDocumentsPageProps) {
    return (
        <IssuanceDocumentsListPage
            baseRoute={baseRoute}
            pageTitle="PAR Documents"
            pageDescription="Browse and manage Property Acknowledgment Receipt (PAR) documents"
            fixedDocumentType="PAR"
        />
    );
}
