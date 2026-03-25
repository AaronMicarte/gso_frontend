'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Circle, Clock, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    NotificationItem,
} from '@/lib/api/notifications';

export function NotificationsPageContent() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const unreadCount = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications]);

    const reload = async () => {
        setLoading(true);
        try {
            const data = await listNotifications();
            setNotifications(data);
        } catch (error) {
            console.error('Failed to load notifications', error);
            toast.error('Unable to load notifications. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void reload();
    }, []);

    const markOneRead = async (id: number) => {
        setSaving(true);
        try {
            await markNotificationRead(id);
            setNotifications((items) =>
                items.map((item) =>
                    item.UserNotificationID === id ? { ...item, read_at: new Date().toISOString() } : item
                )
            );
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
            toast.success('All notifications marked read.');
        } catch (error) {
            toast.error('Failed to mark all notifications read.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <main
            className="min-h-screen bg-fixed bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/assets/images/background/bg.jpg')", backgroundAttachment: "fixed" }}
        >
            <div className="max-w-[1700px] mx-auto p-4 sm:p-6 lg:p-8">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
                                <p className="text-sm text-slate-500">All push notification events and update history for this user.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded bg-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-700">
                                    {unreadCount} unread
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 border-b border-slate-200 bg-slate-50">
                        <div className="flex flex-wrap gap-2">
                            <button
                                className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
                                onClick={reload}
                                disabled={loading || saving}
                            >
                                <RefreshCcw className="h-4 w-4" />
                                Refresh
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40"
                                onClick={markAllRead}
                                disabled={saving || loading || unreadCount === 0}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Mark all as read
                            </button>
                        </div>
                    </div>

                    <div className="p-4 sm:p-5">
                        {loading ? (
                            <div className="space-y-3">
                                {[...Array(4)].map((_, index) => (
                                    <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-200" />
                                ))}
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                                <p className="font-medium text-slate-600">No notifications yet</p>
                                <p className="mt-2 text-sm text-slate-500">No events have been received yet.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                                {notifications.map((notification) => {
                                    const isUnread = notification.read_at === null;
                                    return (
                                        <article
                                            key={notification.UserNotificationID}
                                            className={`rounded-xl border p-4 shadow-sm ${isUnread ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-white'
                                                }`}
                                        >
                                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                                <div className="min-w-0">
                                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                                        {notification.payload?.link &&
                                                            (typeof notification.payload.link === 'string' ||
                                                                (typeof notification.payload.link === 'object' && notification.payload.link !== null)) ? (
                                                            <Link
                                                                href={notification.payload.link}
                                                                className="cursor-pointer text-base font-semibold text-[var(--primary)] hover:underline"
                                                            >
                                                                {notification.title}
                                                            </Link>
                                                        ) : (
                                                            <h2 className="text-base font-semibold text-slate-900">{notification.title}</h2>
                                                        )}
                                                        {isUnread ? (
                                                            <Circle className="h-3.5 w-3.5 text-blue-500" />
                                                        ) : (
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-slate-700">{notification.message}</p>
                                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">
                                                            {notification.status.toUpperCase()}
                                                        </span>
                                                        <span>{new Date(notification.created_at).toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                <div className="flex shrink-0 items-start gap-2">
                                                    {isUnread ? (
                                                        <button
                                                            className="rounded bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40"
                                                            onClick={() => void markOneRead(notification.UserNotificationID)}
                                                            disabled={saving}
                                                        >
                                                            Mark read
                                                        </button>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            already read
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
