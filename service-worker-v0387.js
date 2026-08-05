const APP_VERSION='v0.3.87';
const APP_BUILD='20260805-v0387-indexeddb-safe-boot-memory-guard';
const CACHE='pokemon-sleep-ai-v0.3.87-v0387-indexeddb-safe-boot-memory-guard';
const SHELL=['./','./index.html','./manifest.webmanifest','./assets/css/app.css','./assets/css/editor.css','./assets/js/bootstrap.js','./assets/js/v0382-release-authority.js','./assets/js/database.js','./assets/js/storage.js','./assets/js/app.js','./assets/icons/icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()).then(()=>self.clients.matchAll({type:'window',includeUncontrolled:true})).then(clients=>Promise.all(clients.map(client=>client.postMessage({type:'pokemon-sleep-version-activated',app_version:APP_VERSION,build:APP_BUILD}))))));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const networkFirst=sameOrigin&&(event.request.mode==='navigate'||url.pathname.endsWith('.js')||url.pathname.endsWith('.html'));
  if(networkFirst){event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));return;}
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;})));
});
