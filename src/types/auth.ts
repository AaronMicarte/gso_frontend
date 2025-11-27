export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  UserID: number;
  Username: string;
  Email: string;
  Role: string;
  Department: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}