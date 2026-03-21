import apiClient from './client';
import { PaginatedResponse } from '@/types/assetIssuance';
import {
    PropertyTransfer,
    PropertyTransferCreatePayload,
    PropertyTransferActionResponse,
    PropertyTransferCompletePayload,
    PropertyTransferReleasingReviewPayload,
    TransferableItem,
    TransferDepartment,
    TransferEndUser,
} from '@/types/propertyTransfer';

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
    unitOfMeasure?: { UnitName?: string | null } | null;
    unit_of_measure?: { UnitName?: string | null } | null;
    inventory?: {
        InventoryNumber?: string | null;
        DateReceived?: string | null;
        DateAcquired?: string | null;
    } | null;
    drDetail?: {
        ItemDescription?: string | null;
        SerialNumber?: string | null;
        article?: {
            ArticleName?: string | null;
        } | null;
    } | null;
    dr_detail?: {
        ItemDescription?: string | null;
        SerialNumber?: string | null;
        article?: {
            ArticleName?: string | null;
        } | null;
    } | null;
}

interface RawTransferItem {
    TransferItemID?: number;
    TransferID?: number;
    InventoryDetailID?: number;
    Quantity?: number;
    Remarks?: string | null;
    inventoryDetail?: RawInventoryDetail | null;
    inventory_detail?: RawInventoryDetail | null;
}

interface RawTransfer {
    TransferID: number;
    TransferNumber: string;
    RequestedByUserID: number;
    FromDepartmentID: number;
    ToDepartmentID: number;
    FromEndUserID?: number | null;
    ToEndUserID?: number | null;
    Reason?: string | null;
    RequestedItemsCount?: number | null;
    ReleasingDecision?: 'pending' | 'approved' | 'rejected';
    ReleasingApprovedCount?: number | null;
    ReleasingDecisionReason?: string | null;
    ReleasingReviewedByUserID?: number | null;
    ReleasingReviewedAt?: string | null;
    Status: PropertyTransfer['Status'];
    ApprovedByUserID?: number | null;
    ApprovedAt?: string | null;
    CompletedByUserID?: number | null;
    CompletedAt?: string | null;
    BorrowerSignedAt?: string | null;
    BorrowingSignedAt?: string | null;
    GsoNotes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    items_count?: number;
    items?: RawTransferItem[];
    requestedBy?: RawUser | null;
    requested_by?: RawUser | null;
    releasingReviewedBy?: RawUser | null;
    releasing_reviewed_by?: RawUser | null;
    approvedBy?: RawUser | null;
    approved_by?: RawUser | null;
    completedBy?: RawUser | null;
    completed_by?: RawUser | null;
    fromDepartment?: RawDepartment | null;
    from_department?: RawDepartment | null;
    toDepartment?: RawDepartment | null;
    to_department?: RawDepartment | null;
    fromEndUser?: RawEndUser | null;
    from_end_user?: RawEndUser | null;
    toEndUser?: RawEndUser | null;
    to_end_user?: RawEndUser | null;
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
    return {
        InventoryDetailID: inventoryDetail.InventoryDetailID ?? 0,
        PropertyNumber: inventoryDetail.PropertyNumber ?? null,
        Description: inventoryDetail.Description ?? null,
        Brand: inventoryDetail.Brand ?? null,
        ModelNumber: inventoryDetail.ModelNumber ?? null,
        SerialNumber: inventoryDetail.SerialNumber ?? null,
        UnitCost: inventoryDetail.UnitCost ?? null,
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
                SerialNumber: drDetail.SerialNumber ?? null,
                article: drDetail.article
                    ? {
                        ArticleName: drDetail.article.ArticleName ?? null,
                    }
                    : null,
            }
            : null,
    };
};

const normalizeTransfer = (transfer: RawTransfer): PropertyTransfer => {
    const requestedBy = transfer.requestedBy ?? transfer.requested_by ?? null;
    const approvedBy = transfer.approvedBy ?? transfer.approved_by ?? null;
    const completedBy = transfer.completedBy ?? transfer.completed_by ?? null;
    const releasingReviewedBy = transfer.releasingReviewedBy ?? transfer.releasing_reviewed_by ?? null;
    const fromDepartment = transfer.fromDepartment ?? transfer.from_department ?? null;
    const toDepartment = transfer.toDepartment ?? transfer.to_department ?? null;
    const fromEndUser = transfer.fromEndUser ?? transfer.from_end_user ?? null;
    const toEndUser = transfer.toEndUser ?? transfer.to_end_user ?? null;

    return {
        TransferID: transfer.TransferID,
        TransferNumber: transfer.TransferNumber,
        RequestedByUserID: transfer.RequestedByUserID,
        FromDepartmentID: transfer.FromDepartmentID,
        ToDepartmentID: transfer.ToDepartmentID,
        FromEndUserID: transfer.FromEndUserID ?? null,
        ToEndUserID: transfer.ToEndUserID ?? null,
        Reason: transfer.Reason ?? null,
        RequestedItemsCount: transfer.RequestedItemsCount ?? null,
        ReleasingDecision: transfer.ReleasingDecision ?? 'pending',
        ReleasingApprovedCount: transfer.ReleasingApprovedCount ?? null,
        ReleasingDecisionReason: transfer.ReleasingDecisionReason ?? null,
        ReleasingReviewedByUserID: transfer.ReleasingReviewedByUserID ?? null,
        ReleasingReviewedAt: transfer.ReleasingReviewedAt ?? null,
        Status: transfer.Status,
        ApprovedByUserID: transfer.ApprovedByUserID ?? null,
        ApprovedAt: transfer.ApprovedAt ?? null,
        CompletedByUserID: transfer.CompletedByUserID ?? null,
        CompletedAt: transfer.CompletedAt ?? null,
        BorrowerSignedAt: transfer.BorrowerSignedAt ?? null,
        BorrowingSignedAt: transfer.BorrowingSignedAt ?? null,
        GsoNotes: transfer.GsoNotes ?? null,
        created_at: transfer.created_at ?? null,
        updated_at: transfer.updated_at ?? null,
        items_count: transfer.items_count,
        items: (transfer.items ?? []).map((item) => ({
            TransferItemID: item.TransferItemID ?? 0,
            TransferID: item.TransferID ?? transfer.TransferID,
            InventoryDetailID: item.InventoryDetailID ?? 0,
            Quantity: item.Quantity ?? 1,
            Remarks: item.Remarks ?? null,
            inventoryDetail: normalizeInventoryDetail(item.inventoryDetail ?? item.inventory_detail),
        })),
        requestedBy: normalizeUser(requestedBy),
        releasingReviewedBy: normalizeUser(releasingReviewedBy),
        approvedBy: normalizeUser(approvedBy),
        completedBy: normalizeUser(completedBy),
        fromDepartment: normalizeDepartment(fromDepartment),
        toDepartment: normalizeDepartment(toDepartment),
        fromEndUser: normalizeEndUser(fromEndUser),
        toEndUser: normalizeEndUser(toEndUser),
    };
};

