import type { NextConfig } from "next";

// Semua halaman dilayani di bawah /studyflow (mis. asd.web.id/studyflow/login).
// Ubah lewat NEXT_PUBLIC_BASE_PATH bila ingin sub-path lain; set string kosong untuk root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/studyflow";

// Tujuan API internal. Browser tidak pernah memanggil port 4000 langsung:
// semua request /studyflow/api/* diproksikan oleh server Next ke sini.
// Hasilnya same-origin -> tidak ada preflight CORS, cookie sesi selalu ikut,
// dan "Tidak dapat terhubung ke layanan StudyFlow" tidak muncul lagi saat
// aplikasi dibuka lewat localhost, 127.0.0.1, IP LAN, maupun domain.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  basePath,
  // basePath otomatis ikut pada source rewrite, jadi /api/* menjadi /studyflow/api/*
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
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
