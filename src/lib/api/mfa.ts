/**
 * MFA API Client
 * Production-ready API functions for MFA operations
 */

import apiClient from './client';
import {
    MFAStatus,
    MFASecretResponse,
    MFAEnableResponse,
    MFAVerifyRequest,
    MFAVerifySuccessResponse,
    MFADisableRequest,
    TrustedDevicesResponse,
    RevokeDeviceRequest,
} from '@/types/mfa';

/**
 * Get current MFA status for the authenticated user.
 */
export async function getMFAStatus(): Promise<MFAStatus> {
    const response = await apiClient.get<MFAStatus>('/mfa/status');
    return response.data;
}

/**
 * Generate a new TOTP secret and QR code for MFA setup.
 */
export async function generateMFASecret(): Promise<MFASecretResponse> {
    const response = await apiClient.post<MFASecretResponse>('/mfa/generate-secret');
    return response.data;
}

/**
 * Generate MFA secret during login flow (for roles that require MFA setup).
 * This is a PUBLIC endpoint - no authentication required.
 */
export async function generateMFASecretForLogin(userId: number): Promise<MFASecretResponse> {
    const response = await apiClient.post<MFASecretResponse>('../mfa/setup/generate', {
        user_id: userId,
    });
    return response.data;
}

/**
 * Enable MFA with verified code.
 */
export async function enableMFA(secret: string, code: string): Promise<MFAEnableResponse> {
    const response = await apiClient.post<MFAEnableResponse>('/mfa/enable', {
        secret,
        code,
    });
    return response.data;
}

/**
 * Enable MFA during login flow (for roles that require MFA setup).
 * This is a PUBLIC endpoint - no authentication required.
 */
export async function enableMFADuringLogin(
    userId: number,
    secret: string,
    code: string
): Promise<MFAEnableResponse> {
    const response = await apiClient.post<MFAEnableResponse>('../mfa/setup/enable', {
        user_id: userId,
        secret,
        code,
    });
    return response.data;
}

/**
 * Disable MFA (requires password and code confirmation).
 */
export async function disableMFA(data: MFADisableRequest): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/mfa/disable', data);
    return response.data;
}

/**
 * Verify MFA code during login (public endpoint).
 */
export async function verifyMFACode(data: MFAVerifyRequest): Promise<MFAVerifySuccessResponse> {
    const response = await apiClient.post<MFAVerifySuccessResponse>('../mfa/verify', data);
    return response.data;
}

/**
 * Get list of trusted devices for the authenticated user.
 */
export async function getTrustedDevices(): Promise<TrustedDevicesResponse> {
    const response = await apiClient.get<TrustedDevicesResponse>('/mfa/trusted-devices');
    return response.data;
}

/**
 * Revoke a specific trusted device.
 */
export async function revokeTrustedDevice(deviceId: number): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/mfa/revoke-device', {
        device_id: deviceId,
    } as RevokeDeviceRequest);
    return response.data;
}
