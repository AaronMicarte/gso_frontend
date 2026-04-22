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

export async function listNotifications(perPage = 20): Promise<NotificationItem[]> {
    const response = await apiClient.get<{ data: NotificationItem[] }>('/notifications', {
        params: { per_page: perPage },
    });

    return response.data.data;
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
