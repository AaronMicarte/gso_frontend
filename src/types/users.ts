export interface AdminUserRow {
    UserID: number;
    Username: string;
    Email: string;
    FullName: string | null;
    IsActive: boolean;
    MustChangePassword?: boolean;
    EmailVerifiedAt: string | null;
    MFAEnabled: boolean;
    UserRoleID: number;
    Role: string | null;
    DepartmentID: number;
    Department: string | null;
    CreatedDate: string | null;
    UpdatedDate: string | null;
}

export interface CreateUserInput {
    Username: string;
    Email: string;
    FullName?: string;
    UserRoleID: number;
    DepartmentID: number;
}

export interface CreateUserResponse {
    message: string;
    email_sent: boolean;
    activation_link: string;
    user: {
        UserID: number;
        Username: string;
        Email: string;
        FullName: string | null;
        IsActive: boolean;
        EmailVerifiedAt: string | null;
        MFAEnabled: boolean;
        UserRoleID: number;
        DepartmentID: number;
    };
}

export interface UpdateUserInput {
    Username: string;
    Email: string;
    FullName?: string;
    UserRoleID: number;
    DepartmentID: number;
    IsActive: boolean;
    ResetPasswordToDefault?: boolean;
}

export interface UpdateUserResponse {
    message: string;
    password_reset_required: boolean;
    mfa_reset_required: boolean;
    user: {
        UserID: number;
        Username: string;
        Email: string;
        FullName: string | null;
        IsActive: boolean;
        MFAEnabled: boolean;
        UserRoleID: number;
        DepartmentID: number;
    };
}

export interface ActivationRequiredError {
    message: string;
    activation_required: true;
}

export interface AccountDisabledError {
    message: string;
    account_disabled: true;
}
