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
    CUSTODIAN_DASHBOARD: '/custodian/dashboard',
} as const;

// Role names from database
export const USER_ROLES = {
    ADMIN: 'Admin',
    GSO_STAFF: 'GSO Staff',
    PROPERTY_CUSTODIAN: 'Property Custodian',
    DEPARTMENT_HEAD: 'Department Head',
    END_USER: 'End User',
} as const;
