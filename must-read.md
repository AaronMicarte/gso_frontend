# GSO IAMS - CRITICAL PROJECT GUIDELINES
**STRICT ADHERENCE REQUIRED**

PHP IS ON C:\xampp\php\php.exe

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
4. **NO REQUEST/RIS FOR ISSUANCE:** Asset Request + RIS are not part of issuance. Issuance is based on DR Requested By + Department.
5. **INVENTORY:** Begins immediately upon DR recording and IAR acceptance.
6. **FOCUS:** DR Management, IAR, Inventory, PAR/ICS Issuance, QR Tracking, Reporting, Disposal.

NOTE: Vehicles and infrastructure property types (motor vehicles, buildings/structures) are excluded from this implementation to match local GSO scope and simplify workflows.

## RECENT CRITICAL FIXES
- **DASHBOARD:** Fixed 500 errors by removing PR/JO table references.
- **DASHBOARD (ADMIN/STAFF):** No request counters. Use inventory status counts from DB (For issuance, Issued) plus DR totals.
- **DATABASE:** Added `deleted_at` to `deliveryreceipt` tables to support SoftDeletes.
- **TYPES:** Updated `DashboardStats` to reflect the new simplified workflow.
- **ISSUANCE UI:** On successful issuance submission, show a simple Sonner success toast like **"Issuance created"**.
- **DR FORM:** Added optional Brand / Model / SN fields for line items; serial numbers require quantities=1 on both frontend and backend.
- **IAR AUTO-CREATION:** Delivery receipts now auto-generate an IAR record when saved so issuance workflows always have a reference number.

## TECH STACK
- **Frontend:** Next.js, Tailwind CSS, Lucide Icons, Sonner, Radix UI.
- **Backend:** Laravel 12, Sanctum (Session-based Auth), MySQL.
- **Auth:** MFA (Google Authenticator) + Trusted Devices.

## CONFIG
- **Backdate window:** Delivery Receipt backdate window is configurable via env var `GSO_DR_BACKDATE_YEARS` (defaults to `5`).

- **Delivery Receipt Number:** The DR number must be entered manually by staff when creating a Delivery Receipt. The system will not auto-generate DR numbers; ensure your DR numbers are unique and follow your local numbering policy.
- **Invoice number uniqueness:** Invoice numbers are enforced unique per supplier (to prevent duplicate billing records).
- **PO number uniqueness:** PO numbers are now enforced unique per supplier as well (prevents creating multiple DRs that reuse the same PO+Supplier combination). If your workflow requires multiple DRs per PO, tell me and I can revert this and instead add an alternate validation policy (e.g., enforce uniqueness only for non-null POs or provide admin override).

## STORAGE (SIGNATURES)
- For development, the app uses the **local `public` disk** by default (`FILESYSTEM_DRIVER=public`). This keeps setup simple for capstone work.
- For production, configure `FILESYSTEM_DRIVER=s3` and provide AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET`). The app stores the disk name on each signature record so it is auditable.
- Use `php artisan storage:verify` to verify the configured storage is writable/readable. Consider enabling `FILESYSTEM_STRICT_S3=true` in production to fail fast if `FILESYSTEM_DRIVER` is not `s3`.
- Signatures are stored as canonical PNGs; the system will serve temporary signed URLs for private buckets when available.
- UX rule: **Inspected By** requires a signature when creating an IAR (canvas draw is primary). **Accepted By** signature is **required** during acceptance; the accept action will prompt for an acceptance signature and will not complete without it.


---
**BRUTAL HONESTY:** If the code is messy, fix it. If the workflow is wrong, change it. No excuses.
**DEVELOPER:** 3rd Year BSIT Student (Solo Capstone)
**TARGET:** El Salvador City GSO System
**TITLE:** Web-Based Asset and Inventory Management System with QR Code Tracking and Automated Reporting for the General Services Office (GSO) of El Salvador City Hall

PLEASE DONT TOUCH THE OLD ADMIN FOLDER