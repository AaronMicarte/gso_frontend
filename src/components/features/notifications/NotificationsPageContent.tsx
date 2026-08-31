'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
    Bell,
    CheckCircle2,
    Circle,
    Clock,
    RefreshCcw,
    Trash2,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    deleteAllNotifications,
    deleteNotification,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    NotificationItem,
} from '@/lib/api/notifications';
import { Dialog } from '@/components/ui/Dialog';

export function NotificationsPageContent() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Pagination & Filter State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const perPage = 25;

    // Delete Confirmation Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);

    const reload = async (page = currentPage, isUnreadFilter = unreadOnly) => {
        setLoading(true);
        try {
            const response = await listNotifications(page, perPage, isUnreadFilter);
            setNotifications(response.data || []);
            setCurrentPage(response.current_page || 1);
            setTotalPages(response.last_page || 1);
            setTotalCount(response.total || 0);
            setUnreadCount(response.unread_count || 0);
        } catch (error) {
            console.error('Failed to load notifications', error);
            toast.error('Unable to load notifications. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void reload(currentPage, unreadOnly);
    }, [currentPage, unreadOnly]);

    const handleFilterChange = (onlyUnread: boolean) => {
        setUnreadOnly(onlyUnread);
        setCurrentPage(1);
    };

    const markOneRead = async (id: number) => {
        setSaving(true);
        try {
            await markNotificationRead(id);
            setNotifications((items) =>
                items.map((item) =>
                    item.UserNotificationID === id ? { ...item, read_at: new Date().toISOString() } : item
                )
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
            toast.success('Notification marked read.');
        } catch (error) {
            toast.error('Failed to mark notification read.');
        } finally {
            setSaving(false);
        }
    };

    const markAllRead = async () => {
        setSaving(true);
        try {
            await markAllNotificationsRead();
            setNotifications((items) => items.map((item) => ({ ...item, read_at: new Date().toISOString() })));
            setUnreadCount(0);
            toast.success('All notifications marked read.');
        } catch (error) {
            toast.error('Failed to mark all notifications read.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteOne = async (id: number) => {
        setSaving(true);
        try {
            await deleteNotification(id);
            setNotifications((items) => items.filter((item) => item.UserNotificationID !== id));
            setTotalCount((prev) => Math.max(0, prev - 1));
            toast.success('Notification deleted.');
            // Reload page if emptied
            if (notifications.length === 1 && currentPage > 1) {
                setCurrentPage((p) => p - 1);
            }
        } catch (error) {
            toast.error('Failed to delete notification.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAll = async () => {
        setIsDeletingAll(true);
        try {
            await deleteAllNotifications();
            setNotifications([]);
            setTotalCount(0);
            setUnreadCount(0);
            setTotalPages(1);
            setCurrentPage(1);
            setDeleteModalOpen(false);
            toast.success('All notifications deleted.');
        } catch (error) {
            toast.error('Failed to delete all notifications.');
        } finally {
            setIsDeletingAll(false);
        }
    };

    const startItem = totalCount === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const endItem = Math.min(currentPage * perPage, totalCount);

    return (
        <main
            className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}
        >
            <div className="max-w-[1700px] mx-auto p-4 sm:p-6 lg:p-8">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Header Banner */}
                    <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
                                    {unreadCount > 0 && (
                                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                            {unreadCount} unread
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    System alerts, status updates, and actionable events.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium">
                                    Total: <span className="font-bold text-slate-800">{totalCount}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Toolbar & Filter Controls */}
                    <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Filter Tabs */}
                            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => handleFilterChange(false)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                        !unreadOnly
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                >
                                    All Notifications
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleFilterChange(true)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                        unreadOnly
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                >
                                    Unread Only {unreadCount > 0 && `(${unreadCount})`}
                                </button>
                            </div>

                            <button
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 shadow-sm"
                                onClick={() => reload(currentPage, unreadOnly)}
                                disabled={loading || saving}
                            >
                                <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-xs font-medium text-white hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40 shadow-sm"
                                onClick={markAllRead}
                                disabled={saving || loading || unreadCount === 0}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Mark all as read
                            </button>
                            <button
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 shadow-sm"
                                onClick={() => setDeleteModalOpen(true)}
                                disabled={saving || loading || totalCount === 0}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete all
                            </button>
                        </div>
                    </div>

                    {/* Notification Cards List */}
                    <div className="p-4 sm:p-5">
                        {loading ? (
                            <div className="space-y-3">
                                {[...Array(6)].map((_, index) => (
                                    <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100 border border-slate-200" />
                                ))}
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
                                <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="font-semibold text-slate-700">
                                    {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {unreadOnly
                                        ? 'All caught up! Switch to "All Notifications" to view your history.'
                                        : 'No events have been recorded for your account yet.'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                                {notifications.map((notification) => {
                                    const isUnread = notification.read_at === null;
                                    return (
                                        <article
                                            key={notification.UserNotificationID}
                                            className={`rounded-xl border p-4 shadow-sm transition-all ${
                                                isUnread
                                                    ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50/70'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                                        {isUnread ? (
                                                            <Circle className="h-3 w-3 fill-blue-500 text-blue-500 shrink-0" />
                                                        ) : (
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                        )}

                                                        {notification.payload?.link &&
                                                        (typeof notification.payload.link === 'string' ||
                                                            (typeof notification.payload.link === 'object' &&
                                                                notification.payload.link !== null)) ? (
                                                            <Link
                                                                href={String(notification.payload.link)}
                                                                className="cursor-pointer text-sm font-bold text-[var(--primary)] hover:underline truncate"
                                                            >
                                                                {notification.title}
                                                            </Link>
                                                        ) : (
                                                            <h2 className="text-sm font-bold text-slate-900 truncate">
                                                                {notification.title}
                                                            </h2>
                                                        )}
                                                    </div>

                                                    <p className="text-xs text-slate-700 leading-relaxed mt-1">
                                                        {notification.message}
                                                    </p>

                                                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium uppercase tracking-wider text-[10px] text-slate-600">
                                                            {notification.event_type.replace(/[_.]/g, ' ')}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{new Date(notification.created_at).toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                <div className="flex shrink-0 items-center gap-2 self-end md:self-start">
                                                    {isUnread ? (
                                                        <button
                                                            className="rounded-lg bg-[var(--primary)] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40 shadow-sm"
                                                            onClick={() => void markOneRead(notification.UserNotificationID)}
                                                            disabled={saving}
                                                        >
                                                            Mark read
                                                        </button>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500 font-medium">
                                                            <Clock className="h-3 w-3" />
                                                            read
                                                        </span>
                                                    )}

                                                    <button
                                                        onClick={() => void handleDeleteOne(notification.UserNotificationID)}
                                                        disabled={saving}
                                                        title="Delete notification"
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Pagination Footer */}
                    {totalCount > 0 && totalPages > 1 && (
                        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs text-slate-600">
                                Showing <span className="font-semibold text-slate-900">{startItem}</span> to{' '}
                                <span className="font-semibold text-slate-900">{endItem}</span> of{' '}
                                <span className="font-semibold text-slate-900">{totalCount}</span> notifications
                            </div>

                            <div className="flex items-center gap-1.5 self-center sm:self-auto">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1 || loading}
                                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium inline-flex items-center gap-1 shadow-sm"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    <span>Prev</span>
                                </button>

                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum: number;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }

                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                disabled={loading}
                                                className={`min-w-[32px] h-8 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
                                                    currentPage === pageNum
                                                        ? 'bg-slate-900 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages || loading}
                                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium inline-flex items-center gap-1 shadow-sm"
                                >
                                    <span>Next</span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Delete All Confirmation Modal */}
            <Dialog
                open={deleteModalOpen}
                onOpenChange={setDeleteModalOpen}
                title="Delete All Notifications"
                description="This action cannot be undone. Are you sure you want to permanently clear your notifications history?"
                confirmText="Delete All"
                cancelText="Cancel"
                loading={isDeletingAll}
                onConfirm={handleDeleteAll}
            >
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    <span>
                        All notifications will be deleted from the database. Unread notifications will also be cleared.
                    </span>
                </div>
            </Dialog>
        </main>
    );
}
