import { redirect } from 'next/navigation';

// Redirect /admin to /admin/dashboard
export default function AdminIndexPage() {
    redirect('/admin/dashboard');
}
