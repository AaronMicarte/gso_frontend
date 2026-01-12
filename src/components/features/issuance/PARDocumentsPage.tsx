'use client';

import { IssuanceListPage } from './IssuanceListPage';

interface PARDocumentsPageProps {
    baseRoute: string;
}

export function PARDocumentsPage({ baseRoute }: PARDocumentsPageProps) {
    return (
        <IssuanceListPage
            baseRoute={baseRoute}
            canIssue={false}
            pageTitle="PAR Documents"
            pageDescription="Browse and manage Property Acknowledgment Receipt (PAR) documents"
            fixedDocumentType="PAR"
        />
    );
}
