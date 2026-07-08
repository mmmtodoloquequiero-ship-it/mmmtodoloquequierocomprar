import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// Manejo de Notificaciones Web Push
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Mmm TodoLoQueQuiero Comer';
  const options: NotificationOptions = {
    body: data.body || 'Tienes una nueva notificación',
    icon: data.icon || '/icon512_maskable.png',
    badge: '/icon512_maskable.png', // Opcional: icono monocromático pequeño
    data: data.data || { url: '/' },
    tag: 'Mmm TodoLoQueQuiero Comer-notification', // Ayuda a que se sobreescriban y no se acumulen miles
    renotify: true, // Vuelve a sonar/vibrar aunque tenga el mismo tag
    vibrate: [200, 100, 200, 100, 200, 100, 200]
  } as any;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la app ya está abierta, hacemos foco en ella
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no, abrimos una nueva ventana
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
