// Мой Ритм — service worker: офлайн-запуск приложения
const VERSION = 'mr-v10.0.0';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/app.js', 'js/data.js', 'js/ui.js', 'js/util.js', 'js/logic.js',
  'js/pages/today.js', 'js/pages/home.js', 'js/pages/money.js', 'js/pages/us.js', 'js/pages/habits.js', 'js/pages/food.js', 'js/pages/results.js', 'js/pages/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return; // данные — только из сети
  const isFont = url.hostname.includes('fonts.g');
  // свои файлы: сначала сеть (чтобы обновления приходили сразу), при офлайне — кэш
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  // CDN и шрифты: сначала кэш
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok || isFont) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return res; })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => { const c = cs[0]; if (c) return c.focus(); return self.clients.openWindow('./'); }));
});
