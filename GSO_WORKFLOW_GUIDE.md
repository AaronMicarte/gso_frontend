# 🔄 REAL GSO WORKFLOW - Philippine Government Standards

**For: El Salvador City GSO IAMS**  
**Student Developer Reference**

---

## 📊 COMPLETE WORKFLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────┐
│ PHASE 1: PROCUREMENT (Buying New Items)                │
└─────────────────────────────────────────────────────────┘
    1. Department requests items
       ↓
    2. Create PURCHASE REQUEST (PR)
       ↓
    3. Admin approves PR
       ↓
    4. Create PURCHASE ORDER (PO) → Send to supplier
       ↓
    5. Supplier delivers items
       ↓
    6. Record DELIVERY RECEIPT (DR)
       ↓
    7. GSO inspects items → INSPECTION & ACCEPTANCE REPORT (IAR)
       ↓
    8. Items officially received
       ↓

┌─────────────────────────────────────────────────────────┐
│ PHASE 2: INVENTORY (Recording What You Have)           │
└─────────────────────────────────────────────────────────┘
    9. Add to PROPERTY INVENTORY
       ↓
    10. Classify property:
        - Semi-Expendable (< ₱15,000, shorter lifespan)
        - PPE/Non-Expendable (≥ ₱15,000, longer lifespan)
       ↓
    11. Generate unique PROPERTY CODE
       ↓
    12. Generate QR CODE for property
       ↓

┌─────────────────────────────────────────────────────────┐
│ PHASE 3: DISTRIBUTION (Getting to End Users)           │
└─────────────────────────────────────────────────────────┘
    13. Create PROPERTY ISSUANCE → Issue to department
       ↓
    14. Assign to specific end user → PROPERTY ASSIGNMENT
       ↓
    15. Generate accountability document:
        - If PPE → Generate PAR (Property Acknowledgment Receipt)
        - If Semi-Expendable → Generate ICS (Inventory Custodian Slip)
       ↓
    16. End user signs PAR/ICS
       ↓

┌─────────────────────────────────────────────────────────┐
│ PHASE 4: MONITORING (Tracking & Verification)          │
└─────────────────────────────────────────────────────────┘
    17. Regular PHYSICAL COUNT sessions
        - Scan QR codes
        - Verify location
        - Check condition
       ↓
    18. If needs repair → Create JOB ORDER
       ↓
    19. If transferring → Create PROPERTY TRANSFER
       ↓

┌─────────────────────────────────────────────────────────┐
│ PHASE 5: DISPOSAL (End of Property Life)               │
└─────────────────────────────────────────────────────────┘
    20. Property becomes unserviceable
       ↓
    21. Create IIRUP (Inspection of Unserviceable Property)
        - Committee inspects
        - Recommends: Repair, Transfer, or Disposal
       ↓
    22. If disposal approved → Create PROPERTY DISPOSAL
       ↓
    23. Record disposal method:
        - Public Auction
        - Donation
        - Destruction
        - Transfer to COA
       ↓
    24. Generate WASTE MATERIAL REPORT
       ↓
    25. Property status → DISPOSED
