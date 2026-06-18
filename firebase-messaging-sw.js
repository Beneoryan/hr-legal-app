// Firebase Cloud Messaging Service Worker
// Handles background push notifications when app/browser is closed
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// NOTE: The messagingSenderId and appId below are placeholders.
// Replace them with your actual Firebase project values from
// Firebase Console > Project Settings > General > Your apps > Config.
const firebaseConfig = {
  apiKey: 'AIzaSyAWlNi_iBOWxZBD6E20aHOSrRpPsirDdOM',
  authDomain: 'test-kesehatan-ijef-corp-7c278.firebaseapp.com',
  projectId: 'test-kesehatan-ijef-corp-7c278',
  storageBucket: 'test-kesehatan-ijef-corp-7c278.appspot.com',
  messagingSenderId: '48180557823',
  appId: '1:48180557823:web:47ea8db8126737dbc0d9ca',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background push notifications using the FCM SDK's built-in mechanism.
// Do NOT add a separate self.addEventListener("push", ...) handler here -- the SDK
// handles incoming push events internally. Using both would cause duplicate notifications.
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const title = notification.title || 'IMS Notifikasi';
  const options = {
    body: notification.body || '',
    icon:
      notification.icon ||
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏛️</text></svg>',
    badge:
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏛️</text></svg>',
    vibrate: [200, 100, 200, 100, 300],
    silent: false,
    data: {
      click_action: notification.click_action || payload.data?.click_action || '/',
      url: notification.click_action || payload.data?.url || '/',
    },
  };

  return self.registration.showNotification(title, options);
});

// Handle notification click - open/focus the app window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || event.notification.data?.click_action || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If an app window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(urlToOpen);
    })
  );
});