interface TransferFilters {
    status?: PropertyTransfer['Status'];
    search?: string;
    scope?: 'incoming' | 'outgoing';
    per_page?: number;
    page?: number;
}

interface TransferableItemFilters {
    search?: string;
    from_department_id?: number;
    from_end_user_id?: number;
    per_page?: number;
    page?: number;
}

const transferAPI = {
    getAll: async (filters?: TransferFilters) => {
        const { data } = await apiClient.get<PaginatedResponse<RawTransfer>>('/property-transfers', {
            params: filters,
        });
        return {
            ...data,
            data: (data.data || []).map(normalizeTransfer),
        } as PaginatedResponse<PropertyTransfer>;
    },

    getById: async (id: number) => {
        const { data } = await apiClient.get<RawTransfer>(`/property-transfers/${id}`);
        return normalizeTransfer(data);
    },

    create: async (payload: PropertyTransferCreatePayload) => {
        const { data } = await apiClient.post<{ message: string; transfer: RawTransfer }>(
            '/property-transfers',
            payload
        );
        return {
            ...data,
            transfer: normalizeTransfer(data.transfer),
        };
    },

    approve: async (id: number) => {
        const { data } = await apiClient.post<{ message: string; transfer: RawTransfer }>(`/property-transfers/${id}/approve`);
        return {
            ...data,
            transfer: normalizeTransfer(data.transfer),
        } as PropertyTransferActionResponse;
    },

    reject: async (id: number, payload?: { notes?: string | null }) => {
        const { data } = await apiClient.post<{ message: string; transfer: RawTransfer }>(
            `/property-transfers/${id}/reject`,
            payload || {}
        );
        return {
            ...data,
            transfer: normalizeTransfer(data.transfer),
        } as PropertyTransferActionResponse;
    },

    complete: async (id: number, payload: PropertyTransferCompletePayload) => {
        const { data } = await apiClient.post<{ message: string; transfer: RawTransfer }>(
            `/property-transfers/${id}/complete`,
            payload
        );
        return {
            ...data,
            transfer: normalizeTransfer(data.transfer),
        } as PropertyTransferActionResponse;
    },

    releasingReview: async (id: number, payload: PropertyTransferReleasingReviewPayload) => {
        const { data } = await apiClient.post<{ message: string; transfer: RawTransfer }>(
            `/property-transfers/${id}/releasing-review`,
            payload
        );
        return {
            ...data,
            transfer: normalizeTransfer(data.transfer),
        } as PropertyTransferActionResponse;
    },

    signReleasing: async (id: number) => {
        const { data } = await apiClient.post<{ message: string; transfer: RawTransfer }>(
            `/property-transfers/${id}/sign-releasing`
        );
        return {
            ...data,
            transfer: normalizeTransfer(data.transfer),
        } as PropertyTransferActionResponse;
    },

    signReceiving: async (id: number) => {
        const { data } = await apiClient.post<{ message: string; transfer: RawTransfer }>(
            `/property-transfers/${id}/sign-receiving`
        );
        return {
            ...data,
            transfer: normalizeTransfer(data.transfer),
        } as PropertyTransferActionResponse;
    },

    getAvailableItems: async (filters?: TransferableItemFilters) => {
        const { data } = await apiClient.get<PaginatedResponse<TransferableItem>>(
            '/property-transfers/available-items',
            { params: filters }
        );
        return data;
    },

    getDepartments: async () => {
        const { data } = await apiClient.get<TransferDepartment[]>('/property-transfers/helpers/departments');
        return data;
    },

    getEndUsers: async (departmentId?: number, options?: { excludeGso?: boolean }) => {
        const params: Record<string, number | boolean> = {};
        if (departmentId) {
            params.department_id = departmentId;
        }
        if (options?.excludeGso) {
            params.exclude_gso = true;
        }

        const { data } = await apiClient.get<TransferEndUser[]>('/property-transfers/helpers/end-users', {
            params: Object.keys(params).length ? params : undefined,
        });
        return data;
    },
};

export default transferAPI;
