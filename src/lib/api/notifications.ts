import apiClient from '@/lib/api/client';

export interface NotificationItem {
    UserNotificationID: number;
    event_type: string;
    title: string;
    message: string;
    payload?: Record<string, unknown> | null;
    status: 'pending' | 'sent' | 'failed';
    read_at?: string | null;
    created_at: string;
}

export interface PaginatedNotificationsResponse {
    data: NotificationItem[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    unread_count: number;
}

export async function registerPushToken(token: string, deviceName?: string): Promise<void> {
    await apiClient.post('/notifications/push-token', {
        token,
        platform: 'web',
        device_name: deviceName ?? null,
    });
}

export async function removePushToken(token: string): Promise<void> {
    await apiClient.delete('/notifications/push-token', {
        data: { token },
    });
}

export async function getUnreadNotificationCount(): Promise<number> {
    const response = await apiClient.get<{ unread_count: number }>('/notifications/unread-count');
    return response.data?.unread_count ?? 0;
}

export async function listNotifications(page = 1, perPage = 25, unreadOnly = false): Promise<PaginatedNotificationsResponse> {
    const response = await apiClient.get<PaginatedNotificationsResponse>('/notifications', {
        params: {
            page,
            per_page: perPage,
            unread_only: unreadOnly ? 1 : 0,
        },
    });

    return response.data;
}

export async function listRecentNotifications(limit = 8): Promise<NotificationItem[]> {
    const response = await apiClient.get<PaginatedNotificationsResponse>('/notifications', {
        params: {
            page: 1,
            per_page: limit,
        },
    });

    return response.data?.data ?? [];
}

export async function markNotificationRead(notificationId: number): Promise<void> {
    await apiClient.patch(`/notifications/${notificationId}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
    await apiClient.patch('/notifications/read-all');
}

export async function deleteNotification(notificationId: number): Promise<void> {
    await apiClient.delete(`/notifications/${notificationId}`);
}

export async function deleteAllNotifications(): Promise<void> {
    await apiClient.delete('/notifications');
}
