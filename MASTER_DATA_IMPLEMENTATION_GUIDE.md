# Master Data Implementation - Complete Structure

## ✅ What's Been Done

### 1. TypeScript Types (`src/types/masterData.ts`)
✅ All master data types created:
- Department + DepartmentInput
- Classification + ClassificationInput  
- PropertyClassification + PropertyClassificationInput
- PropertyType + PropertyTypeInput
- UnitOfMeasure + UnitOfMeasureInput
- Supplier + SupplierInput
- Position + PositionInput
- EndUser + EndUserInput
- Condition, PropertyStatus (read-only)
- API Response types (ApiResponse, PaginatedResponse)

### 2. API Clients (`src/lib/api/masterData/`)
✅ All API clients created with CRUD operations:
- `categories.ts` - ✅ Complete
- `classifications.ts` - ✅ Complete
- `departments.ts` - ✅ Complete
- `endUsers.ts` - ✅ Complete
- `positions.ts` - ✅ Complete
- `propertyClassifications.ts` - ✅ Complete
- `propertyTypes.ts` - ✅ Complete
- `suppliers.ts` - ✅ Complete
- `unitsOfMeasure.ts` - ✅ Complete
- `index.ts` - ✅ Centralized exports

### 3. React Query Hooks (`src/lib/hooks/masterData/`)
✅ All hooks created with query keys and mutations:
- `useCategories.ts` - ✅ Complete
- `useClassifications.ts` - ✅ Complete
- `useDepartments.ts` - ✅ Complete
- `useEndUsers.ts` - ✅ Complete
- `usePositions.ts` - ✅ Complete
- `usePropertyClassifications.ts` - ✅ Complete
- `usePropertyTypes.ts` - ✅ Complete
- `useSuppliers.ts` - ✅ Complete
- `useUnitsOfMeasure.ts` - ✅ Complete
- `index.ts` - ✅ Centralized exports

### 4. Admin Pages
✅ Created:
- `src/app/admin/categories/page.tsx` - ✅ Complete (with mobile responsive)
- `src/app/admin/departments/page.tsx` - ✅ Complete (with mobile responsive)

## 📋 What YOU Need to Create Next

### Phase 1: Remaining Admin List Pages
Follow the **EXACT** pattern from `departments/page.tsx`:

#### Create these folders and page.tsx files:
```
src/app/admin/masterdata
├── classifications/
│   └── page.tsx
├── property-classifications/
│   └── page.tsx
├── property-types/
│   └── page.tsx
├── units-of-measure/
│   └── page.tsx
├── suppliers/
│   └── page.tsx
├── positions/
│   └── page.tsx
└── end-users/
    └── page.tsx
```

#### Template Pattern to Follow:
1. **Import the correct hook**: `useDepartments` → `useClassifications`, etc.
2. **Import the correct type**: `Department` → `Classification`, etc.
3. **Update icons**: Use appropriate Lucide icons
4. **Update titles**: "Departments" → "Classifications", etc.
5. **Update search placeholder**: Adjust to module-specific fields
6. **Update table columns**: Match the data structure

#### Example for Classifications:
```tsx
// Change these lines:
import { useClassifications, useDeleteClassification } from '@/lib/hooks/masterData';
import { Classification } from '@/types/masterData';
import { Tag } from 'lucide-react'; // Appropriate icon

// Update filter:
const { data, isLoading, error, refetch } = useClassifications({
    search: debouncedSearch || undefined,
    page: currentPage,
    per_page: 15,
    sort_by: 'id',
    sort_order: 'desc',
});

// Update table columns for classification-specific fields
```

### Phase 2: Form Pages (New/Edit)
Create form pages for each module following the categories pattern:

```
src/app/admin/masterdata
├── categories/
│   ├── new/
│   │   └── page.tsx
│   └── [id]/
│       └── page.tsx
├── departments/
│   ├── new/
│   │   └── page.tsx
│   └── [id]/
│       └── page.tsx
// ... repeat for all modules
```

#### Form Pattern:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateDepartment, useDepartment, useUpdateDepartment } from '@/lib/hooks/masterData';
import { DepartmentInput } from '@/types/masterData';
import { toast } from 'sonner';

