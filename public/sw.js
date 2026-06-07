// DEPRECATED — Service Worker gerido pelo VitePWA (Workbox).
// Este ficheiro é sobrescrito pelo VitePWA durante o build.
// Stub mantido apenas para clientes que ainda o têm registado:
// instala imediatamente, cede controlo, e o VitePWA toma conta.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
