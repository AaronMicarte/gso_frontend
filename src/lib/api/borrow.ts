import apiClient from './client';
import { PaginatedResponse } from '@/types/assetIssuance';
import {
    PropertyBorrow,
    PropertyBorrowCreatePayload,
    PropertyBorrowActionResponse,
    PropertyBorrowReturnPayload,
    PropertyBorrowReleasingReviewPayload,
    PropertyBorrowReturn,
    BorrowCondition,
    BorrowableItem,
    BorrowDepartment,
    BorrowEndUser,
    BorrowAllowedPropertyType,
} from '@/types/propertyBorrow';

interface RawDepartment {
    DepartmentID?: number;
    DepartmentName?: string | null;
    DepartmentCode?: string | null;
}

interface RawEndUser {
    EndUserID?: number;
    FullName?: string | null;
    DepartmentID?: number | null;
    DepartmentName?: string | null;
    department?: RawDepartment | null;
}

interface RawUser {
    UserID?: number;
    FullName?: string | null;
    DepartmentID?: number | null;
    department?: RawDepartment | null;
}

interface RawInventoryDetail {
    InventoryDetailID?: number;
    PropertyNumber?: string | null;
    Description?: string | null;
    Brand?: string | null;
    ModelNumber?: string | null;
    SerialNumber?: string | null;
    UnitCost?: number | null;
    propertyType?: {
        PropertyTypeID?: number | null;
        PropertyName?: string | null;
    } | null;
    property_type?: {
        PropertyTypeID?: number | null;
        PropertyName?: string | null;
    } | null;
    unitOfMeasure?: { UnitName?: string | null } | null;
    unit_of_measure?: { UnitName?: string | null } | null;
    inventory?: {
        InventoryNumber?: string | null;
        DateReceived?: string | null;
        DateAcquired?: string | null;
    } | null;
    drDetail?: {
        ItemDescription?: string | null;
        article?: {
            ArticleName?: string | null;
        } | null;
    } | null;
    dr_detail?: {
        ItemDescription?: string | null;
        article?: {
            ArticleName?: string | null;
        } | null;
    } | null;
}

interface RawBorrowItem {
    BorrowItemID?: number;
    BorrowID?: number;
    InventoryDetailID?: number;
    Quantity?: number;
    Remarks?: string | null;
    inventoryDetail?: RawInventoryDetail | null;
    inventory_detail?: RawInventoryDetail | null;
}

interface RawReturnItem {
    ReturnItemID?: number;
    ReturnID?: number;
    BorrowItemID?: number;
    InventoryDetailID?: number;
    QuantityReturned?: number;
    ConditionID?: number | null;
    Remarks?: string | null;
    inventoryDetail?: RawInventoryDetail | null;
    inventory_detail?: RawInventoryDetail | null;
    borrowItem?: RawBorrowItem | null;
    borrow_item?: RawBorrowItem | null;
    condition?: { ConditionID?: number; ConditionName?: string | null } | null;
}

interface RawReturn {
    ReturnID?: number;
    ReturnNumber?: string;
    BorrowID?: number;
    ReturnedByUserID?: number;
    ReturnedAt?: string | null;
    Notes?: string | null;
    created_at?: string | null;
    returnedBy?: RawUser | null;
    returned_by?: RawUser | null;
    items?: RawReturnItem[];
}

interface RawBorrow {
    BorrowID: number;
    BorrowNumber: string;
    RequestedByUserID: number;
    FromDepartmentID: number;
    ToDepartmentID: number;
    FromEndUserID?: number | null;
    ToEndUserID?: number | null;
    Purpose?: string | null;
    RequestedItemsCount?: number | null;
    DueDate: string;
    ReleasingDecision?: 'pending' | 'approved' | 'rejected';
    ReleasingApprovedCount?: number | null;
    ReleasingDecisionReason?: string | null;
    ReleasingReviewedByUserID?: number | null;
    ReleasingReviewedAt?: string | null;
    Status: PropertyBorrow['Status'];
    ApprovedByUserID?: number | null;
    ApprovedAt?: string | null;
    BorrowedAt?: string | null;
    GsoNotes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    items_count?: number;
    items?: RawBorrowItem[];
    requestedBy?: RawUser | null;
    requested_by?: RawUser | null;
    releasingReviewedBy?: RawUser | null;
    releasing_reviewed_by?: RawUser | null;
    approvedBy?: RawUser | null;
    approved_by?: RawUser | null;
    fromDepartment?: RawDepartment | null;
    from_department?: RawDepartment | null;
    toDepartment?: RawDepartment | null;
    to_department?: RawDepartment | null;
    fromEndUser?: RawEndUser | null;
    from_end_user?: RawEndUser | null;
    toEndUser?: RawEndUser | null;
    to_end_user?: RawEndUser | null;
    returns?: RawReturn[];
}

