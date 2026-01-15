'use client';

import { IssuanceDocumentsListPage } from './IssuanceDocumentsListPage';

interface ICSDocumentsPageProps {
    baseRoute: string;
}

export function ICSDocumentsPage({ baseRoute }: ICSDocumentsPageProps) {
    return (
        <IssuanceDocumentsListPage
            baseRoute={baseRoute}
            pageTitle="ICS Documents"
            pageDescription="Browse and manage Inventory Custodian Slip (ICS) documents"
            fixedDocumentType="ICS"
        />
    );
}