```

---

## 🎯 DETAILED MODULE BREAKDOWN

### **1. PROCUREMENT WORKFLOW**

#### **1.1 Purchase Request (PR)**
**Who:** Department staff or Admin  
**When:** Need to buy new items  
**Purpose:** Formal request to purchase items

**Process:**
1. Select items needed
2. Specify quantity, unit, estimated cost
3. State purpose/justification
4. Submit for approval
5. Admin reviews and approves/rejects
6. If approved → Proceed to PO

**Database Tables:**
- `purchaserequest`
- `purchaserequestdetail`
- `purchaserequeststatus`

**Key Fields:**
- PR Number (auto-generated)
- Request Date
- Department
- Purpose
- Status: Pending → Approved → Completed

---

#### **1.2 Purchase Order (PO)**
**Who:** Admin/Procurement Officer  
**When:** After PR approval  
**Purpose:** Official order to supplier

**Process:**
1. Select approved PR
2. Choose supplier
3. Confirm items, quantities, costs
4. Generate PO number
5. Send PO to supplier
6. Track delivery status

**Database Tables:**
- `purchaseorder`
- `purchaseorderdetail`
- `purchaseorderstatus`

**Key Fields:**
- PO Number (auto-generated)
- Link to PR
- Supplier info
- Delivery date
- Total amount
- Status: Pending → Partially Delivered → Fully Delivered

---

#### **1.3 Delivery Receipt (DR)**
**Who:** GSO Staff receiving items  
**When:** Supplier delivers items  
**Purpose:** Acknowledge delivery

**Process:**
1. Supplier arrives with items
2. Count items delivered
3. Record in DR
4. Compare with PO
5. Note any discrepancies
6. Supplier signs, receiver signs

**Database Tables:**
- `deliveryreceipt`
- `deliveryreceiptdetail`

**Key Fields:**
- DR Number (auto-generated)
- Link to PO
- Delivery date
- Quantity delivered
- Received by (user)

---

#### **1.4 Inspection & Acceptance Report (IAR)**
**Who:** GSO Inspector/Committee  
**When:** After delivery  
**Purpose:** Verify items meet specifications

**Process:**
1. Inspect delivered items
2. Check quality, condition
3. Verify against PO specifications
4. Accept or reject items
5. Record in IAR
6. If accepted → Add to inventory

**Database Tables:**
- `inspectionacceptancereport`
- `iardetail`

**Key Fields:**
- IAR Number (auto-generated)
- Link to DR
- Inspection date
- Inspected by
- Accepted by
- Quantity accepted
- Condition

**THIS IS CRITICAL:** IAR is required by COA (Commission on Audit)

---

### **2. INVENTORY MANAGEMENT**

#### **2.1 Property Inventory**
**Who:** GSO Staff  
**When:** After IAR acceptance  
**Purpose:** Official record of all properties

**Process:**
1. Create property record from IAR
2. Generate property code (unique ID)
3. Record:
   - Description
   - Quantity
   - Unit cost
   - Total cost
   - Acquisition date
   - Classification
   - Status
4. Link to property type/category

**Database Tables:**
- `propertyinventory`
- `propertyinventorydetail`
- `propertytype`
- `category`
- `propertyclassification`

**Property Code Format:**
- Example: `ESC-2025-ICT-001`
- ESC = El Salvador City
- 2025 = Year
- ICT = Category
- 001 = Sequential number

---

#### **2.2 Property Classification**
**Philippine Government Standard:**

| Classification | Description | Threshold | Document |
|---------------|-------------|-----------|----------|
| **Semi-Expendable** | Shorter lifespan, consumable nature | < ₱15,000 | ICS |
| **PPE (Non-Expendable)** | Property, Plant & Equipment | ≥ ₱15,000 | PAR |

**Examples:**
- **Semi-Expendable:** Office supplies, small tools, minor equipment
- **PPE:** Computers, furniture, vehicles, buildings

**Database:**
- `propertyclassification` table has `DocumentType` field: 'ICS' or 'PAR'

---

#### **2.3 QR Code Generation**
**Who:** Admin/GSO Staff  
**When:** After adding to inventory  
**Purpose:** Quick identification and tracking

**Process:**
1. Generate unique QR code per property
2. QR contains:
   - Property ID
   - Property Code
   - Property Name
   - Location
3. Print QR labels
4. Attach to physical property

**Database Tables:**
- `qrcode`

**QR Scanning Uses:**
- View property details instantly
- Update location
- Physical count verification
- Transfer tracking

---

### **3. DISTRIBUTION WORKFLOW**

#### **3.1 Property Issuance**
**Who:** GSO Staff  
**When:** Department requests property  
**Purpose:** Transfer property to department

**Process:**
1. Department requests property
2. Check availability in inventory
3. Create issuance record
4. Select properties to issue
5. Record issue date
6. Update property status: Available → Issued

**Database Tables:**
- `propertyissuance`
- `propertyissuancedetail`

---

#### **3.2 Property Assignment**
**Who:** GSO Staff or Department Head  
**When:** After issuance to department  
**Purpose:** Assign to specific end user (accountable person)

**Process:**
1. Select issued property
2. Choose end user
3. Record assignment date
4. Property status: Issued → Assigned
5. Generate PAR or ICS

**Database Tables:**
- `assignedproperty`

**Key Fields:**
- End user info
- Department
- Assignment date
- Condition at assignment
- Property status

---

#### **3.3 PAR Generation (Property Acknowledgment Receipt)**
**Who:** Admin/GSO Staff  
**When:** Assigning PPE/Non-Expendable property  
**Purpose:** Official accountability document

**Philippine Government Requirement:**
- Required by COA
- Must follow official format
- Includes:
  - PAR Number
  - End user details
  - Property details (with values)
  - Issue date
  - Signatures (issuer & receiver)

**Database Tables:**
- `par`

**IMPORTANT:** Print on official PAR form template

---

#### **3.4 ICS Generation (Inventory Custodian Slip)**
**Who:** Admin/GSO Staff  
**When:** Assigning Semi-Expendable property  
**Purpose:** Accountability for consumables

**Philippine Government Requirement:**
- Required by COA
- Simpler than PAR (no individual values needed)
- Includes:
  - ICS Number
  - End user/custodian
  - List of items with quantities
  - Issue date
  - Signatures

**Database Tables:**
- `inventorycustodianslip`
- `icsdetail`

---

### **4. MONITORING WORKFLOW**

#### **4.1 Physical Count**
**Who:** GSO Staff + Committee  
**When:** Quarterly or Annually  
**Purpose:** Verify actual vs recorded inventory

**Process:**
1. Create physical count session
2. Assign counters to areas/departments
3. Counters scan QR codes OR manually record
4. Record:
   - Property found/not found
   - Actual location
   - Condition
5. Generate variance report
6. Investigate discrepancies
7. Reconcile differences

**Database Tables:**
- `physicalcountsession`
- `physicalcount`

**THIS IS WHERE YOUR QR SCANNING SHINES!**
- Fast counting
- Accurate location tracking
- Real-time updates

---

#### **4.2 Property Transfer**
**Who:** GSO Staff (with approval)  
**When:** Property moves between departments/users  
**Purpose:** Update accountability

**Process:**
1. Transfer request submitted
2. Admin approves transfer
3. Record:
   - From: Current user/department
   - To: New user/department
   - Transfer date
   - Condition at transfer
4. Update PAR/ICS
5. New recipient signs

**Database Tables:**
- `propertytransfer`
- `propertytransferdetail`

---

#### **4.3 Job Orders (Repairs)**
**Who:** GSO Staff or End User  
**When:** Property needs repair  
**Purpose:** Track maintenance

**Process:**
1. Create job order
2. Describe issue
3. Assign to technician
4. Record:
   - Start date
   - Expected completion
   - Parts/labor cost
5. Update status: Pending → In Progress → Completed
6. Update property condition after repair

**Database Tables:**
- `joborder`
- `joborderdetail`
- `joborderstatus`

---

### **5. DISPOSAL WORKFLOW**

#### **5.1 IIRUP (Inspection of Unserviceable Property)**
**Who:** GSO Committee (3+ members)  
**When:** Property is unserviceable  
**Purpose:** Formal inspection and recommendation

**Philippine Government Requirement:**
- Required by COA before disposal
- Committee inspects property
- Makes recommendation:
  - **Repair** - Still fixable
  - **Transfer** - Useful to another office
  - **Disposal** - Beyond repair

**Process:**
1. Create IIRUP
2. Committee inspects property
3. Record findings
4. Make recommendation
5. Department head approves
6. Submit to higher authority if needed

**Database Tables:**
- `iirup`
- `iirupdetail`
- `iiruprecommendation`

---

#### **5.2 Property Disposal**
**Who:** Admin (with approval)  
**When:** After IIRUP recommendation  
**Purpose:** Official disposal process

**Disposal Methods (Philippine Government):**
1. **Public Auction** - Sell to highest bidder
2. **Donation** - Give to qualified institutions
3. **Destruction** - Physically destroy unusable items
4. **Transfer to COA** - For high-value items
5. **Condemnation** - Official declaration as waste

**Process:**
1. IIRUP approved
2. Select disposal method
3. Create disposal record
4. Execute disposal
5. Record disposal date
6. Update property status: Disposed
7. Generate Waste Material Report

**Database Tables:**
- `propertydisposal`
- `propertydisposaldetail`
- `disposalmethod`

---

#### **5.3 Waste Material Report (WMRP)**
**Who:** GSO Staff  
**When:** After disposal  
**Purpose:** Final documentation

**Philippine Government Requirement:**
- Required by COA
- Official record of disposed items
- Includes:
  - List of disposed properties
  - Disposal method
  - Date of disposal
  - Witnesses/committee signatures

**Database Tables:**
- `wastematerialreport`
- `wastematerialdetail`

---

## 🚀 IMPLEMENTATION STRATEGY

### **Phase 1: Core Modules (Week 1-4)**
Start with these tables:
```sql
-- Master data (Week 1)
category
classification  
propertyclassification
propertytype
unitofmeasure
condition
propertystatus
department
supplier

