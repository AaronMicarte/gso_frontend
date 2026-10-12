export const DEPT_HEAD_POSITION_TITLE = 'Department Head';

export function isDeptHeadReceiverSuggestion(suggestion: {
    receiver_name?: string;
    position_office?: string | null;
}): boolean {
    return (suggestion.position_office || '').trim().toLowerCase() === DEPT_HEAD_POSITION_TITLE.toLowerCase();
}

export function formatAssignmentOfficeName(departmentName?: string | null): string {
    return (departmentName || '').trim();
}

export function buildDeptHeadAssignment(requester: {
    FullName: string;
    DepartmentName?: string | null;
}): {
    assign_to_dept_head: true;
    receiver_name: string;
    position_office: string;
    office_name: string;
} {
    return {
        assign_to_dept_head: true,
        receiver_name: requester.FullName,
        position_office: DEPT_HEAD_POSITION_TITLE,
        office_name: formatAssignmentOfficeName(requester.DepartmentName),
    };
}

export function inferDeptHeadAssignment(
    row: {
        receiver_name?: string;
        position_office?: string;
        office_name?: string;
        is_department_head?: boolean;
        assign_to_dept_head?: boolean;
    },
    requester?: { FullName?: string } | null
): boolean {
    if (row.is_department_head || row.assign_to_dept_head) {
        return true;
    }
    if (!requester?.FullName) {
        return false;
    }
    const position = (row.position_office || '').trim().toLowerCase();
    if (position !== DEPT_HEAD_POSITION_TITLE.toLowerCase()) {
        return false;
    }
    return (
        (row.receiver_name || '').trim().toLowerCase()
        === requester.FullName.trim().toLowerCase()
    );
}

export function formatAssignmentPositionDisplay(positionOffice?: string | null, officeName?: string | null): string {
    const position = (positionOffice || '').trim();
    const office = (officeName || '').trim();
    if (position && office) {
        return `${position}\n${office}`;
    }
    return position || office;
}

export function formatAssignmentPositionInline(positionOffice?: string | null, officeName?: string | null): string {
    const position = (positionOffice || '').trim();
    const office = (officeName || '').trim();
    if (position && office) {
        return `${position} / ${office}`;
    }
    return position || office;
}

/** PAR/ICS Position/Office line — dept head shows department name only (e.g. Accounting). */
export function formatAssignmentPositionForPrint(
    positionOffice?: string | null,
    officeName?: string | null,
    isDepartmentHead?: boolean
): string {
    const position = (positionOffice || '').trim();
    const office = (officeName || '').trim();
    const isDeptHead =
        Boolean(isDepartmentHead)
        || position.toLowerCase() === DEPT_HEAD_POSITION_TITLE.toLowerCase();

    if (isDeptHead) {
        return office;
    }

    // End user: job title only (e.g. Multimedia Artist), not "title / department"
    return position;
}
