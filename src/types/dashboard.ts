// Dashboard statistics from the database
export interface DashboardStats {
    totalAssets: number;
    totalInventory: number;
    pendingRequests: number;
    totalUsers: number;
    totalDepartments: number;
    pendingJobOrders: number;
    forDisposal: number;
    forRepair: number;
}

export interface DashboardStatsResponse {
    stats: DashboardStats;
    generatedAt: string;
}

// Activity types for recent activity feed
export type ActivityType = 'login' | 'purchase_request' | 'property_transfer' | 'job_order';

export interface Activity {
    id: string;
    type: ActivityType;
    action: string;
    description: string;
    user: string;
    timestamp: string;
    timeAgo: string;
    ip_address?: string | null;
}

export interface RecentActivityResponse {
    activities: Activity[];
}
