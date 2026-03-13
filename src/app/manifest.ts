import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clinic Connect",
    short_name: "ClinicConnect",
    description: "AI Sales Agent สำหรับคลินิกความงาม",
    start_url: "/clinic",
    display: "standalone",
    background_color: "#FAF7F4",
    theme_color: "#3D2235",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
