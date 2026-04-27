import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BrainBook",
    short_name: "BrainBook",
    description: "Personal Technical Notebook",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          { name: "files", accept: ["image/*", "audio/*", "video/*", "application/pdf", "text/*"] },
        ],
      },
    },
  } as unknown as MetadataRoute.Manifest;
}
