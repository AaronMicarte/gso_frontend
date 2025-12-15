export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  UserID: number;
  Username: string;
  Email: string;
  FullName: string;
  Role: string;
  Department: string;
  DepartmentID: number;
  department?: {
    DepartmentID: number;
    DepartmentName: string;
  };
}

export interface AuthResponse {
  message: string;
  mfa_required?: boolean;
  mfa_setup_required?: boolean;
  user_id?: number;
  user: User;
  // NOTE: No token - using httpOnly session cookie for security
}

// MFA pending response (when MFA is required but not yet verified)
export interface MFAPendingResponse {
  message: string;
  mfa_required: true;
  user_id: number;
  user: {
    UserID: number;
    Username: string;
    FullName: string;
  };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface LockoutError {
  message: string;
  locked: boolean;
  seconds_remaining: number;
  contact: string;
}

export interface LoginError {
  message: string;
  locked?: boolean;
  seconds_remaining?: number;
  contact?: string;
  attempts_remaining?: number;
}