const normalizeDepartment = (department?: RawDepartment | null) => {
    if (!department) return null;
    return {
        DepartmentID: department.DepartmentID ?? 0,
        DepartmentName: department.DepartmentName ?? '',
        DepartmentCode: department.DepartmentCode ?? null,
    };
};

const normalizeEndUser = (endUser?: RawEndUser | null) => {
    if (!endUser) return null;
    const departmentName = endUser.DepartmentName ?? endUser.department?.DepartmentName ?? null;
    return {
        EndUserID: endUser.EndUserID ?? 0,
        FullName: endUser.FullName ?? '',
        DepartmentID: endUser.DepartmentID ?? null,
        DepartmentName: departmentName,
    };
};

const normalizeUser = (user?: RawUser | null) => {
    if (!user) return null;
    return {
        UserID: user.UserID ?? 0,
        FullName: user.FullName ?? '',
        DepartmentID: user.DepartmentID ?? null,
        department: normalizeDepartment(user.department),
    };
};

const normalizeInventoryDetail = (inventoryDetail?: RawInventoryDetail | null) => {
    if (!inventoryDetail) return null;
    const unitOfMeasure = inventoryDetail.unitOfMeasure ?? inventoryDetail.unit_of_measure ?? null;
    const drDetail = inventoryDetail.drDetail ?? inventoryDetail.dr_detail ?? null;
    const propertyType = inventoryDetail.propertyType ?? inventoryDetail.property_type ?? null;

    return {
        InventoryDetailID: inventoryDetail.InventoryDetailID ?? 0,
        PropertyNumber: inventoryDetail.PropertyNumber ?? null,
        Description: inventoryDetail.Description ?? null,
        Brand: inventoryDetail.Brand ?? null,
        ModelNumber: inventoryDetail.ModelNumber ?? null,
        SerialNumber: inventoryDetail.SerialNumber ?? null,
        UnitCost: inventoryDetail.UnitCost ?? null,
        propertyType: propertyType
            ? {
                PropertyTypeID: propertyType.PropertyTypeID ?? null,
                PropertyName: propertyType.PropertyName ?? null,
            }
            : null,
        unitOfMeasure: unitOfMeasure
            ? {
                UnitName: unitOfMeasure.UnitName ?? null,
            }
            : null,
        inventory: inventoryDetail.inventory
            ? {
                InventoryNumber: inventoryDetail.inventory.InventoryNumber ?? null,
                DateReceived: inventoryDetail.inventory.DateReceived ?? null,
                DateAcquired: inventoryDetail.inventory.DateAcquired ?? null,
            }
            : null,
        drDetail: drDetail
            ? {
                ItemDescription: drDetail.ItemDescription ?? null,
                article: drDetail.article
                    ? {
                        ArticleName: drDetail.article.ArticleName ?? null,
                    }
                    : null,
            }
            : null,
    };
};

