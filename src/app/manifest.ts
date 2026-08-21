import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "I am fit",
    short_name: "I am fit",
    description: "Tägliche Übungen und Mantras, die du nicht vergessen wolltest.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4EFE6",
    theme_color: "#2F5D50",
    lang: "de",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
