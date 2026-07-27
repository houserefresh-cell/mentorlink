self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
    const title = typeof data.title === "string" ? data.title : "עדכון מ־MentorLink";
    const body = typeof data.body === "string" ? data.body : "ממתין לך עדכון באזור האישי.";
    const href = typeof data.href === "string" && data.href.startsWith("/") && !data.href.startsWith("//") ? data.href : "/";
    await self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { href },
      tag: typeof data.type === "string" ? data.type : "mentorlink-update",
    });
    if ("setAppBadge" in self.navigator) {
      try { await self.navigator.setAppBadge(); } catch {}
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const raw = event.notification.data?.href;
    const href = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
    const target = new URL(href, self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
