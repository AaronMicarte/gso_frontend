import { redirect } from 'next/navigation';

// Redirect /department_head to /department_head/dashboard
export default function DepartmentHeadIndexPage() {
    redirect('/department_head/dashboard');
}
