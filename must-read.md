# GSO IAMS - CRITICAL PROJECT GUIDELINES
**STRICT ADHERENCE REQUIRED**

## CORE PRINCIPLES
- **REAL-WORLD ACCURACY:** Follow real GSO IAMS workflows. No shortcuts.
- **TYPESCRIPT ONLY:** Zero 'any' types. Use proper interfaces.
- **PRODUCTION READY:** No `console.log`. Proper error handling. Loading states everywhere.
- **SECURITY:** XSS/CORS protection. Token validation. Input sanitization (FE+BE).
- **CONSISTENCY:** Same coding style, same loading screens, same UI patterns.
- **FEEDBACK:** Use **Sonner** for all success/error messages. Use **Radix UI** for modals.
- **TIMEZONE:** All dates must be **Asia/Manila (PH Time)**.

## PROJECT SCOPE (UPDATED DEC 23, 2025)
**PROCUREMENT REMOVED. WORKFLOW SIMPLIFIED.**

1. **START POINT:** System begins at **Delivery Receipt (DR)**.
2. **NO PR/PO/JO:** All Purchase Request, Purchase Order, and Job Order modules are GONE.
3. **MANUAL ENTRY:** GSO staff enter DR info manually (Supplier/PO # are text fields).
4. **INVENTORY:** Begins immediately upon DR recording.
5. **FOCUS:** DR Management, Inventory, PAR/ICS Issuance, QR Tracking, Reporting, Disposal.

NOTE: Vehicles and infrastructure property types (motor vehicles, buildings/structures) are excluded from this implementation to match local GSO scope and simplify workflows.

## RECENT CRITICAL FIXES
- **DASHBOARD:** Fixed 500 errors by removing PR/JO table references.
- **DATABASE:** Added `deleted_at` to `deliveryreceipt` tables to support SoftDeletes.
- **TYPES:** Updated `DashboardStats` to reflect the new simplified workflow.

## TECH STACK
- **Frontend:** Next.js, Tailwind CSS, Lucide Icons, Sonner, Radix UI.
- **Backend:** Laravel 12, Sanctum (Session-based Auth), MySQL.
- **Auth:** MFA (Google Authenticator) + Trusted Devices.

## CONFIG
- **Backdate window:** Delivery Receipt backdate window is configurable via env var `GSO_DR_BACKDATE_YEARS` (defaults to `5`). Admins can override per-request with `override_past_limit` when authorized.

- **Delivery Receipt Number:** The DR number must be entered manually by staff when creating a Delivery Receipt. The system will not auto-generate DR numbers; ensure your DR numbers are unique and follow your local numbering policy.

---
**BRUTAL HONESTY:** If the code is messy, fix it. If the workflow is wrong, change it. No excuses.
**DEVELOPER:** 3rd Year BSIT Student (Solo Capstone)
**TARGET:** El Salvador City GSO System