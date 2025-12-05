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
}

export interface AuthResponse {
  message: string;
  user: User;
  // NOTE: No token - using httpOnly session cookie for security
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