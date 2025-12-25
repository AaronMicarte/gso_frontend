# REAL GSO IAMS PROCUREMENT WORKFLOW
**Implementation Date: December 24, 2025**

## THE BRUTAL TRUTH: HOW REAL GSO WORKS

This document describes the ACTUAL procurement workflow as implemented in this system, matching real-world GSO (General Services Office) operations.

---

## WORKFLOW OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                     REAL GSO PROCUREMENT FLOW                    │
└─────────────────────────────────────────────────────────────────┘

  1. DELIVERY RECEIPT (DR)
     ↓
     Manual entry when items physically arrive
     - Supplier name (manual text entry)
     - PO Number (optional reference - NOT a module)
     - Invoice number (optional)
     - Items delivered (description, type, qty, cost)
     - Received by (GSO Staff)
     - Date received

  2. INSPECTION & ACCEPTANCE REPORT (IAR)
     ↓
     Staff inspects delivered items
     - Links to DR
     - Inspected by (Inspector)
     - Accepted by (Acceptor)
     - For each item:
       * Quantity accepted
       * Quantity rejected
       * Condition (Good/Fair/Poor/etc.)
       * Remarks
     - Date inspected & accepted

  3. INVENTORY
     ↓
     Only ACCEPTED items go to inventory
     - Automatically created from IAR
     - Property numbers assigned
     - QR codes generated
     - Ready for issuance

  4. PAR/ICS ISSUANCE
     ↓
     Distribute to end users
     - PAR for PPE (Property, Plant & Equipment)
     - ICS for Semi-Expendable items
     - Accountability tracking

