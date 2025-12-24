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

## RECENT CRITICAL FIXES
- **DASHBOARD:** Fixed 500 errors by removing PR/JO table references.
- **DATABASE:** Added `deleted_at` to `deliveryreceipt` tables to support SoftDeletes.
- **TYPES:** Updated `DashboardStats` to reflect the new simplified workflow.

## TECH STACK
- **Frontend:** Next.js, Tailwind CSS, Lucide Icons, Sonner, Radix UI.
- **Backend:** Laravel 12, Sanctum (Session-based Auth), MySQL.
- **Auth:** MFA (Google Authenticator) + Trusted Devices.

---
**BRUTAL HONESTY:** If the code is messy, fix it. If the workflow is wrong, change it. No excuses.
**DEVELOPER:** 3rd Year BSIT Student (Solo Capstone)
**TARGET:** El Salvador City GSO System