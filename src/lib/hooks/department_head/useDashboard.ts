import { useState, useEffect } from 'react';
import { getDepartmentHeadStats, getDepartmentHeadActivities } from '@/lib/api/department_head/dashboard';
import { DepartmentHeadStats, DepartmentHeadActivity } from '@/types/dashboard';
import { toast } from 'sonner';

export function useDepartmentHeadDashboard() {
    const [stats, setStats] = useState<DepartmentHeadStats | null>(null);
    const [activities, setActivities] = useState<DepartmentHeadActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Load stats and activities in parallel
                const [statsResponse, activitiesResponse] = await Promise.all([
                    getDepartmentHeadStats(),
                    getDepartmentHeadActivities()
                ]);

                setStats(statsResponse.stats);
                setActivities(activitiesResponse.activities);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
                setError(errorMessage);
                toast.error(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
    }, []);

    const refreshData = async () => {
        try {
            setError(null);
            const [statsResponse, activitiesResponse] = await Promise.all([
                getDepartmentHeadStats(),
                getDepartmentHeadActivities()
            ]);

            setStats(statsResponse.stats);
            setActivities(activitiesResponse.activities);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to refresh dashboard data';
            setError(errorMessage);
            toast.error(errorMessage);
        }
    };

    return {
        stats,
        activities,
        loading,
        error,
        refreshData
    };
}