```

---

## CRITICAL CHANGES FROM BEFORE

### REMOVED:
- ❌ Purchase Request (PR) module
- ❌ Purchase Order (PO) module
- ❌ Job Order (JO) module
- ❌ Supplier pre-selection from database
- ❌ Approval workflows for requisitions

### REALITY NOW:
- ✅ System starts at **Delivery Receipt (DR)**
- ✅ Manual entry of supplier info
- ✅ PO Number is just a text field (optional reference)
- ✅ **IAR is MANDATORY** before items go to inventory
- ✅ Workflow is DR → IAR → Inventory → Issuance
- ✅ **Vehicles and infrastructure property types are excluded from the system** (no motor vehicles, no buildings/infrastructure types)

---

## STEP-BY-STEP: CREATE DELIVERY RECEIPT

**Who:** GSO Staff  
**When:** When items physically arrive from supplier  
**Where:** `/admin/delivery-receipts/new`

### Fields:
1. **Supplier Name** *(Required)*
   - Manual text entry
   - NOT selected from dropdown
   - Example: "ABC Corporation"

2. **PO Number** *(Optional)*
   - Just a reference text field
   - Example: "PO-2025-001"
   - NOT linked to any PO module

3. **Invoice Number** *(Optional)*
   - From supplier's invoice
   - Example: "INV-12345"

4. **Date Received** *(Required)*
   - When items physically arrived
   - Must be in Asia/Manila timezone

5. **Items Delivered** *(At least 1 required)*
   - Item Description (manual text)
   - Property Type (from searchable dropdown — must be selected from master data)
   - Quantity Delivered
   - Unit Cost
   - Total Cost (auto-calculated)

6. **Remarks** *(Optional)*
   - General notes about the delivery

### After Submission:
- DR is saved with auto-generated DR Number (DR-YYYY-####)
- Status: "Pending IAR" (shows in DR list)
- **Next step:** Create IAR immediately

---

## STEP-BY-STEP: CREATE IAR (INSPECTION & ACCEPTANCE)

**Who:** GSO Inspector + Acceptor  
**When:** Immediately after DR is created  
**Where:** Click "Create IAR" button on DR list, or `/admin/delivery-receipts/create-iar?dr_id=X`

### Why This Matters:
In real GSO, you can't just accept items blindly. You must:
- Physically inspect each item
- Check if quantities match
- Verify condition
- Reject damaged/incorrect items
- Document everything

### Fields:
1. **Inspected By** *(Required)*
   - Select user who performed inspection
   - Example: "John Doe"

2. **Accepted By** *(Required)*
   - Select user who accepts items
   - Usually a different person for accountability
   - Example: "Jane Smith"

3. **Date Inspected** *(Required)*
   - When physical inspection happened

4. **Date Accepted** *(Optional)*
   - When items were formally accepted

5. **For Each Item:**
   - **Condition** *(Required)*
     * Good
     * Fair
     * Poor
     * Unserviceable
     * Damaged
   
   - **Quantity Accepted** *(Required)*
     * How many units passed inspection
   
   - **Quantity Rejected** *(Required)*
     * How many units failed inspection
     * Accepted + Rejected MUST = Delivered

   - **Remarks** *(Optional)*
     * Notes about specific item issues

### After Submission:
- IAR is saved with auto-generated IAR Number (IAR-YYYY-####)
- DR status changes to "Inspected"
- **Accepted items** → Ready for inventory
- **Rejected items** → Documented but not added to inventory

---

## DATABASE STRUCTURE

### `deliveryreceipt` Table:
```sql
DRID (Primary Key)
DRNumber (Auto-generated: DR-YYYY-####)
SupplierName (Manual text entry)
PONumber (Optional reference text)
InvoiceNumber (Optional)
ReceivedBy (User ID)
DateReceived (Date)
Remarks (Text)
CreatedDate (Timestamp)
deleted_at (Soft delete)
```

### `deliveryreceiptdetail` Table:
```sql
DRDetailID (Primary Key)
DRID (Foreign Key → deliveryreceipt)
ItemDescription (Text)
PropertyTypeID (Foreign Key → propertytype)
QuantityDelivered (Integer)
UnitCost (Decimal)
TotalCost (Decimal, auto-calculated)
deleted_at (Soft delete)
```

### `inspectionacceptancereport` Table:
```sql
IARID (Primary Key)
IARNumber (Auto-generated: IAR-YYYY-####)
DRID (Foreign Key → deliveryreceipt)
InspectedBy (User ID)
AcceptedBy (User ID)
DateInspected (Date)
DateAccepted (Date, optional)
Remarks (Text)
CreatedDate (Timestamp)
```

### `iardetail` Table:
```sql
IARDetailID (Primary Key)
IARID (Foreign Key → inspectionacceptancereport)
DRDetailID (Foreign Key → deliveryreceiptdetail)
PropertyTypeID (Foreign Key → propertytype)
ConditionID (Foreign Key → condition)
QuantityAccepted (Integer)
QuantityRejected (Integer)
Remarks (Text)
```

---

## API ENDPOINTS

### Delivery Receipts:
- `GET /api/admin/procurement/delivery-receipts` - List all DRs (with IAR status)
- `POST /api/admin/procurement/delivery-receipts` - Create new DR
- `GET /api/admin/procurement/delivery-receipts/{id}` - View DR details
- `PUT /api/admin/procurement/delivery-receipts/{id}` - Update DR
- `DELETE /api/admin/procurement/delivery-receipts/{id}` - Delete DR

### Inspection & Acceptance Reports:
- `GET /api/admin/procurement/inspection-acceptance-reports` - List all IARs
- `POST /api/admin/procurement/inspection-acceptance-reports` - Create new IAR
- `GET /api/admin/procurement/inspection-acceptance-reports/{id}` - View IAR details
- `PUT /api/admin/procurement/inspection-acceptance-reports/{id}` - Update IAR
- `DELETE /api/admin/procurement/inspection-acceptance-reports/{id}` - Delete IAR

### Helper Endpoints:
- `GET /api/admin/procurement/delivery-receipts-helpers/suppliers` - Get all suppliers
- `GET /api/admin/procurement/delivery-receipts-helpers/property-types` - Get all property types
- `GET /api/admin/procurement/inspection-acceptance-reports-helpers/conditions` - Get all conditions
- `GET /api/admin/procurement/inspection-acceptance-reports-helpers/users` - Get all active users

---

## FRONTEND STRUCTURE

### Pages Created:
1. `/admin/delivery-receipts` - DR list with IAR status
2. `/admin/delivery-receipts/new` - Create DR
3. `/admin/delivery-receipts/create-iar?dr_id=X` - Create IAR from DR
4. `/admin/inspection-acceptance-reports` - IAR list

### Components:
- Updated sidebar with "Delivery & Inspection" section
- DR list shows IAR status badges
- "Create IAR" button for DRs without IAR

---

## VALIDATION RULES

### DR Creation:
- Supplier name: Required, max 255 characters
- PO number: Optional, max 50 characters
- Date received: Required, must be valid date
- Items: At least 1 required
- Item description: Required, max 255 characters
- Property type: Required, must exist in database (select via searchable dropdown)
- Quantity: Required, minimum 1
- Unit cost: Required, minimum 0

### IAR Creation:
- DR ID: Required, must exist and not already have IAR
- Inspected by: Required, must be valid user
- Accepted by: Required, must be valid user
- Date inspected: Required, must be valid date
- Items: At least 1 required
- Condition: Required for each item
- Quantity accepted: Required, minimum 0
- Quantity rejected: Required, minimum 0
- **Critical:** Accepted + Rejected MUST equal Delivered quantity

---

## SECURITY & AUDIT

### Authentication:
- All endpoints require `auth:sanctum` middleware
- Session-based authentication with MFA
- Trusted devices support

### Audit Trail:
- CreatedDate automatically set on DR and IAR creation
- User IDs recorded for ReceivedBy, InspectedBy, AcceptedBy
- Soft deletes enabled (deleted_at column)

### Permissions:
- Only GSO Staff can create DRs
- Only authorized inspectors can create IARs
- Role-based access control enforced

---

## WHAT'S NEXT AFTER IAR?

After IAR is created and items are accepted:

1. **Inventory Management**
   - Accepted items → Property Inventory
   - Generate property numbers
   - Assign QR codes
   - Set initial status as "Available"

2. **PAR/ICS Issuance**
   - Issue to end users
   - PAR for PPE (office equipment, furniture)
   - ICS for semi-expendable items

3. **Property Tracking**
   - QR code scanning
   - Physical inventory counts
   - Transfers between departments
   - Maintenance & repairs
   - Disposal workflow

---

## IMPORTANT NOTES

### PO Number Field:
- **NOT** a foreign key
- **NOT** linked to any PO module
- Just a text field for reference
- Optional, can be left blank
- Used for manual record-keeping only

### Workflow Enforcement:
- DRs without IAR show "Pending IAR" badge
- "Create IAR" button prominently displayed
- IAR creation pre-fills DR items
- Cannot create duplicate IAR for same DR

### Data Integrity:
- IAR detail links to DR detail (DRDetailID)
- Quantities validated (accepted + rejected = delivered)
- Condition must be selected from master data
- Timestamps in Asia/Manila timezone

---

## TESTING CHECKLIST

- [ ] Create DR with required fields
- [ ] Create DR with optional PO number
- [ ] Create DR without PO number
- [ ] Verify DR appears with "Pending IAR" status
- [ ] Click "Create IAR" from DR list
- [ ] IAR form pre-fills with DR items
- [ ] Accept some items, reject others
- [ ] Verify quantity validation (accepted + rejected = delivered)
- [ ] Submit IAR
- [ ] Verify DR status changes to "Inspected"
- [ ] View IAR list
- [ ] Verify IAR details show correctly
- [ ] Check that duplicate IAR cannot be created

---

**Last Updated:** December 24, 2025  
**Status:** Production Ready  
**Developer:** 3rd Year BSIT Student (Solo Capstone)  
**Target:** El Salvador City GSO System
