import { initializeApp, getApp, getApps } from 'firebase/app';
import {
    getMessaging,
    getToken,
    isSupported,
    MessagePayload,
    Messaging,
    onMessage,
} from 'firebase/messaging';

export class FcmSetupError extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
        this.name = 'FcmSetupError';
    }
}

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function hasFirebaseConfig(): boolean {
    return Boolean(
        firebaseConfig.apiKey &&
        firebaseConfig.projectId &&
        firebaseConfig.messagingSenderId &&
        firebaseConfig.appId
    );
}

function getOrCreateFirebaseApp() {
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export async function getMessagingInstance(): Promise<Messaging> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        throw new FcmSetupError('UNSUPPORTED_ENV', 'Notifications are not supported in this environment.');
    }

    if (!hasFirebaseConfig()) {
        throw new FcmSetupError('MISSING_CONFIG', 'Missing Firebase web configuration in .env.local.');
    }

    const supported = await isSupported();
    if (!supported) {
        throw new FcmSetupError('UNSUPPORTED_BROWSER', 'This browser does not support Firebase messaging.');
    }

    const app = getOrCreateFirebaseApp();
    return getMessaging(app);
}

export async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        throw new FcmSetupError('NO_SERVICE_WORKER', 'Service workers are not supported in this browser.');
    }

    const url = new URL('/firebase-messaging-sw.js', window.location.origin);
    Object.entries(firebaseConfig).forEach(([key, value]) => {
        if (value) {
            url.searchParams.set(key, value);
        }
    });

    return navigator.serviceWorker.register(url.pathname + url.search);
}

export async function getFcmToken(vapidKey: string): Promise<string | null> {
    const messaging = await getMessagingInstance();
    if (!vapidKey) {
        throw new FcmSetupError('MISSING_VAPID', 'Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY in .env.local.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new FcmSetupError('PERMISSION_DENIED', `Notification permission is ${permission}.`);
    }

    const swRegistration = await registerMessagingServiceWorker();
    if (!swRegistration) {
        throw new FcmSetupError('SW_REGISTRATION_FAILED', 'Unable to register firebase-messaging service worker.');
    }

    const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
        throw new FcmSetupError('EMPTY_TOKEN', 'Firebase returned an empty token.');
    }

    return token;
}

export async function subscribeForegroundMessages(
    callback: (payload: MessagePayload) => void
): Promise<() => void> {
    const messaging = await getMessagingInstance();

    return onMessage(messaging, callback);
}
