import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getToken, removeToken, logout as logoutApi, getUser as fetchUser } from '@/lib/auth';
import { User } from '@/types/auth';
import toast from 'react-hot-toast';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const loadUser = async () => {
            const token = getToken();
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const userData = await fetchUser();
                setUser(userData);
            } catch (error) {
                removeToken();
                toast.error('Session expired. Please login again.');
                router.push('/');
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, [router]);

    const logout = async () => {
        try {
            await logoutApi();
            removeToken();
            setUser(null);
            toast.success('Logged out successfully');
            router.push('/');
        } catch (error) {
            // Still logout locally even if API fails
            removeToken();
            setUser(null);
            router.push('/');
        }
    };

    return { user, loading, logout, isAuthenticated: !!user };
}
