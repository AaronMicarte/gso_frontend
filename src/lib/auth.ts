import apiClient from '@/lib/api/client';
import { LoginCredentials, AuthResponse, User } from '@/types/auth';

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/login', credentials);
  return response.data;
}

export async function getUser(): Promise<User> {
  const response = await apiClient.get<{ user: User }>('/user');
  return response.data.user;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/logout');
  } catch (error) {
    // Logout locally even if API call fails
    throw error;
  }
}

export function setToken(token: string) {
  localStorage.setItem('auth_token', token);
}

export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function removeToken() {
  localStorage.removeItem('auth_token');
}