'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import type { User } from '@/types/auth';
import { registerPushToken, markNotificationRead } from '@/lib/api/notifications';
import { FcmSetupError, getFcmToken, subscribeForegroundMessages } from '@/lib/firebase/messaging';

type NotificationBootstrapProps = {
    user: User | null;
};

type UserSettingsPrefs = {
    browserAlerts?: boolean;
};

function getPushTokenSessionKey(userId: number): string {
    return `gso_fcm_registered_v1_${userId}`;
}

function getSettingsKey(userId: number): string {
    return `gso_settings_v1_${userId}`;
}

function isBrowserAlertsEnabled(user: User): boolean {
    try {
        const raw = localStorage.getItem(getSettingsKey(user.UserID));
        if (!raw) {
            return true;
        }

        const parsed = JSON.parse(raw) as UserSettingsPrefs;
        return parsed.browserAlerts ?? true;
    } catch {
        return true;
    }
}

export function NotificationBootstrap({ user }: NotificationBootstrapProps) {
    useEffect(() => {
        if (!user || typeof window === 'undefined') {
            return;
        }

        if (!isBrowserAlertsEnabled(user)) {
            return;
        }

        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';
        if (!vapidKey) {
            return;
        }

        let unsubscribeForeground: (() => void) | null = null;

        const init = async () => {
            try {
                const token = await getFcmToken(vapidKey);
                if (token) {
                    const sessionKey = getPushTokenSessionKey(user.UserID);
                    const alreadyRegisteredToken = sessionStorage.getItem(sessionKey);

                    if (alreadyRegisteredToken !== token) {
                        await registerPushToken(token, navigator.userAgent.slice(0, 120));
                        sessionStorage.setItem(sessionKey, token);
                        console.info('[FCM] Push token registered successfully for user', user.UserID);
                    }
                }

                unsubscribeForeground = await subscribeForegroundMessages((payload) => {
                    const title = payload.notification?.title || 'New Notification';
                    const body = payload.notification?.body || 'You have a new update.';

                    const toastId = toast.info(title, { description: body });

                    const notificationId = payload.data?.notification_id ? Number(payload.data.notification_id) : null;
                    if (notificationId) {
                        void markNotificationRead(notificationId).catch(() => {
                            // Ignored; we only try to move UI to read state.
                        });
                    }

                    if (Notification.permission === 'granted') {
                        const link = payload.data?.link || '/';
                        const browserNotification = new Notification(title, {
                            body,
                            icon: '/assets/images/logo.png',
                            data: { link, notificationId },
                        });

                        browserNotification.onclick = () => {
                            window.focus();
                            if (notificationId) {
                                void markNotificationRead(notificationId).catch(() => { });
                            }
                            if (typeof link === 'string') {
                                window.location.href = link;
                            }
                        };
                    }

                });
            } catch (error) {
                if (error instanceof FcmSetupError) {
                    console.warn('[FCM] Setup warning:', error.code, error.message);

                    if (error.code === 'PERMISSION_DENIED') {
                        toast.warning('Notifications are blocked', {
                            description: 'Allow browser notifications for this site to receive live updates.',
                        });
                        return;
                    }

                    if (error.code === 'MISSING_VAPID' || error.code === 'MISSING_CONFIG') {
                        toast.error('Notification setup is incomplete', {
                            description: error.message,
                        });
                        return;
                    }

                    return;
                }

                console.error('[FCM] Unexpected setup error:', error);
                toast.error('Notification setup failed', {
                    description: 'Check browser console for FCM setup details.',
                });
            }
        };

        void init();

        return () => {
            if (unsubscribeForeground) {
                unsubscribeForeground();
            }
        };
    }, [user]);

    return null;
}
