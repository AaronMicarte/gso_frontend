import AdminUsersEditPage from '@/components/features/users/AdminUsersEditPage';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
    const resolved = await params;
    const userId = Number(resolved.id);

    if (!Number.isFinite(userId) || userId <= 0) {
        return <div className="p-6 text-sm text-rose-700">Invalid user ID.</div>;
    }

    return <AdminUsersEditPage userId={userId} />;
}
