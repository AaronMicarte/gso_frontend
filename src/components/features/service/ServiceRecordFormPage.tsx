'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import serviceApi from '@/lib/api/assetServices';
import {
    AssetServiceHandlingDecision,
    ServiceHelperDepartment,
    ServiceHelperEndUser,
    ServiceHelperProvider,
    ServiceInventoryItem,
} from '@/types/assetService';

interface ServiceRecordFormPageProps {
    baseRoute: string;
    recordId?: number;
}

interface ServiceDetailFormState {
    localId: string;
    service_record_detail_id?: number;
    inventory_detail_id: number | '';
    inventory_query: string;
    problem_description: string;
    handling_decision: AssetServiceHandlingDecision | '';
    assigned_provider_key: string;
}

const HANDLING_OPTIONS: AssetServiceHandlingDecision[] = ['warranty', 'no_warranty'];

function makeEmptyDetailState(): ServiceDetailFormState {
    return {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        inventory_detail_id: '',
        inventory_query: '',
        problem_description: '',
        handling_decision: '',
        assigned_provider_key: '',
    };
}

function splitProviderKey(providerKey: string): { assigned_vendor_id: number | null; assigned_supplier_id: number | null } {
    if (!providerKey) {
        return { assigned_vendor_id: null, assigned_supplier_id: null };
    }

    const [providerType, providerIdStr] = providerKey.split(':');
    const providerId = Number(providerIdStr);

    if (!providerType || Number.isNaN(providerId) || providerId <= 0) {
        return { assigned_vendor_id: null, assigned_supplier_id: null };
    }

    if (providerType === 'vendor') {
        return { assigned_vendor_id: providerId, assigned_supplier_id: null };
    }

    if (providerType === 'supplier') {
        return { assigned_vendor_id: null, assigned_supplier_id: providerId };
    }

    return { assigned_vendor_id: null, assigned_supplier_id: null };
}

function makeProviderKey(providerType?: 'vendor' | 'supplier' | null, providerId?: number | null): string {
    if (!providerType || !providerId) {
        return '';
    }

    return `${providerType}:${providerId}`;
}

function inventoryLabel(item: ServiceInventoryItem): string {
    const property = item.PropertyNumber || `ID ${item.InventoryDetailID}`;
    const article = item.dr_article_name || item.Description || 'No article';
    const model = item.ModelNumber || 'No model';
    const brand = item.Brand || 'No brand';
    const serial = item.SerialNumber || 'No serial';
    const supplier = item.SupplierName || 'No supplier';

    return `${property} - ${article} - ${model} - ${brand} - ${serial} - ${supplier}`;
}

function findAutoProviderKey(item: ServiceInventoryItem | undefined, providers: ServiceHelperProvider[]): string {
    if (!item?.SupplierID) {
        return '';
    }

    const matchedSupplier = providers.find((provider) => provider.ProviderType === 'supplier' && provider.ProviderID === item.SupplierID);
    return matchedSupplier ? `supplier:${matchedSupplier.ProviderID}` : '';
}