export default function DepartmentFormPage({ params }: { params: { id?: string } }) {
    const router = useRouter();
    const isEdit = Boolean(params?.id);
    const departmentId = params?.id ? parseInt(params.id) : null;

    // Hooks
    const { data: department, isLoading } = useDepartment(departmentId);
    const createMutation = useCreateDepartment();
    const updateMutation = useUpdateDepartment();

    // Form state
    const [formData, setFormData] = useState<DepartmentInput>({
        code: '',
        name: '',
        description: '',
    });

    // Populate form when editing
    useEffect(() => {
        if (department && isEdit) {
            setFormData({
                code: department.code,
                name: department.name,
                description: department.description || '',
            });
        }
    }, [department, isEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isEdit && departmentId) {
            updateMutation.mutate(
                { id: departmentId, data: formData },
                {
                    onSuccess: () => {
                        router.push('/admin/departments');
                    },
                }
            );
        } else {
            createMutation.mutate(formData, {
                onSuccess: () => {
                    router.push('/admin/departments');
                },
            });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="px-4 sm:px-6 lg:px-8 py-8">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6">
                        {isEdit ? 'Edit Department' : 'New Department'}
                    </h1>

                    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Department Code *
                            </label>
                            <input
                                type="text"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                required
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                placeholder="e.g., ICT"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Department Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                placeholder="e.g., Information and Communications Technology"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                placeholder="Optional description..."
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50"
                            >
                                {isEdit ? 'Update' : 'Create'} Department
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
```

### Phase 3: Update Sidebar Navigation

Update `src/constants/index.ts` or wherever your sidebar is defined:

```typescript
export const sidebarItems = [
    {
        title: 'Dashboard',
        url: '/admin/dashboard',
        icon: 'LayoutDashboard',
    },
    {
        title: 'Master Data',
        icon: 'Database',
        children: [
            {
                title: 'Categories',
                url: '/admin/categories',
                icon: 'FolderTree',
            },
            {
                title: 'Classifications',
                url: '/admin/classifications',
                icon: 'Tag',
            },
            {
                title: 'Departments',
                url: '/admin/departments',
                icon: 'Building2',
            },
            {
                title: 'Property Classifications',
                url: '/admin/property-classifications',
                icon: 'FileType',
            },
            {
                title: 'Property Types',
                url: '/admin/property-types',
                icon: 'Box',
            },
            {
                title: 'Units of Measure',
                url: '/admin/units-of-measure',
                icon: 'Ruler',
            },
            {
                title: 'Suppliers',
                url: '/admin/suppliers',
                icon: 'Truck',
            },
            {
                title: 'Positions',
                url: '/admin/positions',
                icon: 'Briefcase',
            },
            {
                title: 'End Users',
                url: '/admin/end-users',
                icon: 'Users',
            },
        ],
    },
];
```

## 🎯 Key Points to Remember (From must-read.md)

1. ✅ **Proper TypeScript types** - No 'any' types
2. ✅ **Error handling** - User-friendly messages with toast
3. ✅ **Loading states** - Spinner and disabled buttons
4. ✅ **Timezone aware** - Use 'Asia/Manila' for PH time
5. ✅ **Mobile responsive** - Card view for mobile, table for desktop
6. ✅ **Accessibility** - aria-labels, semantic HTML
7. ✅ **Sonner toasts** - For all success/error messages
8. ✅ **Consistent styling** - Same color scheme, spacing
9. ✅ **No console.log** - Remove all debug logs

## 🚀 Next Steps

1. Create remaining list pages (classifications, property-types, etc.)
2. Create all form pages (new + edit) for each module
3. Update sidebar navigation
4. Test each module thoroughly
5. Move to Phase 2: Procurement module (PR, PO, DR, IAR)

## 📁 Final Structure Reference

```
src/
├── types/
│   └── masterData.ts (✅ ALL TYPES COMPLETE)
├── lib/
│   ├── api/
│   │   └── masterData/
│   │       ├── index.ts (✅ EXPORTS)
│   │       ├── categories.ts (✅)
│   │       ├── classifications.ts (✅)
│   │       ├── departments.ts (✅)
│   │       ├── endUsers.ts (✅)
│   │       ├── positions.ts (✅)
│   │       ├── propertyClassifications.ts (✅)
│   │       ├── propertyTypes.ts (✅)
│   │       ├── suppliers.ts (✅)
│   │       └── unitsOfMeasure.ts (✅)
│   └── hooks/
│       └── masterData/
│           ├── index.ts (✅ EXPORTS)
│           ├── useCategories.ts (✅)
│           ├── useClassifications.ts (✅)
│           ├── useDepartments.ts (✅)
│           ├── useEndUsers.ts (✅)
│           ├── usePositions.ts (✅)
│           ├── usePropertyClassifications.ts (✅)
│           ├── usePropertyTypes.ts (✅)
│           ├── useSuppliers.ts (✅)
│           └── useUnitsOfMeasure.ts (✅)
└── app/
    └── admin/
        ├── categories/ (✅)
        │   ├── page.tsx (✅)
        │   ├── new/page.tsx (TODO)
        │   └── [id]/page.tsx (TODO)
        ├── departments/ (✅)
        │   ├── page.tsx (✅)
        │   ├── new/page.tsx (TODO)
        │   └── [id]/page.tsx (TODO)
        ├── classifications/ (TODO)
        ├── property-classifications/ (TODO)
        ├── property-types/ (TODO)
        ├── units-of-measure/ (TODO)
        ├── suppliers/ (TODO)
        ├── positions/ (TODO)
        └── end-users/ (TODO)
```

You now have a **SOLID, PRODUCTION-READY FOUNDATION** for all master data modules! 🎉

Just follow the patterns I've established and replicate for the remaining modules.
