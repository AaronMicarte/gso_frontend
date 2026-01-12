'use client';

import { IssuanceListPage } from './IssuanceListPage';

interface ICSDocumentsPageProps {
    baseRoute: string;
}

export function ICSDocumentsPage({ baseRoute }: ICSDocumentsPageProps) {
    return (
        <IssuanceListPage
            baseRoute={baseRoute}
            canIssue={false}
            pageTitle="ICS Documents"
            pageDescription="Browse and manage Inventory Custodian Slip (ICS) documents"
            fixedDocumentType="ICS"
        />
    );
}
