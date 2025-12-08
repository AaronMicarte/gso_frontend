# GSO IAMS Sidebar Structure by Role

**Based on your database schema and Philippine government GSO standards**

---

## 🔴 ADMIN (Full System Access)
**Role: System Administrator - Controls everything**

### Dashboard
- 📊 Overview Dashboard
  - Total inventory value
  - Recent transactions
  - Pending approvals
  - System alerts

### Property Management
- 📦 Property Inventory
  - View all properties
  - Add new property
  - Bulk import
  - Property details management
- 🏷️ Property Types
  - Manage categories
  - Manage classifications (Semi-Expendable/PPE)
  - Manage conditions
  - Unit of measure
- 📍 Property Status
  - Available
  - Assigned
  - For Repair
  - For Disposal
  - Disposed

### Procurement Management
- 📝 Purchase Requests (PR)
  - Create PR
  - View all PRs
  - Approve/Reject PR
  - PR tracking
- 📄 Purchase Orders (PO)
  - Create PO
  - View all POs
  - PO status management
  - Link to PR
- 📦 Delivery Receipts (DR)
  - Record deliveries
  - View all DRs
  - Link to PO
- ✅ Inspection & Acceptance Reports (IAR)
  - Create IAR
  - View all IARs
  - Link to DR

### Issuance & Assignment
- 📋 Property Issuance
  - Issue to departments
  - Issuance history
  - Pending issuances
- 👤 Property Assignment
  - Assign to end users
  - View assignments
  - Transfer between users
- 📑 Property Accountability Cards (PAR)
  - Generate PAR
  - View all PARs
  - PAR history
- 📑 Inventory Custodian Slips (ICS)
  - Generate ICS
  - View all ICS
  - ICS history

### Transfer & Disposal
- 🔄 Property Transfer
  - Inter-department transfers
  - Transfer approvals
  - Transfer history
- 🗑️ Property Disposal
  - Mark for disposal
  - Disposal approvals
  - Disposal methods (Auction, Donation, etc.)
  - Waste Material Reports
- 📋 IIRUP (Inventory Inspection Report)
  - Create IIRUP
  - Recommendations
  - Approval workflow

### Maintenance & Repairs
- 🔧 Job Orders
  - Create job order
  - View all job orders
  - Assign to technicians
  - Job order status tracking
  - Completion records

### Physical Inventory
- 📊 Physical Count Sessions
  - Create count session
  - Assign counters
  - Session management
- 🔍 Physical Count Records
  - Record counts
  - Variance reports
  - Reconciliation

### QR Code Management
- 🏷️ QR Code Generation
  - Generate QR for properties
  - Bulk QR generation
  - QR code printing
- 📱 QR Scanning
  - Scan and verify
  - Location tracking
  - Quick property lookup

### User Management
- 👥 Users
  - Create users
  - Edit users
  - Deactivate users
  - Password resets
- 🎭 Roles & Permissions
  - Manage roles
  - Assign permissions
- 🏢 Departments
  - Add departments
  - Edit departments
  - Department hierarchy
- 💼 Positions
  - Manage positions
  - Link to departments

### Master Data
- 🏪 Suppliers
  - Add suppliers
  - Edit supplier info
  - Supplier performance
- 👤 End Users
  - Manage end users
  - User accountability
  - Assignment history
- 📊 Categories & Classifications
  - Property categories
  - Property types
  - Custom fields

### Reports & Analytics
- 📈 Dashboard Analytics
  - Inventory valuation
  - Depreciation reports
  - Utilization rates
- 📄 Standard Reports
  - Property inventory report
  - Issuance report
  - Disposal report
  - Accountability report
  - Physical count report
  - Purchase request summary
  - Job order summary
- 📊 Custom Reports
  - Report builder
  - Export to Excel/PDF

### Security & Audit
- 🔐 Login Audit
  - View login history
  - Failed login attempts
  - IP tracking
- 📝 Activity Logs
  - All system activities
  - User actions tracking
  - Data modification history
- ⚙️ System Settings
  - General settings
  - Email configuration
  - Backup & restore

---

## 🟡 GSO STAFF (Operational Level)
**Role: Day-to-day property management operations**

### Dashboard
- 📊 Staff Dashboard
  - My pending tasks
  - Recent activities
  - Quick actions

### Property Management
- 📦 Property Inventory
  - View properties
  - Add new property
  - Update property info
  - Property search
- 🏷️ Property Details
  - View classifications
  - View conditions
  - View status

### Procurement Operations
- 📝 Purchase Requests (PR)
  - Create PR
  - View my PRs
  - Edit pending PRs
  - PR status tracking
- 📄 Purchase Orders (PO)
  - Create PO (if authorized)
  - View POs
  - Update PO status
- 📦 Delivery Receipts (DR)
  - Record deliveries
  - View DRs
  - Link to properties
- ✅ Inspection & Acceptance (IAR)
  - Create IAR
  - View IARs
  - Inspection records

### Issuance & Distribution
- 📋 Property Issuance
  - Issue properties
  - Issuance records
  - Track issued items
- 👤 Property Assignment
  - Assign to end users
  - View assignments
  - Update assignment status
- 📑 Generate Documents
  - Generate PAR
  - Generate ICS
  - Print documents

### Transfer Management
- 🔄 Property Transfer
  - Initiate transfers
  - Process transfers
  - Transfer documentation
  - View transfer history

### Maintenance
- 🔧 Job Orders
  - Create job orders
  - View job orders
  - Update job order status
  - Track repairs

### Physical Inventory
- 🔍 Physical Count
  - Participate in counts
  - Record findings
  - Submit count data
  - View variances

