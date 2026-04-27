const SHARE_CACHE = "share-inbox";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share") {
    event.respondWith(handleShare(event.request));
  }
});

async function handleShare(request) {
  try {
    const formData = await request.formData();
    const cache = await caches.open(SHARE_CACHE);
    const token = (self.crypto && self.crypto.randomUUID)
      ? self.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const meta = {
      title: formData.get("title") || "",
      text: formData.get("text") || "",
      url: formData.get("url") || "",
      fileCount: 0,
    };

    const files = formData.getAll("files");
    let fileIndex = 0;
    for (const f of files) {
      if (!(f instanceof File)) continue;
      await cache.put(
        new Request(`/__share-inbox/${token}/file/${fileIndex}`),
        new Response(f, {
          headers: {
            "x-filename": encodeURIComponent(f.name || `file-${fileIndex}`),
            "x-content-type": f.type || "application/octet-stream",
          },
        }),
      );
      fileIndex++;
    }
    meta.fileCount = fileIndex;

    await cache.put(
      new Request(`/__share-inbox/${token}/meta`),
      new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } }),
    );

    const redirectUrl = new URL(`/share?token=${token}`, request.url).toString();
    return Response.redirect(redirectUrl, 303);
  } catch (err) {
    return new Response(`Share handler failed: ${err && err.message ? err.message : err}`, { status: 500 });
  }
}
