/**
 * MFA (Multi-Factor Authentication) TypeScript types
 * Production-ready, no 'any' types
 */

// MFA Status Response
export interface MFAStatus {
    mfa_enabled: boolean;
    has_backup_codes: boolean;
    trusted_devices_count: number;
}

// MFA Secret Generation Response
export interface MFASecretResponse {
    secret: string;
    qr_code_url: string;
    message: string;
}

// MFA Enable Response
export interface MFAEnableResponse {
    message: string;
    backup_codes: string[];
    warning: string;
}

// MFA Verify Request
export interface MFAVerifyRequest {
    user_id: number;
    code: string;
    trust_device?: boolean;
    device_name?: string;
}

// MFA Disable Request
export interface MFADisableRequest {
    password: string;
    code: string;
}

// Trusted Device
export interface TrustedDevice {
    device_id: number;
    device_name: string | null;
    ip_address: string | null;
    created_at: string;
    expires_at: string;
    last_used_at: string | null;
}

// Trusted Devices Response
export interface TrustedDevicesResponse {
    devices: TrustedDevice[];
}

// MFA Login Response (when MFA is required)
export interface MFALoginResponse {
    message: string;
    mfa_required: boolean;
    user_id?: number;
    user?: {
        UserID: number;
        Username: string;
        FullName: string;
    };
}

// MFA Verification Success Response
export interface MFAVerifySuccessResponse {
    message: string;
    user: {
        UserID: number;
        Username: string;
        Email: string;
        FullName: string;
        Role: string;
        Department: string;
    };
    warning?: string;
    device_token?: string;
}

// MFA Error Response
export interface MFAErrorResponse {
    error?: string;
    message?: string;
}

// Revoke Device Request
export interface RevokeDeviceRequest {
    device_id: number;
}