-- Property inventory (Week 1-2)
propertyinventory
propertyinventorydetail

-- Procurement (Week 3-4)
purchaserequest + purchaserequestdetail
purchaseorder + purchaseorderdetail
deliveryreceipt + deliveryreceiptdetail
inspectionacceptancereport + iardetail
```

### **Phase 2: Distribution (Week 5-6)**
```sql
propertyissuance + propertyissuancedetail
assignedproperty
enduser
par
inventorycustodianslip + icsdetail
```

### **Phase 3: QR & Monitoring (Week 7-8)**
```sql
qrcode
physicalcountsession
physicalcount
propertytransfer + propertytransferdetail
joborder + joborderdetail
```

### **Phase 4: Disposal & Reporting (Week 9-10)**
```sql
iirup + iirupdetail
propertydisposal + propertydisposaldetail
wastematerialreport + wastematerialdetail
```

---

## ✅ YOUR UNDERSTANDING: CORRECTED

**What you said:**
> "requisition, PO, DR, inspection, inventory, property, QR"

**Corrected flow:**
1. ✅ **PR (Purchase Request)** - Request to buy
2. ✅ **PO (Purchase Order)** - Order to supplier
3. ✅ **DR (Delivery Receipt)** - Items delivered
4. ✅ **IAR (Inspection)** - Inspect & accept
5. ✅ **Property Received** - Log in system
6. ✅ **Property Inventory** - Add to inventory
7. ✅ **QR Generation** - Create QR code
8. ❌ **MISSING:** Property Issuance
9. ❌ **MISSING:** Property Assignment
10. ❌ **MISSING:** PAR/ICS Generation
11. ✅ **QR Scanning** - For physical count
12. ❌ **MISSING:** Transfers, Job Orders
13. ❌ **MISSING:** IIRUP, Disposal, WMRP

---

## 🎯 FOCUS FOR YOUR CAPSTONE

**MUST HAVE:**
1. ✅ Procurement workflow (PR → PO → DR → IAR)
2. ✅ Property inventory with QR codes
3. ✅ Issuance & Assignment
4. ✅ PAR & ICS generation (PDF format)
5. ✅ QR scanning for physical count
6. ✅ Basic reporting

**NICE TO HAVE:**
- Property transfer
- Job orders
- IIRUP & disposal
- Advanced analytics

**YOUR DIFFERENTIATOR:**
- **QR-based property checking** during physical count
- **Automated PAR/ICS generation**
- **Real-time inventory tracking**
- **Mobile-responsive scanning**

---

## 🔥 FINAL BRUTAL TRUTH

**You were 70% correct on the flow.**

The main things you missed:
1. **Issuance & Assignment** - Not the same as inventory
2. **PAR/ICS** - Required by government
3. **Physical Count** - Where your QR scanning is most valuable
4. **IIRUP before disposal** - Government requirement

**Focus Order:**
1. Week 1-4: Procurement + Inventory ← **START HERE**
2. Week 5-6: Distribution + PAR/ICS
3. Week 7: QR Generation & Scanning ← **YOUR SELLING POINT**
4. Week 8-10: Everything else

**Don't build all database tables at once. Build incrementally as you complete each phase.**

Good luck! 💪
