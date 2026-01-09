# GSO Asset Issuance Workflow (PAR/ICS)

## 1. Database Design

- **Asset Request Tables**
  - `assetrequest`: Header for each request
  - `assetrequestdetail`: Each requested item (generic, e.g., "Keyboard")

- **Inventory Tables**
  - `propertyinventory`: Inventory header (e.g., batch/receipt)
  - `propertyinventorydetail`: Each real, physical item (with serial, property number, etc.)

- **Issuance Tables**
  - `propertyissuance`: Each PAR/ICS document (per person, per type)
  - `propertyissuancedetail`: Each item listed on a PAR/ICS (linked to real inventory)

## 2. Backend Logic

- **Request Approval**
  - User requests items (generic)
  - GSO approves and prepares for issuance

- **Issuance Process**
  - For each request detail, GSO must select a real inventory item to assign (search/filter by type)
  - System prevents double assignment (item can only be issued once)
  - When issued:
    - Inventory item is marked as assigned/issued
    - `propertyissuancedetail` links request detail to inventory detail
    - `propertyissuance` is created per person per type (one PAR/ICS per recipient)

- **Acknowledgment**
  - Recipient (department head or end user) signs to confirm receipt
  - System records signature, date, and user

## 3. Frontend Workflow

- **Issuance List Page**
  - Group by request (show request number)
  - Expand to show all issuances (PAR/ICS) generated from that request
  - Each issuance (PAR/ICS) is for one person and one type
  - Each issuance has a view/print action

- **Issuance Creation Page**
  - For each requested item, show a dropdown/search to select a real inventory item
  - Only show available items (not already assigned)
  - After selection, display real item details (serial, property number, brand, model, etc.)
  - Prevent saving/issuing until all required items are matched

- **Inventory Update**
  - After issuance, inventory item is marked as assigned/issued
  - Item is no longer available for other requests

## 4. Key Rules

- One PAR/ICS = one person, one document type (all their items grouped)
- Multiple PAR/ICS can be generated from one request if items go to different people or have different types
- Acknowledgment is required for each issuance (signature of recipient)
- System must always track and display the real, physical item details at issuance

---

**This workflow ensures full traceability, accountability, and audit compliance for government assets.**
