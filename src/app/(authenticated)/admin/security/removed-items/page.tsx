import { RemovedItemsPage } from '@/components/features/rlsddp/RemovedItemsPage';

export const metadata = {
    title: 'Removed Items | GSO Admin',
    description: 'View and restore inventory items removed via RLSDDP reports.',
};

export default function Page() {
    return <RemovedItemsPage baseRoute="/admin" />;
}
