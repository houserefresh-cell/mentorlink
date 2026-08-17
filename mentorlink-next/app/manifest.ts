import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MentorLink",
    short_name: "MentorLink",
    description: "חיבור בטוח בין הורים לחונכים",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    dir: "rtl",
    lang: "he",
    icons: [
      { src: "/mentorlink-icon-192-v2.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/mentorlink-icon-512-v2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
