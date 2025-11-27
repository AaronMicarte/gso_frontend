// API Routes
export const API_ROUTES = {
    LOGIN: '/login',
    LOGOUT: '/logout',
    USER: '/user',
} as const;

// App Routes
export const APP_ROUTES = {
    HOME: '/',
    DASHBOARD: '/dashboard',
} as const;

// Token key for localStorage
export const AUTH_TOKEN_KEY = 'auth_token';