const normalizeReturn = (returnRecord: RawReturn): PropertyBorrowReturn => {
    const returnedBy = returnRecord.returnedBy ?? returnRecord.returned_by ?? null;

    return {
        ReturnID: returnRecord.ReturnID ?? 0,
        ReturnNumber: returnRecord.ReturnNumber ?? '',
        BorrowID: returnRecord.BorrowID ?? 0,
        ReturnedByUserID: returnRecord.ReturnedByUserID ?? 0,
        ReturnedAt: returnRecord.ReturnedAt ?? null,
        Notes: returnRecord.Notes ?? null,
        created_at: returnRecord.created_at ?? null,
        returnedBy: normalizeUser(returnedBy),
        items: (returnRecord.items ?? []).map((item) => ({
            ReturnItemID: item.ReturnItemID ?? 0,
            ReturnID: item.ReturnID ?? returnRecord.ReturnID ?? 0,
            BorrowItemID: item.BorrowItemID ?? 0,
            InventoryDetailID: item.InventoryDetailID ?? 0,
            QuantityReturned: item.QuantityReturned ?? 0,
            ConditionID: item.ConditionID ?? null,
            Remarks: item.Remarks ?? null,
            inventoryDetail: normalizeInventoryDetail(item.inventoryDetail ?? item.inventory_detail),
            borrowItem: item.borrowItem || item.borrow_item
                ? {
                    BorrowItemID: item.borrowItem?.BorrowItemID ?? item.borrow_item?.BorrowItemID ?? 0,
                    BorrowID: item.borrowItem?.BorrowID ?? item.borrow_item?.BorrowID ?? 0,
                    InventoryDetailID: item.borrowItem?.InventoryDetailID ?? item.borrow_item?.InventoryDetailID ?? 0,
                    Quantity: item.borrowItem?.Quantity ?? item.borrow_item?.Quantity ?? 1,
                    Remarks: item.borrowItem?.Remarks ?? item.borrow_item?.Remarks ?? null,
                    inventoryDetail: normalizeInventoryDetail(
                        item.borrowItem?.inventoryDetail
                        ?? item.borrowItem?.inventory_detail
                        ?? item.borrow_item?.inventoryDetail
                        ?? item.borrow_item?.inventory_detail
                    ),
                }
                : null,
            condition: item.condition
                ? {
                    ConditionID: item.condition.ConditionID ?? 0,
                    ConditionName: item.condition.ConditionName ?? '',
                }
                : null,
        })),
    };
};

const normalizeBorrow = (borrow: RawBorrow): PropertyBorrow => {
    const requestedBy = borrow.requestedBy ?? borrow.requested_by ?? null;
    const approvedBy = borrow.approvedBy ?? borrow.approved_by ?? null;
    const releasingReviewedBy = borrow.releasingReviewedBy ?? borrow.releasing_reviewed_by ?? null;
    const fromDepartment = borrow.fromDepartment ?? borrow.from_department ?? null;
    const toDepartment = borrow.toDepartment ?? borrow.to_department ?? null;
    const fromEndUser = borrow.fromEndUser ?? borrow.from_end_user ?? null;
    const toEndUser = borrow.toEndUser ?? borrow.to_end_user ?? null;

    return {
        BorrowID: borrow.BorrowID,
        BorrowNumber: borrow.BorrowNumber,
        RequestedByUserID: borrow.RequestedByUserID,
        FromDepartmentID: borrow.FromDepartmentID,
        ToDepartmentID: borrow.ToDepartmentID,
        FromEndUserID: borrow.FromEndUserID ?? null,
        ToEndUserID: borrow.ToEndUserID ?? null,
        Purpose: borrow.Purpose ?? null,
        RequestedItemsCount: borrow.RequestedItemsCount ?? null,
        DueDate: borrow.DueDate,
        ReleasingDecision: borrow.ReleasingDecision ?? 'pending',
        ReleasingApprovedCount: borrow.ReleasingApprovedCount ?? null,
        ReleasingDecisionReason: borrow.ReleasingDecisionReason ?? null,
        ReleasingReviewedByUserID: borrow.ReleasingReviewedByUserID ?? null,
        ReleasingReviewedAt: borrow.ReleasingReviewedAt ?? null,
        Status: borrow.Status,
        ApprovedByUserID: borrow.ApprovedByUserID ?? null,
        ApprovedAt: borrow.ApprovedAt ?? null,
        BorrowedAt: borrow.BorrowedAt ?? null,
        GsoNotes: borrow.GsoNotes ?? null,
        created_at: borrow.created_at ?? null,
        updated_at: borrow.updated_at ?? null,
        items_count: borrow.items_count,
        items: (borrow.items ?? []).map((item) => ({
            BorrowItemID: item.BorrowItemID ?? 0,
            BorrowID: item.BorrowID ?? borrow.BorrowID,
            InventoryDetailID: item.InventoryDetailID ?? 0,
            Quantity: item.Quantity ?? 1,
            Remarks: item.Remarks ?? null,
            inventoryDetail: normalizeInventoryDetail(item.inventoryDetail ?? item.inventory_detail),
        })),
        requestedBy: normalizeUser(requestedBy),
        releasingReviewedBy: normalizeUser(releasingReviewedBy),
        approvedBy: normalizeUser(approvedBy),
        fromDepartment: normalizeDepartment(fromDepartment),
        toDepartment: normalizeDepartment(toDepartment),
        fromEndUser: normalizeEndUser(fromEndUser),
        toEndUser: normalizeEndUser(toEndUser),
        returns: (borrow.returns ?? []).map(normalizeReturn),
    };
};

