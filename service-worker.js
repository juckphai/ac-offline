// service-worker.js
// ปรับปรุงสำหรับ Offline-only (IndexedDB) ไม่มี Firebase
const staticCacheName = 'account-app-offline-v1'; // เปลี่ยนชื่อเวอร์ชันเพื่อบังคับอัปเดตใหม่
const dynamicCacheName = 'account-app-dynamic-offline-v1';

// ไฟล์ที่ต้อง cache เพื่อให้ทำงานแบบ Offline ได้
const assets = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './script.js',
  './192.png',
  './512.png', // ตรวจสอบว่ามีไฟล์รูปภาพนี้จริงในโฟลเดอร์

  // ไลบรารีภายนอก (จำเป็นต้อง Cache เพื่อให้ Export/Import ทำงานตอนไม่มีเน็ต)
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// 1) INSTALL — cache ไฟล์ทั้งหมด
self.addEventListener('install', evt => {
  console.log('SW installing (Offline Mode)...');
  evt.waitUntil(
    caches.open(staticCacheName)
      .then(cache => {
        console.log('Caching shell assets');
        return cache.addAll(assets);
      })
      .catch(err => console.error("CACHE ERROR:", err))
  );
  self.skipWaiting();
});

// 2) ACTIVATE — ลบ cache เก่า (สำคัญมากสำหรับการเปลี่ยนจาก Online -> Offline)
self.addEventListener('activate', evt => {
  console.log('SW activated.');
  evt.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== staticCacheName && k !== dynamicCacheName)
            .map(k => {
                console.log('Removing old cache:', k);
                return caches.delete(k);
            })
      );
    })
  );
  self.clients.claim();
});

// 3) FETCH — เน้น Cache First เพื่อความเร็วและ Offline 100%
self.addEventListener('fetch', evt => {
  // กรอง request ที่ไม่ใช่ http/https (เช่น chrome-extension://)
  if (!evt.request.url.startsWith('http')) return;

  evt.respondWith(
    caches.match(evt.request).then(cacheRes => {
      // 1. ถ้ามีใน Cache ให้ใช้เลย (เร็วที่สุด)
      if (cacheRes) {
        return cacheRes;
      }

      // 2. ถ้าไม่มี ให้ไปโหลดจาก Network
      return fetch(evt.request)
        .then(networkRes => {
          // ถ้าโหลดได้สำเร็จ ให้เก็บลง Dynamic Cache เผื่อไว้ใช้ครั้งหน้า
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const resToCache = networkRes.clone();
            caches.open(dynamicCacheName).then(cache => {
              cache.put(evt.request, resToCache);
            });
          }
          return networkRes;
        })
        .catch(() => {
          // 3. ถ้า Offline และโหลดไม่ได้ ให้แสดงหน้าหลัก (Fallback)
          if (evt.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});