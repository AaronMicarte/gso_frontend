// API Routes
export const API_ROUTES = {
    LOGIN: '/login',
    LOGOUT: '/logout',
    USER: '/user',
} as const;

// App Routes
export const APP_ROUTES = {
    HOME: '/',
    ADMIN_DASHBOARD: '/admin/dashboard',
    STAFF_DASHBOARD: '/staff/dashboard',
    DEPARTMENT_HEAD_DASHBOARD: '/department_head/dashboard',
} as const;

// Role names from database
export const USER_ROLES = {
    ADMIN: 'Admin',
    GSO_STAFF: 'GSO Staff',
    DEPARTMENT_HEAD: 'Department Head',
    END_USER: 'End User',
    INSPECTION_OFFICER: 'Inspection Officer',
} as const;

// Role IDs from database
export const USER_ROLE_IDS = {
    ADMIN: 1,
    GSO_STAFF: 2,
    PROPERTY_CUSTODIAN: 3,
    DEPARTMENT_HEAD: 4,
    END_USER: 5,
    INSPECTION_OFFICER: 6,
} as const;