interface BorrowFilters {
    status?: PropertyBorrow['Status'];
    search?: string;
    scope?: 'incoming' | 'outgoing';
    per_page?: number;
    page?: number;
}

interface BorrowableItemFilters {
    search?: string;
    from_department_id?: number;
    from_end_user_id?: number;
    per_page?: number;
    page?: number;
}

const borrowAPI = {
    getAll: async (filters?: BorrowFilters) => {
        const { data } = await apiClient.get<PaginatedResponse<RawBorrow>>('/property-borrows', {
            params: filters,
        });
        return {
            ...data,
            data: (data.data || []).map(normalizeBorrow),
        } as PaginatedResponse<PropertyBorrow>;
    },

    getById: async (id: number) => {
        const { data } = await apiClient.get<RawBorrow>(`/property-borrows/${id}`);
        return normalizeBorrow(data);
    },

    create: async (payload: PropertyBorrowCreatePayload) => {
        const { data } = await apiClient.post<{ message: string; borrow: RawBorrow }>(
            '/property-borrows',
            payload
        );
        return {
            ...data,
            borrow: normalizeBorrow(data.borrow),
        };
    },

    approve: async (id: number) => {
        const { data } = await apiClient.post<{ message: string; borrow: RawBorrow }>(`/property-borrows/${id}/approve`);
        return {
            ...data,
            borrow: normalizeBorrow(data.borrow),
        } as PropertyBorrowActionResponse;
    },

    reject: async (id: number, payload?: { notes?: string | null }) => {
        const { data } = await apiClient.post<{ message: string; borrow: RawBorrow }>(
            `/property-borrows/${id}/reject`,
            payload || {}
        );
        return {
            ...data,
            borrow: normalizeBorrow(data.borrow),
        } as PropertyBorrowActionResponse;
    },

    returning: async (id: number, payload: PropertyBorrowReturnPayload) => {
        const { data } = await apiClient.post<{ message: string; borrow: RawBorrow }>(
            `/property-borrows/${id}/return`,
            payload
        );
        return {
            ...data,
            borrow: normalizeBorrow(data.borrow),
        } as PropertyBorrowActionResponse;
    },

    releasingReview: async (id: number, payload: PropertyBorrowReleasingReviewPayload) => {
        const { data } = await apiClient.post<{ message: string; borrow: RawBorrow }>(
            `/property-borrows/${id}/releasing-review`,
            payload
        );
        return {
            ...data,
            borrow: normalizeBorrow(data.borrow),
        } as PropertyBorrowActionResponse;
    },

    getAvailableItems: async (filters?: BorrowableItemFilters) => {
        const { data } = await apiClient.get<PaginatedResponse<BorrowableItem>>(
            '/property-borrows/available-items',
            { params: filters }
        );
        return data;
    },

    getAllowedPropertyTypes: async () => {
        const { data } = await apiClient.get<BorrowAllowedPropertyType[]>(
            '/property-borrows/allowed-property-types'
        );
        return data;
    },

    getDepartments: async () => {
        const { data } = await apiClient.get<BorrowDepartment[]>('/property-borrows/helpers/departments');
        return data;
    },

    getEndUsers: async (departmentId?: number) => {
        const { data } = await apiClient.get<BorrowEndUser[]>('/property-borrows/helpers/end-users', {
            params: departmentId ? { department_id: departmentId } : undefined,
        });
        return data;
    },

    getConditions: async () => {
        const { data } = await apiClient.get<BorrowCondition[]>('/property-borrows/helpers/conditions');
        return data;
    },
};

export default borrowAPI;