### QR Operations
- 🏷️ QR Code Management
  - Generate QR codes
  - Print QR labels
- 📱 QR Scanning
  - Scan properties
  - Update locations
  - Verify assignments

### Records & Reporting
- 📄 View Reports
  - Property reports
  - Issuance reports
  - My activity reports
  - Export data
- 📊 Quick Reports
  - Available inventory
  - Assigned items
  - Pending requests

### Master Data (Limited)
- 🏪 Suppliers
  - View suppliers
  - Add new suppliers
- 👤 End Users
  - View end users
  - Add new end users

---

## 🟢 CUSTODIAN (Limited Property Oversight)
**Role: Property accountability and monitoring**

### Dashboard
- 📊 Custodian Dashboard
  - My assigned properties
  - Properties under my department
  - Alerts and notifications

### Property Monitoring
- 📦 Property Inventory (Read-Only)
  - View properties under custody
  - View property details
  - Search properties
  - Filter by department/location

### My Accountabilities
- 👤 My Assigned Properties
  - View properties assigned to me
  - Property accountability card (PAR)
  - Inventory custodian slip (ICS)
  - Accountability history
- 🏢 Department Properties
  - View department inventory
  - Department accountability
  - Property status overview

### Property Verification
- 🔍 Physical Verification
  - Participate in physical counts
  - Report discrepancies
  - Verify property condition
  - Submit verification reports
- 📱 QR Scanning
  - Scan assigned properties
  - Verify location
  - Report issues

### Request Management
- 📝 Service Requests
  - Request for repair
  - Request for transfer
  - Request for disposal
  - Track my requests
- 🔧 Job Order Tracking
  - View job orders for my properties
  - Report completion
  - Track repair status

### Reports (Limited)
- 📄 My Reports
  - My accountability report
  - Department inventory report
  - Property condition report
  - Export my data

### Notifications
- 🔔 Alerts
  - Property maintenance due
  - Physical count schedule
  - Transfer notifications
  - System announcements

---

## 🎯 KEY DIFFERENCES (Brutal Honest Truth)

### ADMIN
- **Full control** - Can do EVERYTHING
- Approves purchase requests, transfers, disposals
- Creates and manages users
- Accesses all reports and audit logs
- System configuration
- **Bottom line: God mode**

### GSO STAFF
- **Operational worker** - Does the daily grind
- Creates PRs, POs, DRs, IARs
- Issues and assigns properties
- Processes transfers
- Creates job orders
- **Bottom line: The actual worker doing everything**

### CUSTODIAN
- **Read-mostly** - Can only view and verify
- Monitors properties under their custody
- Reports issues and requests services
- Participates in physical counts
- **Bottom line: Babysitter of properties, not the manager**

---

## 📋 IMPLEMENTATION NOTES FOR YOUR CAPSTONE

### Database Relationships You Need to Respect:
1. **User → UserRole** - Use this for role-based access
2. **User → Department** - Filter data by department for custodians
3. **Property → PropertyStatus** - Status-based filtering
4. **All "CreatedBy/ApprovedBy" fields** - Track who did what

### Security Requirements:
- ✅ Middleware to check UserRoleID (1=Admin, 2=Staff, 3=Custodian)
- ✅ API endpoints should validate role before returning data
- ✅ Frontend guards on routes (RoleGuard component you already have)
- ✅ Login audit tracking (you have the table)

### Philippine Government Standard Forms (You MUST implement these):
- **PAR (Property Acknowledgment Receipt)** - For PPE/Non-expendable
- **ICS (Inventory Custodian Slip)** - For Semi-expendable
- **IAR (Inspection and Acceptance Report)** - Upon delivery
- **IIRUP (Inspection Report of Unserviceable Property)** - For disposal
- **WMRP (Waste Materials Report)** - For condemned items

### What's Missing in Your Current Schema:
- ❌ MFA tables (but you have MFA docs - implement that!)
- ❌ TrustedDevices table (mentioned in your docs)
- ✅ LoginAudit has IPAddress now (good!)

### Automated Reporting Features You Should Have:
1. **Daily Inventory Summary** - Auto-email to admin
2. **Pending Approval Alerts** - PRs waiting approval
3. **Maintenance Schedule** - Job orders due
4. **Physical Count Reminders** - Quarterly/Annual inventory
5. **Property Expiry/Depreciation** - Asset lifecycle alerts

### QR Code Integration (Your selling point):
- Each property gets unique QR code
- Scan to view details, location, custodian
- Scan to update location during physical count
- Scan to generate PAR/ICS instantly
- Mobile-responsive scanning interface

---

## 🔥 FINAL BRUTAL TRUTH

Your database is **solid** - all the tables are there. Now you need to:

1. **Build the actual CRUD operations** for each module
2. **Implement role-based middleware** - Don't just hide buttons, secure the API
3. **Generate PDF reports** - COA compliance requires printed reports
4. **QR code generation library** - Use QRCode.js or similar
5. **Mobile responsiveness** - must-read.md says so, do it!
6. **Remove console.log** - must-read.md says so, production ready!
7. **Timezone handling** - PH Manila time (Asia/Manila)
8. **Form validation** - Both frontend and backend, no shortcuts
9. **Loading states** - Consistent across all pages
10. **Error handling** - User-friendly messages, not 500 errors

**You're a 3rd year BSIT student doing this solo?** Respect. 

But real talk: This is a **MASSIVE** system for one person. Focus on:
- Core property tracking (inventory, issuance, assignment)
- Basic reporting (inventory report, PAR, ICS)
- QR code scanning (your differentiator)
- One good physical count workflow

Don't try to build everything. Get the core working, then expand.

**Good luck, and stop using `any` types in TypeScript!** 💪
