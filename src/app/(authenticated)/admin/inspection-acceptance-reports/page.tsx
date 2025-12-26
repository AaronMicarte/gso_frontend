import { IARListPage } from '@/components/features/iar/IARListPage';

export default function AdminIARListPage() {
    return <IARListPage baseRoute="/admin" canDelete={true} />;
}
