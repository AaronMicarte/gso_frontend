# GSO Asset Issuance Workflow Plan

## Problem Identification
- Traceability is required from supplier delivery to final issuance without PR/PO/JO or request modules.
- GSO does not run procurement workflows; the system must start at DR.
- All delivered items are already assigned to a department and requester (from DR).
- Requisition/RIS steps are no longer part of issuance.

## Goals
- Start workflow at Delivery Receipt (DR).
- Use DR Requested By + Department as the issuance basis.
- Ingest accepted IAR items into inventory and mark as Available (for issuance).
- Issue assets directly from inventory based on DR references.
- Keep strong audit trail (DR → IAR → Inventory → Issuance).

## Correct Workflow (Aligned with Real GSO)

### 1) Delivery Receipt (DR)
- Manual DR entry (supplier, requested by, department, optional PO/PR references, invoice).
- DR details capture item description, qty, property type, cost.

### 2) Inspection & Acceptance (IAR)
- Mandatory inspection before inventory.
- Accepted items only.

### 3) Inventory Ingestion
- Accepted items become inventory items.
- Each inventory detail represents a real, issuable item.
- Status = Available (for issuance).

### 4) Issuance (PAR/ICS)
- Select a DR that has available inventory items.
- Choose inventory items from that DR.
- System auto-groups into PAR or ICS based on property classification.
- Issued To is derived from DR Requested By (with department as accountability).
- Recipient acknowledgment signature required for completion.

### 5) Traceability
- DR and Issuance records remain linked for audits.
- Every issued item has an accountability record.

## Key Rules
- No Asset Request module and no RIS in the issuance flow.
- Issuance is always from inventory items that came from a DR.
- One PAR/ICS per recipient + document type.
- All dates are Asia/Manila.

## Workflow Summary
1. Supplier delivers items
2. DR is created (requested by, department, optional PO/PR references)
3. IAR is created and accepted items are ingested
4. Inventory is issued by DR reference (PAR/ICS)
5. Recipient acknowledges receipt

## Benefits
- Realistic GSO flow with less friction
- Clear accountability with DR-based traceability
- Simpler issuance with fewer unnecessary modules