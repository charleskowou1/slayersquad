// Offline support. Keeps a copy of the game on the phone so it opens without a connection.
// When online it always fetches the newest files first, so updates show up on the next open.
const CACHE = 'squad-draft-v113';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/roster.js', 'js/engine.js', 'js/story.js', 'js/daily.js', 'js/online.js', 'js/firebase-config.js', 'js/notes.js', 'js/effects.js', 'js/clips.js', 'js/updates.js', 'js/views.js', 'js/sound.js', 'js/art-list.js', 'js/app.js', 'js/tv.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const keep = url.origin === location.origin || FONT_HOSTS.includes(url.hostname);
  if (!keep) return;
  // Pictures, clips and sounds never wait on the network: the game redraws on every beat, and asking the server for
  // each picture made them all blink out for a second on phones (CK). The saved copy shows at once and is refreshed behind it.
  if (/\.(jpe?g|png|webp|mp3|mp4)$/i.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request, {ignoreSearch: true}).then(hit => {
      const fresh = fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; });
      if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh;
    })));
    return;
  }
  e.respondWith(
    fetch(e.request, {cache: 'no-cache'})   // ask the server every time, so a fresh push isn't hidden by the browser's own cache
      .then(res => {
        // save good copies (pictures included) for offline; skip missing files like pictures not added yet
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, {ignoreSearch: true})
        .then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
// Notifications sent by worker/index.js
self.addEventListener('push', e => {
  let m={}; try{ m=e.data.json(); }catch(x){}
  e.waitUntil(self.registration.showNotification(m.title||'Slayer Squad', {body:m.body||'', icon:'icons/icon-192.png', badge:'icons/icon-192.png', data:{url:m.url||'/'}, tag:m.url||'slayer'}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url=new URL(e.notification.data.url||'/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(list => { const c=list[0]; return c ? c.navigate(url).then(w=>(w||c).focus()) : self.clients.openWindow(url); }));
});