export function ServiceRecordFormPage({ baseRoute, recordId }: ServiceRecordFormPageProps) {
    const router = useRouter();
    const isEditMode = !!recordId;

    const [loading, setLoading] = useState(false);

    const [providers, setProviders] = useState<ServiceHelperProvider[]>([]);
    const [departments, setDepartments] = useState<ServiceHelperDepartment[]>([]);
    const [departmentHeads, setDepartmentHeads] = useState<ServiceHelperEndUser[]>([]);
    const [inventory, setInventory] = useState<ServiceInventoryItem[]>([]);
    const [openInventoryForDetail, setOpenInventoryForDetail] = useState<string | null>(null);

    const [dateReported, setDateReported] = useState(() => new Date().toISOString().split('T')[0]);
    const [reportSourceId, setReportSourceId] = useState<number | ''>('');
    const [recordNotes, setRecordNotes] = useState('');
    const [details, setDetails] = useState<ServiceDetailFormState[]>([makeEmptyDetailState()]);

    useEffect(() => {
        const loadHelpers = async () => {
            try {
                const [providerRows, departmentRows, departmentHeadRows] = await Promise.all([
                    serviceApi.getProviders(),
                    serviceApi.getDepartments(),
                    serviceApi.getDepartmentHeads(),
                ]);
                setProviders(providerRows);
                setDepartments(departmentRows);
                setDepartmentHeads(departmentHeadRows);
            } catch {
                toast.error('Failed to load form helpers');
            }
        };

        loadHelpers();
    }, []);

    useEffect(() => {
        const run = async () => {
            if (!reportSourceId) {
                setInventory([]);
                return;
            }
            try {
                const items = await serviceApi.getInventory(undefined, Number(reportSourceId));
                setInventory(items);
            } catch {
                toast.error('Failed to load inventory items');
            }
        };

        run();
    }, [reportSourceId]);

    useEffect(() => {
        const run = async () => {
            if (!isEditMode || !recordId) return;
            try {
                setLoading(true);
                const data = await serviceApi.getById(recordId);

                setDateReported(data.DateReported || '');
                setReportSourceId(data.ReportSource || '');
                setRecordNotes(data.RecordNotes || '');

                const mappedDetails: ServiceDetailFormState[] = (data.details || []).map((detail): ServiceDetailFormState => ({
                    localId: `${detail.ServiceRecordDetailID}-${Math.random().toString(36).slice(2, 8)}`,
                    service_record_detail_id: detail.ServiceRecordDetailID,
                    inventory_detail_id: detail.InventoryDetailID ? Number(detail.InventoryDetailID) : '',
                    inventory_query: `${detail.PropertyNumber || `ID ${detail.InventoryDetailID}`} - ${detail.ItemDescription || 'No description'}`,
                    problem_description: detail.ProblemDescription || '',
                    handling_decision: (detail.HandlingDecision as AssetServiceHandlingDecision) || '',
                    assigned_provider_key: makeProviderKey(detail.assigned_provider_type, detail.assigned_provider_id),
                }));

                setDetails(mappedDetails.length > 0 ? mappedDetails : [makeEmptyDetailState()]);
            } catch {
                toast.error('Failed to load service record');
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [isEditMode, recordId]);

    const updateDetailField = <K extends keyof ServiceDetailFormState>(localId: string, key: K, value: ServiceDetailFormState[K]) => {
        setDetails((prev) => prev.map((detail) => (detail.localId === localId ? { ...detail, [key]: value } : detail)));
    };

    const selectInventoryForDetail = (localId: string, inventoryIdValue: string) => {
        const inventoryId = inventoryIdValue ? Number(inventoryIdValue) : '';
        const selectedInventory = inventory.find((item) => item.InventoryDetailID === Number(inventoryId));
        const otherSelectedInventoryIds = new Set(details
            .filter((d) => d.localId !== localId)
            .map((d) => Number(d.inventory_detail_id))
            .filter((id) => id > 0)
        );

        if (selectedInventory && otherSelectedInventoryIds.has(selectedInventory.InventoryDetailID)) {
            toast.error('This inventory item is already selected in another detail');
            return;
        }

        setDetails((prev) => prev.map((detail) => {
            if (detail.localId !== localId) {
                return detail;
            }

            const autoProvider = findAutoProviderKey(selectedInventory, providers);
            return {
                ...detail,
                inventory_detail_id: inventoryId,
                inventory_query: selectedInventory ? inventoryLabel(selectedInventory) : '',
                assigned_provider_key: autoProvider || detail.assigned_provider_key,
            };
        }));

        setOpenInventoryForDetail(null);
    };

    const updateInventoryQueryForDetail = (localId: string, query: string) => {
        setDetails((prev) => prev.map((detail) => {
            if (detail.localId !== localId) {
                return detail;
            }

            const selectedInventory = inventory.find((item) => item.InventoryDetailID === Number(detail.inventory_detail_id));
            const selectedLabel = selectedInventory ? inventoryLabel(selectedInventory) : '';

            return {
                ...detail,
                inventory_query: query,
                inventory_detail_id: selectedLabel && query !== selectedLabel ? '' : detail.inventory_detail_id,
            };
        }));
    };

    const canEditDetails = Boolean(reportSourceId);

    const updateHandlingDecision = (localId: string, value: AssetServiceHandlingDecision | '') => {
        setDetails((prev) => prev.map((detail) => {
            if (detail.localId !== localId) {
                return detail;
            }

            return {
                ...detail,
                handling_decision: value,
            };
        }));
    };

    const addDetail = () => {
        if (!canEditDetails) {
            toast.error('Please select the report source department first');
            return;
        }

        setDetails((prev) => [...prev, makeEmptyDetailState()]);
    };

    const removeDetail = (localId: string) => {
        setDetails((prev) => {
            if (prev.length <= 1) {
                return prev;
            }
            return prev.filter((detail) => detail.localId !== localId);
        });
    };

    const minDate = useMemo(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().split('T')[0];
    }, []);

    const maxDate = useMemo(() => new Date().toISOString().split('T')[0], []);

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!reportSourceId) {
            toast.error('Report source department is required');
            return;
        }

        if (details.length === 0) {
            toast.error('At least one service detail is required');
            return;
        }

        const hasInvalidDetail = details.some((detail) => !detail.inventory_detail_id || !detail.problem_description.trim());
        if (hasInvalidDetail) {
            toast.error('Each detail must have an inventory item and problem description');
            return;
        }

        for (const detail of details) {
            if (!detail.handling_decision) {
                toast.error('Handling decision is required for each detail');
                return;
            }

            if (!detail.assigned_provider_key) {
                toast.error('Service vendor or supplier is required for each detail');
                return;
            }
        }

        const payload = {
            date_reported: dateReported,
            report_source_id: Number(reportSourceId),
            record_notes: recordNotes || undefined,
            details: details.map((detail) => {
                const provider = splitProviderKey(detail.assigned_provider_key);
                const isWarrantyClaim = detail.handling_decision === 'warranty';

                return {
                    service_record_detail_id: detail.service_record_detail_id,
                    inventory_detail_id: Number(detail.inventory_detail_id),
                    problem_description: detail.problem_description,
                    handling_decision: detail.handling_decision || undefined,
                    budget_status: isWarrantyClaim ? ('warranty_covered' as const) : ('budget_available' as const),
                    status: 'pending' as const,
                    assigned_vendor_id: provider.assigned_vendor_id,
                    assigned_supplier_id: provider.assigned_supplier_id,
                    actual_cost: null,
                };
            }),
        };

        try {
            setLoading(true);
            if (isEditMode && recordId) {
                await serviceApi.update(recordId, payload);
                toast.success('Service record updated');
                router.push(`${baseRoute}/${recordId}`);
            } else {
                const created = await serviceApi.create(payload);
                toast.success('Service record created');
                router.push(`${baseRoute}/${created.record.ServiceRecordID}`);
            }
        } catch (error: unknown) {
            const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || 'Failed to save service record');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen print:hidden relative bg-app bg-fixed bg-center bg-cover">
            <div className="sticky top-0 z-10">
                <div className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                                {isEditMode ? 'Edit Service Record' : 'New Service Record'}
                            </h1>
                            <p className="text-sm text-slate-500">Repair and service transaction details</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-10 max-w-[1700px] mx-auto w-full">
                <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Date Reported</label>
                            <input
                                type="date"
                                value={dateReported}
                                min={minDate}
                                max={maxDate}
                                onChange={(e) => setDateReported(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">Only dates within the last 1 year are allowed.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Record Status</label>
                            <input
                                value="Pending"
                                readOnly
                                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-700"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Report Source Department</label>
                            <select
                                value={reportSourceId}
                                onChange={(e) => setReportSourceId(e.target.value ? Number(e.target.value) : '')}
                                className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-slate-700"
                                required
                            >
                                <option value="">Select department</option>
                                {departments.map((department) => {
                                    const head = departmentHeads.find((user) => user.DepartmentID === department.DepartmentID);
                                    return (
                                        <option key={department.DepartmentID} value={department.DepartmentID}>
                                            {head ? `${head.FullName} - ${department.DepartmentName || department.DepartmentCode}` : (department.DepartmentName || department.DepartmentCode)}
                                        </option>
                                    );
                                })}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">Select which department the report came from.</p>
                            {reportSourceId && (
                                <p className="text-sm text-slate-700 mt-2">
                                    {(() => {
                                        const selectedDept = departments.find((d) => d.DepartmentID === reportSourceId);
                                        const head = departmentHeads.find((user) => user.DepartmentID === reportSourceId);
                                        if (head && selectedDept) {
                                            return `Selected: ${head.FullName} - ${selectedDept.DepartmentName || selectedDept.DepartmentCode}`;
                                        }
                                        return selectedDept ? `Selected: ${selectedDept.DepartmentName || selectedDept.DepartmentCode}` : '';
                                    })()}
                                </p>
                            )}
                            {!reportSourceId && (
                                <p className="text-sm text-red-600 mt-2">Please select the report source department before filling service details.</p>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-slate-800">Service Details</h2>
                            <button
                                type="button"
                                onClick={addDetail}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 bg-white/90 hover:bg-slate-50"
                            >
                                <Plus className="w-4 h-4" />
                                Add Detail Row
                            </button>
                        </div>

                        <div className="space-y-5 relative">
                            {!canEditDetails && (
                                <button
                                    type="button"
                                    onClick={() => toast.error('Select a report source department first')}
                                    className="absolute inset-0 z-30 w-full h-full bg-transparent"
                                />
                            )}
                            {details.map((detail, index) => {
                                const selectedInventory = inventory.find((item) => item.InventoryDetailID === Number(detail.inventory_detail_id));
                                const otherSelectedInventoryIds = new Set(
                                    details
                                        .filter((d) => d.localId !== detail.localId)
                                        .map((d) => Number(d.inventory_detail_id))
                                        .filter((id) => id > 0)
                                );
                                const inventoryQuery = detail.inventory_query.trim().toLowerCase();
                                const filteredInventory = (inventoryQuery
                                    ? inventory.filter((item) => inventoryLabel(item).toLowerCase().includes(inventoryQuery))
                                    : inventory
                                ).filter((item) => !otherSelectedInventoryIds.has(item.InventoryDetailID));

                                return (
                                    <div key={detail.localId} className="rounded-xl border border-slate-200 p-5 sm:p-6 bg-white shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">Detail #{index + 1}</h3>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!canEditDetails) {
                                                        toast.error('Please select the report source department first');
                                                        return;
                                                    }
                                                    removeDetail(detail.localId);
                                                }}
                                                disabled={details.length <= 1 || !canEditDetails}
                                                className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-40"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Remove
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Inventory Item</label>
                                                <div className="relative">
                                                    <input
                                                        value={detail.inventory_query}
                                                        onChange={(e) => updateInventoryQueryForDetail(detail.localId, e.target.value)}
                                                        onFocus={() => {
                                                            if (!canEditDetails) {
                                                                toast.error('Please select the report source department first');
                                                                return;
                                                            }
                                                            setOpenInventoryForDetail(detail.localId);
                                                        }}
                                                        onBlur={() => {
                                                            window.setTimeout(() => {
                                                                setOpenInventoryForDetail((current) => (current === detail.localId ? null : current));
                                                            }, 120);
                                                        }}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                        placeholder="Search inventory item"
                                                        disabled={!canEditDetails}
                                                    />
                                                    {openInventoryForDetail === detail.localId && (
                                                        <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                                                            {filteredInventory.length === 0 ? (
                                                                <li className="px-3 py-2 text-sm text-slate-500">No matching inventory item</li>
                                                            ) : (
                                                                filteredInventory.map((item) => {
                                                                    const duplicate = otherSelectedInventoryIds.has(item.InventoryDetailID);
                                                                    return (
                                                                        <li
                                                                            key={item.InventoryDetailID}
                                                                            role="option"
                                                                            aria-selected={Number(detail.inventory_detail_id) === item.InventoryDetailID}
                                                                            onMouseDown={(event) => {
                                                                                event.preventDefault();
                                                                                if (duplicate) {
                                                                                    toast.error('This inventory item is already selected in another detail');
                                                                                    return;
                                                                                }
                                                                                selectInventoryForDetail(detail.localId, String(item.InventoryDetailID));
                                                                            }}
                                                                            className={`px-3 py-2 text-sm ${duplicate ? 'text-slate-400 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'}`}
                                                                        >
                                                                            {inventoryLabel(item)}
                                                                            {duplicate && ' (already selected)'}
                                                                        </li>
                                                                    );
                                                                })
                                                            )}
                                                        </ul>
                                                    )}
                                                </div>
                                                {selectedInventory && (
                                                    <p className="text-xs text-slate-500 mt-2">
                                                        Selected: {inventoryLabel(selectedInventory)}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">Handling Decision</label>
                                                    <select
                                                        value={detail.handling_decision}
                                                        onChange={(e) => updateHandlingDecision(detail.localId, e.target.value as AssetServiceHandlingDecision | '')}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                        disabled={!canEditDetails}
                                                        required
                                                    >
                                                        <option value="">Select decision</option>
                                                        {HANDLING_OPTIONS.map((option) => (
                                                            <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">Service Vendor / Supplier</label>
                                                    <select
                                                        value={detail.assigned_provider_key}
                                                        onChange={(e) => updateDetailField(detail.localId, 'assigned_provider_key', e.target.value)}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                        disabled={!canEditDetails || !detail.handling_decision}
                                                    >
                                                        <option value="">Select vendor or supplier</option>
                                                        {providers.map((provider) => (
                                                            <option key={`${provider.ProviderType}:${provider.ProviderID}`} value={`${provider.ProviderType}:${provider.ProviderID}`}>
                                                                {provider.ProviderName} ({provider.ProviderType})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p className="text-xs text-slate-500 mt-1">Auto-defaults to inventory supplier when available.</p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">Detail Status</label>
                                                    <input
                                                        value="pending"
                                                        readOnly
                                                        className="w-full px-3 py-2 border border-slate-300 bg-slate-100 text-slate-800 rounded-lg"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Problem Description</label>
                                            <textarea
                                                value={detail.problem_description}
                                                onChange={(e) => updateDetailField(detail.localId, 'problem_description', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                                rows={3}
                                                disabled={!canEditDetails}
                                                required
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="relative">
                        {!canEditDetails && (
                            <button
                                type="button"
                                onClick={() => toast.error('Select a report source department first')}
                                className="absolute inset-0 z-30 w-full h-full bg-transparent"
                            />
                        )}

                        <label className="block text-sm font-medium text-slate-700 mb-2">Record Notes</label>
                        <textarea
                            value={recordNotes}
                            onChange={(e) => setRecordNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            rows={3}
                            disabled={!canEditDetails}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
                        <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50">
                            <Save className="w-4 h-4" />
                            {loading ? 'Saving...' : isEditMode ? 'Update Service Record' : 'Create Service Record'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ServiceRecordFormPage;
