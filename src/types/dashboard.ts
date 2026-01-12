// Dashboard statistics from the database
export interface DashboardStats {
    totalAssets: number;
    totalInventory: number;
    availableInventory: number;
    totalDeliveryReceipts: number;
    totalUsers: number;
    totalDepartments: number;
    pendingRequests: number;
    forDisposal: number;
    forRepair: number;
}

export interface DashboardStatsResponse {
    stats: DashboardStats;
    generatedAt: string;
}

// Activity types for recent activity feed
export type ActivityType = 'login' | 'delivery_receipt' | 'property_transfer' | 'issuance';

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

// Department Head-specific dashboard types
export interface DepartmentHeadStats {
    totalAssets: number;        // Total properties under this department head's care
    assignedAssets: number;     // Currently assigned to end users
    pendingRequests: number;    // Pending issuance requests
    overdueReturns: number;     // Items past due date
}

export interface DepartmentHeadStatsResponse {
    stats: DepartmentHeadStats;
    generatedAt: string;
}

export interface DepartmentHeadActivity {
    id: string;
    type: 'assignment' | 'request' | 'return' | 'verification';
    message: string;
    time: string;
    status: 'completed' | 'pending' | 'overdue';
}

export interface DepartmentHeadActivityResponse {
    activities: DepartmentHeadActivity[];
}
