import apiClient from '@/lib/api/client';

export async function listBackups() {
    const res = await apiClient.get('/admin/backups');
    return res.data;
}

export async function createBackup() {
    const res = await apiClient.post('/admin/backups');
    return res.data;
}

export async function downloadBackup(name: string) {
    // returns a blob
    const res = await apiClient.get(`/admin/backups/${encodeURIComponent(name)}`, {
        responseType: 'blob',
    });
    return res.data;
}

export async function getBackupStatus() {
    const res = await apiClient.get('/admin/backups/status');
    return res.data;
}

export async function restoreBackup(name: string) {
    const res = await apiClient.post(`/admin/backups/${encodeURIComponent(name)}/restore`);
    return res.data;
}

export async function saveBackupSettings(payload: { frequency: string; time: string; retention_days?: number }) {
    const res = await apiClient.post('/admin/backups/settings', payload);
    return res.data;
}

export async function deleteBackup(name: string) {
    const res = await apiClient.delete(`/admin/backups/${encodeURIComponent(name)}`);
    return res.data;
}

export async function triggerScheduledBackup() {
    const res = await apiClient.post('/admin/backups/trigger');
    return res.data;
}
