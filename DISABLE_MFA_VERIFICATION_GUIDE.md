# Disabling and Re-enabling MFA Verification: Developer Documentation

## Overview
This document explains the changes made to temporarily disable MFA (Multi-Factor Authentication) verification in both the backend and frontend. It also provides clear steps to revert these changes and re-enable MFA verification when needed.

---

## 1. Backend Changes

### Files Modified
- backend/app/Http/Controllers/AuthController.php
- backend/.env (or your environment variable management)

### What Was Changed
- **MFA verification logic was bypassed** in the login/authentication flow.
- A local/testing bypass was added using an environment variable (e.g., `MFA_BYPASS_FOR_TESTING`).
- If this variable is set to `true`, MFA code entry and verification are skipped for all users.

#### Example Code (in AuthController.php):
```php
if (env('MFA_BYPASS_FOR_TESTING', false)) {
    // Bypass MFA verification for local/testing
    // ...existing code...
}
```

### How to Re-enable MFA Verification
1. **Unset or set `MFA_BYPASS_FOR_TESTING` to `false`** in your `.env` file:
   ```env
   MFA_BYPASS_FOR_TESTING=false
   ```
2. **Remove or comment out the bypass logic** in `AuthController.php` if you want to enforce MFA for all users again.
3. **Restart the backend server** to apply changes.

---

## 2. Frontend Changes

### Files Modified
- src/app/(authenticated)/*/layout.tsx
- src/components/features/users/AdminUsersListPage.tsx
- src/lib/api/admin/users.ts

### What Was Changed
- **Removed forced redirects** to `/setup-mfa` in all authenticated layouts.
- **UI and API logic**: The admin user management page now allows toggling MFA, but verification is globally bypassed if the backend bypass is enabled.

### How to Re-enable MFA Verification
1. **Restore forced redirects** to `/setup-mfa` in the relevant layout files if you want to require users to set up MFA.
2. **Ensure the backend is not bypassing MFA** (see backend section above).
3. **Test the login and user management flows** to confirm MFA is enforced.

---

## 3. Environment Variable Toggle
- The main switch for enabling/disabling MFA verification is the `MFA_BYPASS_FOR_TESTING` variable in the backend `.env` file.
- Set to `true` to disable MFA verification (for local/testing only).
- Set to `false` (or remove) to re-enable MFA verification.

---

## 4. Summary Table
| Area      | File(s) Affected                                      | Action to Re-enable MFA           |
|-----------|------------------------------------------------------|-----------------------------------|
| Backend   | AuthController.php, .env                             | Remove bypass, set env to false   |
| Frontend  | (authenticated)/*/layout.tsx, AdminUsersListPage.tsx | Restore redirects if needed       |

---

## 5. Additional Notes
- Always restart both backend and frontend servers after changing environment variables or authentication logic.
- Test thoroughly after re-enabling MFA to ensure the flow works as expected.
- If you have questions, refer to commit history for exact code changes.

---

**Last updated:** February 18, 2026
