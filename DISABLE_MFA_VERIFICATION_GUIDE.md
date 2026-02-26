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
   The backend now defaults to `false` so MFA is enforced unless you explicitly
   enable the variable while running in `local` environment. For a hard‑stop
   you may remove the bypass block entirely from `AuthController::login`.
2. **Restore MFA logic that was temporarily removed**:
   - The login action will now check whether the user’s role requires MFA.
     If the user hasn’t enabled MFA yet, the response will include both
     `mfa_required: true` and `mfa_setup_required: true`, causing the SPA to
     redirect the user to `/setup-mfa`.
   - Account activation also returns `mfa_setup_required` for roles that must
     configure MFA before their first login.
   These changes are already applied in the current code; see the new
   comments around the `mfaRequiredRoles` array for details.
3. **Re-add frontend redirects** to the authenticated layout files so that a
   logged‑in user who still needs to configure MFA gets bounced to the setup
   page even if they navigate manually.  Each `(authenticated)` layout now
   contains a check against the same `mfaRequiredRoles` list.
4. **Restart the backend server** to apply changes and rebuild/install the
   frontend if you modified any client files.

---

## 5. Additional Notes
- The MFA management UI (`MFASetup.tsx`) has been restored with working API
  calls.  Users can generate secrets, verify codes, view backup codes, and
  disable MFA from their security settings page.
- Trusted device support remains intact; users who checked “Trust this device”
  during verification will see entries under **Security → Trusted Devices**.
- After re‑enabling MFA, test both the login flow and account activation with
  a role that requires MFA (e.g. Admin, GSO Staff) to confirm redirections and
  responses work as expected.

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
