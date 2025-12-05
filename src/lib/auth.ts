import apiClient, { getCsrfCookie } from '@/lib/api/client';
import { LoginCredentials, AuthResponse, User } from '@/types/auth';

/**
 * Login using session-based authentication
 * Session is stored as httpOnly cookie (can't be accessed by JavaScript = XSS safe)
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  // Get CSRF cookie first (required by Sanctum for SPA auth)
  await getCsrfCookie();

  const response = await apiClient.post<AuthResponse>('/login', credentials);
  return response.data;
}

/**
 * Get current authenticated user from session
 */
export async function getUser(): Promise<User> {
  const response = await apiClient.get<{ user: User }>('/user');
  return response.data.user;
}

/**
 * Logout and invalidate session
 */
export async function logout(): Promise<void> {
  await apiClient.post('/logout');
}

/**
 * Check if user is authenticated by trying to get user data
 * Returns true if session is valid, false otherwise
 */
export async function checkAuth(): Promise<boolean> {
  try {
    await getUser();
    return true;
  } catch {
    return false;
  }
}