importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

(function initMessagingServiceWorker() {
    const params = new URL(self.location.href).searchParams;

    const firebaseConfig = {
        apiKey: params.get('apiKey') || '',
        authDomain: params.get('authDomain') || '',
        projectId: params.get('projectId') || '',
        storageBucket: params.get('storageBucket') || '',
        messagingSenderId: params.get('messagingSenderId') || '',
        appId: params.get('appId') || '',
    };

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.messagingSenderId || !firebaseConfig.appId) {
        return;
    }

    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(function (payload) {
        const notificationTitle = payload.notification?.title || 'New Notification';
        const notificationOptions = {
            body: payload.notification?.body || 'You have a new update.',
            icon: '/assets/images/logo.png',
            data: {
                link: payload.data?.link || '/',
            },
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });

    self.addEventListener('notificationclick', function (event) {
        event.notification.close();

        const targetUrl = event.notification?.data?.link || '/';

        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientsArr) {
                for (let i = 0; i < clientsArr.length; i += 1) {
                    const client = clientsArr[i];
                    if ('focus' in client) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }

                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }

                return undefined;
            })
        );
    });
})();
