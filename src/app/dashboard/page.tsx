'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { showConfirmDialog } from '@/lib/utils/confirm';

export default function Dashboard() {
    const { user, loading, logout } = useAuth();

    const handleLogout = () => {
        showConfirmDialog({
            title: 'Logout Confirmation',
            description: 'Are you sure you want to logout?',
            confirmText: 'Logout',
            cancelText: 'Cancel',
            onConfirm: logout,
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-100 p-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl mb-4">Welcome, {user.Username}!</h2>
                        <p className="mb-2"><strong>Email:</strong> {user.Email}</p>
                        <p className="mb-2"><strong>Role:</strong> {user.Role}</p>
                        <p className="mb-4"><strong>Department:</strong> {user.Department}</p>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}