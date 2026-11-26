/* STUNER PWA: fresh pages/scripts/styles online, reliable cached fallback offline. */
const CACHE="stuner-static-v86";
const FILES=["./","./index.html","./school-portal.css","./supabase-config.js","./school-portal.js","./manifest.webmanifest","./icon.svg","./brand-logo.svg"];
self.addEventListener("install",event=>{
 event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())
 );
});
self.addEventListener("activate",event=>{
 event.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(key=>key.startsWith("stuner-static-")&&key!==CACHE).map(key=>caches.delete(key))))
   .then(()=>self.clients.claim())
 );
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 const needsFresh=request.mode==="navigate"||/\.(?:html|js|css)$/.test(url.pathname);
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(needsFresh){
   try{
    const response=await fetch(request,{cache:"no-store"});
    if(response.ok){try{await cache.put(request,response.clone())}catch{}}
    return response;
   }catch{
    return (await cache.match(request,{ignoreSearch:true}))||
      (request.mode==="navigate"?(await cache.match("./index.html"))||(await cache.match("./")):undefined)||
      Response.error();
   }
  }
  const cached=await cache.match(request,{ignoreSearch:true});
  if(cached)return cached;
  try{
   const response=await fetch(request);
   if(response.ok){try{await cache.put(request,response.clone())}catch{}}
   return response;
  }catch{
   return Response.error();
  }
 })());
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true})
  .then(clients=>clients.length?clients[0].focus():self.clients.openWindow("./")));
});