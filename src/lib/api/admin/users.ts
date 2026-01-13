import apiClient from '@/lib/api/client';
import type { AdminUserRow, CreateUserInput, CreateUserResponse } from '@/types/users';

export async function adminGetUsers(search?: string): Promise<AdminUserRow[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);

    const response = await apiClient.get<{ data: AdminUserRow[] }>(`/admin/users?${params.toString()}`);
    return response.data.data;
}

export async function adminCreateUser(payload: CreateUserInput): Promise<CreateUserResponse> {
    const response = await apiClient.post<CreateUserResponse>('/admin/users', payload);
    return response.data;
}

export async function adminToggleUserActive(userId: number, isActive: boolean): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/active`, { IsActive: isActive });
}

export async function adminResendActivation(userId: number): Promise<{ email_sent: boolean; activation_link: string }> {
    const response = await apiClient.post<{ email_sent: boolean; activation_link: string }>(
        `/admin/users/${userId}/resend-activation`
    );
    return response.data;
}
