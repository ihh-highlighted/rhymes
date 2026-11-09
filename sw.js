// Minimal service worker: it only exists so browsers treat Rhyme Studio as an
// installable app (which then opens with no browser bars). It does no caching,
// so you always get the latest files.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
