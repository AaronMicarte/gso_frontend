# GSO Asset Request and Issuance Workflow (2026)

## 1. Asset Request Phase (Department Head/Staff)

- **Purpose:** Allow departments to request assets/items needed for operations.
- **Form Structure:**
  - **Request Header:**
    - Requesting Department (auto-filled or selectable)
    - Requested By (name of requester)
    - Date of Request (auto-filled, PH time)
    - Purpose/Justification (text)
  - **Request Items (Table/List):**
    - Item Description (text)
    - Quantity (number)
    - Intended End User (text, optional but recommended)
      - Tooltip: _“If the item is for a specific person, enter their name. If for the whole department, enter the department name or leave blank.”_
    - Additional Notes (optional)

- **User Guidance:**
  - At the top of the form, display a note:
    > **Note:** “GSO will determine if each item is for individual (PAR) or department (ICS) accountability. Please specify the intended end user if known. This helps ensure correct assignment and audit compliance.”

- **Submission:**
  - All required fields must be filled.
  - After submission, the request appears in the admin UI for review.

---

## 2. Admin Review & Processing Phase (GSO Staff)

- **Purpose:** Review, validate, and structure asset requests for inventory and issuance.
- **Admin UI:**
  - List of pending asset requests with status (New, In Review, Approved, Rejected, Completed)
  - For each request, admin can:
    - View all request details
    - For each item:
      - Confirm/Correct Item Description
      - Confirm/Correct Quantity
      - Assign Property Classification (ICS or PAR)
        - System should auto-suggest based on item type/value, but allow override
      - Assign Official End User:
        - If ICS: assign to department
        - If PAR: assign to individual
      - Fill all required database fields (brand, model, serial, etc. as needed)
      - Add remarks if needed
    - Approve or reject items individually or in bulk

- **Database Actions:**
  - On approval, create structured records in:
    - `assetrequest` (header)
    - `assetrequestdetail` (per item, with all required fields)
  - When items are issued:
    - Create records in `propertyissuance` (header)
    - Create records in `propertyissuancedetail` (per item, with end user, classification, etc.)

---

## 3. Issuance & Accountability

- **Issuance:**
  - GSO issues items based on approved requests.
  - For ICS: Issue to department (Inventory Custodian Slip)
  - For PAR: Issue to individual (Property Acknowledgement Receipt)
  - All required fields in `propertyissuance` and `propertyissuancedetail` must be filled (including end user, item details, accountability type, etc.)

- **Audit Trail:**
  - All actions (request, review, approval, issuance) are logged for traceability.

---

## 4. User Experience & Compliance

- **Frontend:**
  - Request form is simple for users, but captures intended end user if known.
  - Admin UI is structured, enforces all required fields, and guides GSO staff through correct workflow.
  - Tooltips and notes explain ICS/PAR and end user fields.

- **Backend/Database:**
  - All required fields for asset tracking, accountability, and audit are filled at the admin processing stage.
  - No asset is added to inventory or issued without complete, structured data.

---

## 5. Additional Notes

- If the department head does not specify an end user, GSO must clarify before issuance.
- The system should prevent issuance if required fields are missing.
- All dates/times must use Asia/Manila timezone.
- All actions must be secure, validated, and auditable.
- This workflow matches real GSO practice and is ready for production and audit.

---

**If you add new asset types or workflows, update this document and database accordingly.**

---

**Author:** AI-generated for El Salvador City GSO System, 2026
