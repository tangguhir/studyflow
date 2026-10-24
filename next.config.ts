import type { NextConfig } from "next";

// Semua halaman dilayani di bawah /studyflow (mis. asd.web.id/studyflow/login).
// Ubah lewat NEXT_PUBLIC_BASE_PATH bila ingin sub-path lain; set string kosong untuk root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/studyflow";

const nextConfig: NextConfig = {
  basePath,
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
