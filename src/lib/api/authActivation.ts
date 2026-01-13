import apiClient, { getCsrfCookie } from '@/lib/api/client';

export interface ActivateAccountResponse {
    message: string;
    user_id: number;
    mfa_setup_required: boolean;
    mfa_enabled: boolean;
}

export async function activateAccount(payload: {
    token: string;
    password: string;
    password_confirmation: string;
}): Promise<ActivateAccountResponse> {
    // Keep consistent with other auth flows (Sanctum expects CSRF cookie for stateful requests)
    await getCsrfCookie();

    const response = await apiClient.post<ActivateAccountResponse>('/auth/activate-account', payload);
    return response.data;
}
