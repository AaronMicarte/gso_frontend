# GSO Asset Issuance Workflow Plan

## Problem Identification
- Need traceability from supplier delivery to asset issuance without running procurement modules.
- GSO does not handle procurement; PO/PR/JO processes are outside system scope.
- Only manage asset and inventory assignment, not stock or warehouse management.
- All items are pre-assigned; no requisition or stock tracking is needed.
- Must capture requested by and department info, but not full procurement data.

## Goals
- Start workflow at delivery receipt (when items arrive from supplier).
- Record essential reference details manually (item, quantity, requested by, department, optional PO/PR numbers if present on paper).
- Keep traceability on the DR record without building procurement modules.
- Ingest items into inventory and mark as to be issued.
- Issue assets directly to requester, skipping requisition and stock steps.

## Proposed Solutions

### 1. Manual Reference Fields (No Procurement Module)
- When creating a DR, manually input reference details (item, quantity, requested by, department).
- If the paper includes PO/PR numbers, store them as simple text references on the DR.
- Optionally, attach scanned PO/PR pages as supporting documents on the DR record.

### 2. Enhanced Delivery Receipt
- Add Requested By and Department fields to the DR.
- Ensure DR lists all items delivered, with descriptions and quantities.
- Include optional PO/PR reference numbers as plain text only.

### 3. Inventory Ingestion
- When items are entered into inventory, mark them as to be issued.
- Skip available or unassigned statuses; focus on assignment and issuance.

### 4. Issuance Workflow
- Issue items directly to requester based on DR data and reference fields.
- Record issuance details (date, recipient, department) for accountability.

### 5. No Requisition Step
- All items are pre-assigned; no requisition or request process needed.
- Department heads do not request items in-system; assignment is based on DR reference info.

### 6. Documentation and Traceability
- Maintain clear records linking DR and issuance.
- Keep reference fields and attachments for audit traceability.
- Ensure each asset/item is traceable to its requester and department.

## Workflow Summary
1. Supplier delivers items
2. Delivery Receipt is created (requested by, department, optional PO/PR references, attachments)
3. Items ingested into inventory as to be issued
4. Items issued directly to requester
5. All steps documented for traceability

## Benefits
- Simple, focused workflow tailored to GSO’s role
- Manual entry allows flexibility and avoids unnecessary complexity
- Clear traceability from supplier delivery to asset issuance

---

Feel free to refine or expand this plan as needed for your implementation.