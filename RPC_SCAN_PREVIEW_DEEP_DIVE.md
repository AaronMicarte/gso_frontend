# RPC Inventory Scan Preview 404 Error - Deep Dive & Fixes

## Problem Summary
The frontend was receiving 404 errors when attempting to preview RPC inventory scans:
```
POST http://localhost:8000/api/rpc-inventory/cycles/1/scan-preview 404 (Not Found)
```

## Root Causes Identified

### Issue 1: Frontend Property Resolution Logic
**Location**: `src/components/features/qr/RpcInventoryPage.tsx`

**Problem**: The property_number wasn't being passed consistently in both camera and manual scan paths, causing incomplete property lookups.

**Fix Applied**:
- Added `property_number` fallback logic to `handlePreview()` function
- Improved `onPreviewFromInput()` logic to send property_number only when needed
- Both paths now consistently pass: property_id, inventory_detail_id, property_number, and qr_value

### Issue 2: Backend Error Messages Not Informative
**Location**: `backend/app/Http/Controllers/RpcInventoryController.php`

**Problem**: 
- `RpcInventoryCycle::findOrFail()` was returning generic 404 without context
- Property lookup failures returned minimal error info
- No request logging for debugging

**Fixes Applied**:
1. **Better Cycle Error Handling** (line ~148):
   ```php
   $cycle = RpcInventoryCycle::find($id);
   if (!$cycle) {
       return response()->json([
           'message' => "Inventory cycle with ID {$id} not found. Please create or select a valid cycle.",
           'cycle_id' => $id,
       ], 404);
   }
   ```

2. **Request Logging** (line ~165):
   ```php
   \Log::debug('RPC inventory scan preview request', [
       'cycle_id' => $id,
       'property_id' => $propertyId,
       'inventory_detail_id' => $inventoryDetailId,
       'property_number' => $propertyNumber,
       'qr_value' => $validated['qr_value'] ?? null,
   ]);
   ```

3. **Property Lookup Debugging** (line ~210):
   ```php
   if (!$mapped) {
       $debug = [
           'input_property_id' => $propertyId,
           'input_inventory_detail_id' => $inventoryDetailId,
           'input_property_number' => $propertyNumber,
           'qr_value' => $validated['qr_value'] ?? null,
       ];
       
       \Log::warning('RPC inventory scan preview: property not found', $debug);
       
       return response()->json([
           'message' => 'Property not found for the provided input...',
           'input' => $debug,
       ], 404);
   }
   ```

4. **Improved Input Validation** (line ~180):
   - Now checks if `inventoryDetailId` is provided before returning 422

### Issue 3: Poor Frontend Error Display
**Location**: `src/components/features/qr/RpcInventoryPage.tsx`

**Problem**: 
- Generic "Unable to preview scan" message
- No indication of what was missing or wrong
- No guidance for users when cycles don't exist

**Fixes Applied**:

1. **Cycle List Diagnostic Container** (after line 851):
   ```tsx
   {!selectedCycle && cycles.length === 0 && !loadingCycles && (
       <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-6 space-y-4">
           <div className="flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
               <div className="flex-1">
                   <h3 className="font-semibold text-amber-900">No Inventory Cycles Available</h3>
                   <p className="text-sm text-amber-800 mt-2">
                       To begin RPC scanning, you need to create an inventory cycle for the current year.
                   </p>
                   <button
                       onClick={handleCreateCurrentCycle}
                       className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white..."
                   >
                       <Plus className="w-4 h-4" />
                       Create Current Year Cycle
                   </button>
               </div>
           </div>
       </section>
   )}
   ```

