/**
 * Master Data Types - Categories, Property Types, etc.
 */

// ============================================
// CATEGORIES
// ============================================

export interface Category {
    CategoryID: number;
    CategoryName: string;
    Description?: string;
    CreatedDate: string;
    UpdatedDate?: string;
}

export interface CategoryInput {
    CategoryName: string;
    Description?: string;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        total: number;
        per_page: number;
        current_page: number;
        last_page: number;
        from: number;
        to: number;
    };
}
