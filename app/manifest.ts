import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KasKita",
    short_name: "KasKita",
    description: "Kelola kas organisasi dengan mudah.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff7fb",
    theme_color: "#f6a6c4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