2. **Enhanced Error Details** (handlePreview error handler):
   ```tsx
   } catch (error: unknown) {
       let errorMessage = 'Unable to preview scan';
       let errorDetails = '';
       
       if (typeof error === 'object' && error !== null && 'response' in error) {
           const axiosError = error as { response?: { status?: number; data?: { message?: string; received?: Record<string, unknown>; input?: Record<string, unknown> } } };
           const status = axiosError.response?.status;
           const data = axiosError.response?.data;
           
           errorMessage = (typeof data?.message === 'string' ? data.message : `Request failed with status ${status}`);
           
           if (status === 404) {
               if (data?.cycle_id) {
                   errorDetails = `Cycle ID ${data.cycle_id} not found. Make sure you've created a cycle first.`;
               } else {
                   errorDetails = data?.input ? JSON.stringify(data.input, null, 2) : 'Property not found in database.';
               }
           } else if (status === 422) {
               errorDetails = 'Invalid input provided.';
           }
       }
       
       toast.error(errorMessage, {
           description: errorDetails ? `${errorDetails}` : undefined,
       });
   }
   ```

## Database Considerations

### Required Test Data
For scanning to work, the database must have:

1. **At least one RPC Inventory Cycle**:
   ```sql
   SELECT * FROM rpc_inventory_cycles;
   ```

2. **Properties with inventory details** (RPCPPE or RPCSEP classification):
   ```sql
   SELECT 
       ap.PropertyID,
       pid.InventoryDetailID,
       pid.PropertyNumber,
       pt.PropertyClassificationID
   FROM assigned_property ap
   JOIN property_inventory_detail pid ON pid.InventoryDetailID = ap.InventoryDetailID
   JOIN property_type pt ON pt.PropertyTypeID = pid.PropertyTypeID
   WHERE pt.PropertyClassificationID IN (1, 2);  -- 1=Semi-Expendable, 2=Non-Expendable
   ```

### Database Troubleshooting

If users are getting 404 for properties:

1. **Check if cycles exist**:
   ```sql
   SELECT id, cycle_label, status FROM rpc_inventory_cycles WHERE deleted_at IS NULL;
   ```

2. **Check if properties exist for RPC types**:
   ```sql
   SELECT COUNT(*) as rpc_count FROM property_inventory_detail 
   WHERE deleted_at IS NULL 
   AND PropertyTypeID IN (
       SELECT PropertyTypeID FROM property_type 
       WHERE PropertyClassificationID IN (1, 2)
   );
   ```

3. **Verify issuance status** (some reports filter by 'acknowledged'):
   ```sql
   SELECT DISTINCT Status FROM propertyissuance WHERE deleted_at IS NULL;
   ```

## Workflow for Users

### Step 1: Create a Cycle
1. Go to RPC Inventory page
2. If no cycles exist, click "Create Current Year Cycle" button
3. Wait for cycle to be created

### Step 2: Scan Properties
1. Select the cycle from the list
2. Enter Property ID, Property Number, or scan QR code
3. System looks up property in database via:
   - Direct property_id lookup in assigned_property table
   - inventory_detail_id lookup in property_inventory_detail table
   - property_number lookup (must match exactly)
   - QR value extraction (if it's a URL or numeric)

### Step 3: If Scan Preview Fails
- Check error message for specific reason
- Verify cycle exists and is selected
- Verify property exists in database (contact admin if needed)
- Check QR code is valid or property number is correct
- Try entering the property ID manually instead of QR code

## Backend API Flow Diagram

```
POST /api/rpc-inventory/cycles/{id}/scan-preview
    ↓
[1] Authenticate & authorize (GSO Staff or Admin) 
    ↓
[2] Find cycle {id}
    ├─ No: Return 404 with cycle_id
    └─ Yes: Continue
    ↓
[3] Extract property identifiers from request:
    - property_id
    - inventory_detail_id
    - property_number
    - qr_value
    ↓
[4] Validate at least ONE identifier provided
    ├─ No: Return 422 with validation error
    └─ Yes: Continue
    ↓
[5] Try lookups in order:
    [5a] If property_id: lookup AssignedProperty.find($id)
         ├─ Found: map and continue
         └─ Not found: try inventory_detail by id
    [5b] If inventory_detail_id: lookup PropertyInventoryDetail.find($id)
    [5c] If property_number: lookup by PropertyNumber field
         ├─ Find in AssignedProperty→InventoryDetail.PropertyNumber
         └─ Find in PropertyInventoryDetail.PropertyNumber
    ↓
[6] Map found record to response format
    ├─ Property not found: Return 404 with debug info
    └─ Found: Continue
    ↓
[7] Resolve scan group context (other items in same asset group)
    ↓
[8] Check for existing scans in this cycle
    ↓
[9] Return full preview with:
    - asset details
    - group counts
    - candidates for multi-select
    - already_scanned flag
```

## Testing Checklist

- [ ] Cycles load without errors
- [ ] "Create Current Year Cycle" button works
- [ ] Can select a cycle
- [ ] Can enter a property ID and get preview
- [ ] Can enter a property number and get preview
- [ ] Can scan QR code and get preview
- [ ] Error messages show when property doesn't exist
- [ ] Error messages show when cycle doesn't exist
- [ ] Backend logs show request details for debugging
- [ ] Property lookup handles all three methods (ID, detail, number)

## Performance Notes

- Cycles load with counts (helps UI show status)
- Scan preview uses single query with eager loading
- Property lookups use indexed fields (PropertyID, InventoryDetailID, PropertyNumber)
- Logging uses appropriate levels (DEBUG for requests, WARNING for failures)

## Future Improvements

1. Add autocomplete for property numbers
2. Add batch QR code scanning
3. Add QR code validation before submission
4. Add offline queue status monitoring
5. Add permission checks for specific cycle access
6. Implement property caching layer for large inventories
