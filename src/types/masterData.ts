/**
 * Master Data Types - Categories, Property Types, etc.
 */

// ============================================
// DEPARTMENTS
// ============================================

export interface Department {
    id: number;
    code: string;
    name: string;
    description: string | null;
    created_at: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface DepartmentInput {
    DepartmentCode: string;
    DepartmentName: string;
    Description: string;
}

// ============================================
// CLASSIFICATIONS
// ============================================

export interface Classification {
    id: number;
    name: string;
    category_id: number;
    description?: string | null;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
    // Relations
    category?: {
        id: number;
        name: string;
    };
}

export interface ClassificationInput {
    name: string;
    category_id: number;
    description?: string;
}

// ============================================
// PROPERTY CLASSIFICATIONS
// ============================================

export interface PropertyClassification {
    id: number;
    name: string;
    description?: string | null;
    document_type: 'ICS' | 'PAR';
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface PropertyClassificationInput {
    name: string;
    description?: string;
    document_type: 'ICS' | 'PAR';
}

// ============================================
// PROPERTY TYPES
// ============================================

export interface PropertyType {
    id: number;
    name: string;
    category_id: number;
    classification_id: number;
    property_classification_id: number;
    description?: string | null;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
    // Relations
    category?: {
        id: number;
        name: string;
    };
    classification?: {
        id: number;
        name: string;
    };
    property_classification?: {
        id: number;
        name: string;
        document_type: string;
    };
}

export interface PropertyTypeInput {
    name: string;
    category_id: number;
    classification_id: number;
    property_classification_id: number;
    description?: string;
}

// ============================================
// UNITS OF MEASURE
// ============================================

export interface UnitOfMeasure {
    id: number;
    name: string;
    description?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface UnitOfMeasureInput {
    name: string;
    description?: string;
}

// ============================================
// CONDITIONS
// ============================================

export interface Condition {
    id: number;
    name: string;
    description?: string | null;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface ConditionInput {
    name: string;
    description?: string;
}

// ============================================
// PROPERTY STATUS
// ============================================

export interface PropertyStatus {
    id: number;
    name: string;
    description?: string | null;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface PropertyStatusInput {
    name: string;
    description?: string;
}

// ============================================
// DISPOSAL METHODS
// ============================================

export interface DisposalMethod {
    id: number;
    name: string;
    description?: string | null;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface DisposalMethodInput {
    name: string;
    description?: string;
}

// ============================================
// USER ROLES
// ============================================

export interface UserRole {
    id: number;
    name: string;
    description?: string | null;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface UserRoleInput {
    name: string;
    description?: string;
}

// ============================================
// SUPPLIERS
// ============================================

export interface Supplier {
    id: number;
    name: string;
    address?: string | null;
    contact_person?: string | null;
    contact_number?: string | null;
    email?: string | null;
    tin?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface SupplierInput {
    name: string;
    address?: string;
    contact_person?: string;
    contact_number?: string;
    email?: string;
    tin?: string;
    is_active?: boolean;
}

// ============================================
// POSITIONS
// ============================================

export interface Position {
    id: number;
    name: string;
    description?: string | null;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface PositionInput {
    name: string;
    description?: string;
}

// ============================================
// END USERS
// ============================================

export interface EndUser {
    id: number;
    full_name: string;
    department_id: number;
    position_id: number;
    contact_number?: string | null;
    email?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
    // Relations
    department?: {
        id: number;
        name: string;
    };
    position?: {
        id: number;
        name: string;
    };
}

export interface EndUserInput {
    full_name: string;
    department_id: number;
    position_id: number;
    contact_number?: string;
    email?: string;
    is_active?: boolean;
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
    data: T[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number;
    to: number;
    prev_page_url?: string;
    next_page_url?: string;
}

// ============================================
// CATEGORIES (Property)
// ============================================

export interface Category {
    id: number;
    name: string;
    description?: string | null;
    created_at: string;
    updated_at?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

export interface CategoryInput {
    name: string;
    description?: string;
}
