import axios, { AxiosError } from 'axios';

// Helper to get cookie value by name
function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        const cookieValue = parts.pop()?.split(';').shift();
        return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    return null;
}

const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    withCredentials: true,
});

// Request interceptor to add CSRF token
apiClient.interceptors.request.use(
    (config) => {
        const token = getCookie('XSRF-TOKEN');
        if (token) {
            config.headers['X-XSRF-TOKEN'] = token;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data as Record<string, unknown>;

            // automatically refresh CSRF token on 419 and retry once
            if (status === 419) {
                const config = error.config;
                if (config) {
                    // add a temporary __isRetry flag with proper typing
                    const cfg = config as typeof config & { __isRetry?: boolean };
                    if (!cfg.__isRetry) {
                        try {
                            await getCsrfCookie();
                            cfg.__isRetry = true;
                            return apiClient(cfg);
                        } catch (e) {
                            // fall through to regular handling
                        }
                    }
                }

                // if we've already retried or cannot refresh, treat as unauthorized
                if (typeof window !== 'undefined') {
                    window.location.href = '/';
                }
            }

            // Handle lockout (429 Too Many Requests)
            if (status === 429 && data) {
                return Promise.reject({
                    message: data.message,
                    locked: true,
                    seconds_remaining: data.seconds_remaining,
                    contact: data.contact
                });
            }

            // Handle unauthorized (session expired)
            if (status === 401) {
                // Session expired or not authenticated
                // Only redirect if not already on login page
                if (typeof window !== 'undefined' && window.location.pathname !== '/') {
                    window.location.href = '/';
                }
            }

            // Handle activation required / disabled account (login gating)
            if (status === 403 && data) {
                if (data.activation_required === true) {
                    return Promise.reject({
                        message: (data.message as string) || 'Account activation required',
                        activation_required: true,
                    });
                }
                if (data.account_disabled === true) {
                    return Promise.reject({
                        message: (data.message as string) || 'Account is disabled',
                        account_disabled: true,
                    });
                }
            }

            // Handle other errors with attempts remaining
            if (data?.attempts_remaining !== undefined) {
                return Promise.reject({
                    message: data.message,
                    attempts_remaining: data.attempts_remaining
                });
            }

            // Pass through 422 validation errors with full response data
            if (status === 422) {
                if (data?.turnstile_failed === true) {
                    return Promise.reject({
                        message: (data.message as string) || 'Captcha verification failed. Please try again.',
                        turnstile_failed: true,
                    });
                }
                return Promise.reject(error);
            }

            // Preserve original axios error payload for server-side failures so callers
            // can read response.data.message and response.data.error for debugging.
            if (status >= 500) {
                return Promise.reject(error);
            }

            const message = (data?.message as string) || 'An error occurred';
            return Promise.reject(new Error(message));
        } else if (error.request) {
            return Promise.reject(new Error('Network error. Please check your connection.'));
        } else {
            return Promise.reject(new Error('An unexpected error occurred'));
        }
    }
);

// Function to get CSRF cookie from Sanctum (call before login)
export async function getCsrfCookie(): Promise<void> {
    await axios.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/sanctum/csrf-cookie`, {
        withCredentials: true,
    });
}

export default apiClient;
