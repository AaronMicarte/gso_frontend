import apiClient, { getCsrfCookie } from '@/lib/api/client';
import { ChangeTemporaryPasswordPayload, LoginCredentials, AuthResponse, User } from '@/types/auth';

/**
 * Login using session-based authentication
 * Session is stored as httpOnly cookie (can't be accessed by JavaScript = XSS safe)
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  // Get CSRF cookie first (required by Sanctum for SPA auth)
  try {
    await getCsrfCookie();
  } catch (err) {
    console.warn('Pre-fetch CSRF cookie warning:', err);
  }

  const response = await apiClient.post<AuthResponse>('../login', credentials);
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

export async function changeTemporaryPassword(payload: ChangeTemporaryPasswordPayload): Promise<{ message: string; user_id?: number; username?: string }> {
  try {
    await getCsrfCookie();
  } catch (err) {
    console.warn('Pre-fetch CSRF cookie warning:', err);
  }
  const response = await apiClient.post<{ message: string; user_id?: number; username?: string }>('../auth/change-temporary-password', payload);
  return response.data;
}

/**
 * Get dashboard or preferred default landing route based on user role and saved preferences
 */
export function getDashboardRoute(role?: string, userRoleID?: number, userId?: number): string {
  // Check if user has a custom landing page preference saved in localStorage
  if (typeof window !== 'undefined') {
    try {
      const targetUserId = userId || (function () {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('gso_settings_v1_')) {
            return k.replace('gso_settings_v1_', '');
          }
        }
        return null;
      })();

      if (targetUserId) {
        const raw = localStorage.getItem(`gso_settings_v1_${targetUserId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.defaultLandingRoute && typeof parsed.defaultLandingRoute === 'string' && parsed.defaultLandingRoute.trim() !== '') {
            let landingRoute = parsed.defaultLandingRoute.trim();
            if (landingRoute === '/admin/inventory/all-items') {
              landingRoute = '/admin/inventory';
              try {
                parsed.defaultLandingRoute = landingRoute;
                localStorage.setItem(`gso_settings_v1_${targetUserId}`, JSON.stringify(parsed));
              } catch {}
            }
            const expectedPrefix = userRoleID === 1 || role === 'Admin'
              ? '/admin'
              : userRoleID === 2 || role === 'GSO Staff'
              ? '/staff'
              : userRoleID === 4 || role === 'Department Head'
              ? '/department_head'
              : '';

            if (!expectedPrefix || landingRoute.startsWith(expectedPrefix)) {
              return landingRoute;
            }
          }
        }
      }
    } catch {
      // Fallback on JSON parse error
    }
  }

  if (userRoleID === 1) return '/admin/dashboard'; // Admin
  if (userRoleID === 2) return '/staff/dashboard'; // GSO Staff
  if (userRoleID === 4) return '/department_head/dashboard'; // Department Head

  // Fallback to role name if UserRoleID not available
  if (role === 'Admin') return '/admin/dashboard';
  if (role === 'GSO Staff') return '/staff/dashboard';
  if (role === 'Department Head') return '/department_head/dashboard';

  return '/admin/dashboard'; // Default fallback
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