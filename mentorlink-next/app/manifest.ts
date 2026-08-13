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
    icons: [{ src: "/mentorlink-logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
  };
}
