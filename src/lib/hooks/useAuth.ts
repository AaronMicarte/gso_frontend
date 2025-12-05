import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { logout as logoutApi, getUser as fetchUser } from '@/lib/auth';
import { User } from '@/types/auth';
import { toast } from 'sonner';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const loadUser = async () => {
            try {
                // Try to get user from session (httpOnly cookie)
                const userData = await fetchUser();
                setUser(userData);
            } catch {
                // Not authenticated or session expired
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, []);

    const logout = async () => {
        try {
            await logoutApi();
            setUser(null);
            toast.success('Logged out successfully');
            router.push('/');
        } catch {
            // Still redirect even if API fails
            setUser(null);
            router.push('/');
        }
    };

    return { user, loading, logout, isAuthenticated: !!user };
}
