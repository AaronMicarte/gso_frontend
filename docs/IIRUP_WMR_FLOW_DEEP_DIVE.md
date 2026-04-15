# IIRUP and WMR Flow Deep Dive (Based on Current Codebase)

Date: 2026-04-15

## Reality Check

The current implementation is a modernized disposal workflow centered on:
- `property_waste_reports`
- `property_waste_items`
- `/api/property-wastes/*`

Legacy tables for traditional forms still exist in SQL dump:
- `iirup`, `iirupdetail`, `iiruprecommendation`
- `wastematerialreport`, `wastematerialdetail`

But there is currently no full CRUD/API flow for `iirup` and `wastematerialreport` in backend routes/controllers.

## End-to-End Flow (Actual Running Flow)

```mermaid
flowchart TD
  A[Asset Service Record Detail status changes to unserviceable] --> B[Backend ensureWasteRecordForUnserviceable]
  B --> C[Create/Reuse property_waste_report with WasteNumber WST-YYYY-NNNN]
  B --> D[Create property_waste_item with status pending_method]
  B --> E[Set inventory and assigned property status to For Disposal]

  C --> F[Frontend Disposal Page loads /api/property-wastes]
  D --> F

  F --> G{GSO Admin/Staff sets disposal method?}
  G -->|Yes| H[POST /api/property-wastes/{id} items...]
  H --> I[Item status becomes method_selected]
  G -->|No| J[Remains pending_method]

  I --> K{All items have disposal method?}
  K -->|Yes| L[User clicks Mark disposal done]
  L --> M[POST /api/property-wastes/{id} with report status completed and item status disposed]
  M --> N[Report workflow shows done]

  K -->|No| O[Block completion in UI]

  N --> P[Audit log: property_waste_report updated]
```

## Data Layer Mapping

### Active tables
- `property_waste_reports`
  - report-level fields: `WasteNumber`, `SourceServiceRecordID`, `DepartmentID`, `Status`, `Notes`
  - status enum now: `draft`, `completed`, `cancelled`
- `property_waste_items`
  - item-level fields: `DisposalMethodID`, `DisposalMethodNote`, `Status`
  - item status enum: `pending_method`, `method_selected`, `for_disposal`, `disposed`

### Legacy tables still present
- `iirup`, `iirupdetail`, `iiruprecommendation`
- `wastematerialreport`, `wastematerialdetail`

These are schema-present but not currently wired as a full user workflow in routes/controllers/UI.

## Backend Layer Mapping

### Auto-create trigger
- `AssetServiceRecordController::ensureWasteRecordForUnserviceable(...)`
  - when detail status is `unserviceable`:
    - creates report (`property_waste_reports`) if not existing per service record
    - creates item (`property_waste_items`) if not existing per service detail
    - marks inventory status as "For Disposal"

### Waste workflow API
- `GET /api/property-wastes`
- `GET /api/property-wastes/{id}`
- `POST /api/property-wastes/{id}`
- `GET /api/property-wastes/statuses`
- `GET /api/property-wastes/helpers/disposal-methods`

### Role behavior
- View: Admin, GSO Staff, Department Head
- Manage/update: Admin, GSO Staff

## Frontend Layer Mapping

### Screens
- `/admin/disposal`
- `/staff/disposal`
- `/department_head/disposal`

All use `PropertyWastePage`.

### UI behavior
- Search and list waste reports
- Expand report to view item details
- Set/Change disposal method per item
- Save report notes
- Mark disposal done (sets all items to `disposed`, report to `completed`)

## Corrections Needed

1. Status type mismatch in frontend typings
- Frontend type still allows `for_approval` and `approved` in `PropertyWasteStatus`.
- Backend/report enum is already simplified to: `draft | completed | cancelled`.
- This can cause confusion and invalid assumptions in client code.

2. Sidebar has IIRUP link but no actual route/page
- Sidebar includes `/iirup` link.
- No matching page files were found for `.../iirup` route.
- This likely leads to a 404 if users click IIRUP.

3. Traditional IIRUP/WMR forms are not fully implemented in app workflow
- Database has legacy form tables.
- Backend routes/controllers do not currently expose full IIRUP/WMR CRUD flow.
- Current flow is effectively disposal tracking via property waste workflow.

4. Item status `for_disposal` exists but is not actively driven by UI transitions
- UI currently moves item mostly between `pending_method`, `method_selected`, and `disposed`.
- If you need explicit intermediate stage, add UI action to set `for_disposal`.

## Recommended Target Process (if you want strict IIRUP then WMR)

1. Build `IIRUP` module (header/detail/recommendation) and approval process.
2. Lock disposal execution until IIRUP reaches approved state.
3. Generate `WMR` only after disposal execution is completed.
4. Keep `property_waste_*` as operational tracker, or map it explicitly to WMR records.
5. Add route/page for `/iirup` or remove sidebar link until module exists.

## Quick Win Checklist

- Align frontend `PropertyWasteStatus` type with backend enum.
- Fix/remove broken IIRUP sidebar link.
- Decide single source of truth:
  - Option A: modern `property_waste_*` flow only
  - Option B: strict legal forms flow (`iirup` then `wmr`) and wire APIs/UI accordingly
- If Option B, add migration-safe mapping from existing disposal records to new IIRUP/WMR entries.
