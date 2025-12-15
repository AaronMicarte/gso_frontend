export interface ApiError extends Error {
    response?: {
        data?: {
            message?: string;
            errors?: Record<string, string[]>;
        };
        status?: number;
    };
}
