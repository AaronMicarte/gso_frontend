'use client';

import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/lib/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function Dashboard() {
    const { user, loading, logout } = useAuth();

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
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#1f2937',
                        color: '#f9fafb',
                        border: '1px solid #6b7280',
                    },
                }}
            />
            <div className="min-h-screen bg-gray-100 p-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl mb-4">Welcome, {user.Username}!</h2>
                        <p className="mb-2"><strong>Email:</strong> {user.Email}</p>
                        <p className="mb-2"><strong>Role:</strong> {user.Role}</p>
                        <p className="mb-4"><strong>Department:</strong> {user.Department}</p>
                        <button
                            onClick={logout}
                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}