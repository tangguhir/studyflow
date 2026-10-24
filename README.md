# StudyFlow — Pengelola tugas kuliah

Aplikasi Next.js + NestJS + MySQL (kompatibel dengan database phpMyAdmin di hosting) untuk menyusun prioritas tugas, memantau subtugas, melihat kalender dan statistik produktivitas, serta menerima pengingat melalui email.

## Menjalankan secara lokal

1. Pastikan Docker Desktop berjalan, lalu jalankan `docker compose up -d db mailpit` dari folder proyek. Service `db` adalah MySQL 8 di port **3307** (database `studyflow`, user `studyflow`).
2. Salin `apps/api/.env.example` menjadi `apps/api/.env`. `DATABASE_URL` lokal: `mysql://studyflow:studyflow_dev_password@127.0.0.1:3307/studyflow`; untuk pengembangan lokal, SMTP diarahkan ke Mailpit.
3. Pasang dependensi API: `cd apps/api && npm install`, lalu terapkan skema: `npx prisma migrate deploy` (atau `npx prisma migrate dev` saat mengubah skema) dan `npx prisma generate`.
4. Kembali ke folder utama, jalankan `npm install && npm run dev`.
5. Buka aplikasi di `http://localhost:3000`. API tersedia di `http://localhost:4000/api`; kotak masuk email lokal di `http://localhost:8025`.

Pengingat jadwal mulai dan tenggat H-3/H-1 dikirim ke alamat email yang digunakan saat mendaftar. Mailpit menangkap email lokal untuk pengujian dan tidak meneruskannya ke kotak masuk sungguhan.

## Pengiriman email lewat Resend

Resend dipakai lebih dulu daripada SMTP: bila `RESEND_API_KEY` terisi, semua pengingat dikirim melalui Resend dan `SMTP_*` diabaikan. Isi di `apps/api/.env`:

| Variabel | Nilai contoh | Keterangan |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxx` | API key dari dashboard Resend. Jangan di-commit |
| `RESEND_FROM` | `StudyFlow <onboarding@resend.dev>` | Alamat pengirim. Wajib domain terverifikasi di Resend untuk kirim ke penerima mana pun |
| `WEB_URL` | `https://asd.web.id/studyflow` | URL yang dipasang di tombol email (sertakan sub-path) |

Alur pengiriman:

- Cron di `EmailReminderService` berjalan tiap menit, mencari tugas dengan `remindStart` atau tenggat H-3/H-1, lalu mengirim email berisi nama tugas, mata kuliah, deadline (WIB), tingkat kesulitan, estimasi jam, bobot, dan daftar subtugas beserta status centangnya.
- Setiap pengiriman dicatat di `NotificationLog` supaya email yang sama tidak terkirim dua kali.
- Endpoint manual: `POST /api/notifications/remind` dengan body `{ "taskId": "..." }` untuk satu tugas, `POST /api/notifications/test` untuk email uji ke alamat akun yang login, dan `GET /api/notifications/status` untuk memeriksa penyedia aktif. Di UI, tombol ✉ pada kartu tugas memicu pengingat manual.

Catatan Resend: selama domain belum diverifikasi, `onboarding@resend.dev` hanya bisa mengirim ke email pemilik akun Resend. Verifikasi domain lalu ganti `RESEND_FROM` ke alamat domain tersebut agar pengingat sampai ke pengguna lain.

Bila `RESEND_API_KEY` dibiarkan kosong (atau dikomentari), aplikasi otomatis memakai SMTP. Ini konfigurasi default di repo: lokal → Mailpit (`SMTP_HOST=localhost`, `SMTP_PORT=1025`), hosting → SMTP dari cPanel/penyedia email. Untuk mengaktifkan Resend, isi `RESEND_API_KEY` saja; `SMTP_*` tidak perlu dihapus.


Untuk hosting, siapkan database MySQL lewat phpMyAdmin, SMTP, HTTPS, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, dan `JWT_SECRET` kuat. Impor `apps/api/prisma/phpmyadmin-schema.sql` (dan opsional `phpmyadmin-data.sql`) lewat tab **Import** phpMyAdmin, atau jalankan `npx prisma migrate deploy` bila server punya akses CLI. Jangan unggah `.env` ke repositori. Penerapan lintas situs memerlukan pengaturan cookie dan perlindungan CSRF. Sebelum peluncuran publik, tambahkan verifikasi email, pemulihan kata sandi, pembatasan percobaan masuk, kebijakan privasi, serta tinjauan keamanan.

## Hosting di sub-path (`https://asd.web.id/studyflow`)

Seluruh halaman web dilayani di bawah `/studyflow` (diatur `basePath` pada `next.config.ts`):

- `/studyflow` → dialihkan ke `/studyflow/login`
- `/studyflow/login`, `/studyflow/daftar`, `/studyflow/dashboard`, `/studyflow/tugas`, `/studyflow/kalender`, `/studyflow/produktivitas`

Nilai default sub-path adalah `/studyflow`. Untuk mengganti, set `NEXT_PUBLIC_BASE_PATH` **saat build** (nilainya di-inline ke bundle):

```sh
NEXT_PUBLIC_BASE_PATH=/studyflow npm run build   # Linux/macOS
npm run build                                     # default sudah /studyflow
```

Setelah build, jalankan `npm start` di belakang reverse proxy yang meneruskan `/studyflow/*` ke proses Next.js (port 3000). Contoh Nginx:

```nginx
location /studyflow {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Variabel lingkungan produksi:

| Variabel | Nilai contoh | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_BASE_PATH` | `/studyflow` | Sub-path aplikasi web (build-time) |
| `NEXT_PUBLIC_API_URL` | `https://asd.web.id/api` | Base URL API. Bila kosong di produksi, dipakai `/api` (same-origin) |
| `WEB_ORIGIN` (API) | `https://asd.web.id` | Origin untuk CORS — **tanpa** path |
| `PORT` (API) | `4000` | Port internal API |

API tetap memakai prefix `/api` (`/api/tasks`, `/api/auth/login`, …). Bila API diproksikan di domain yang sama, cookie sesi `sf_token` bekerja dengan `SameSite=Lax`. Bila API berada di domain berbeda, cookie perlu `SameSite=None; Secure` dan CORS harus mengizinkan origin web secara eksplisit.
