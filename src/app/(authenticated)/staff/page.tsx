import { redirect } from 'next/navigation';

// Redirect /staff to /staff/dashboard
export default function StaffIndexPage() {
    redirect('/staff/dashboard');
}