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
    (error: AxiosError) => {
        if (error.response) {
            const data = error.response.data as Record<string, unknown>;

            // Handle lockout (429 Too Many Requests)
            if (error.response.status === 429 && data) {
                return Promise.reject({
                    message: data.message,
                    locked: true,
                    seconds_remaining: data.seconds_remaining,
                    contact: data.contact
                });
            }

            // Handle unauthorized (session expired)
            if (error.response.status === 401) {
                // Session expired or not authenticated
                // Only redirect if not already on login page
                if (typeof window !== 'undefined' && window.location.pathname !== '/') {
                    window.location.href = '/';
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
            if (error.response.status === 422) {
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
