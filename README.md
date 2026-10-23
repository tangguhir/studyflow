# StudyFlow — Pengelola tugas kuliah

Aplikasi Next.js + NestJS + PostgreSQL untuk menyusun prioritas tugas, memantau subtugas, melihat kalender dan statistik produktivitas, serta menerima pengingat melalui email.

## Menjalankan secara lokal

1. Pastikan Docker Desktop berjalan, lalu jalankan `docker compose up -d db mailpit` dari folder proyek.
2. Salin `apps/api/.env.example` menjadi `apps/api/.env`. Periksa `DATABASE_URL` dan `JWT_SECRET`; untuk pengembangan lokal, SMTP diarahkan ke Mailpit.
3. Pasang dependensi API: `cd apps/api && npm install`, lalu jalankan migrasi: `npx prisma migrate dev --name init`.
4. Kembali ke folder utama, jalankan `npm install && npm run dev`.
5. Buka aplikasi di `http://localhost:3000`. API tersedia di `http://localhost:4000/api`; kotak masuk email lokal di `http://localhost:8025`.

Pengingat jadwal mulai dan tenggat H-3/H-1 dikirim ke alamat email yang digunakan saat mendaftar. Mailpit menangkap email lokal untuk pengujian dan tidak meneruskannya ke kotak masuk sungguhan. Untuk pengiriman sungguhan, isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, dan `MAIL_FROM` di `apps/api/.env` dengan kredensial SMTP dari penyedia email transaksional. Gunakan kredensial SMTP/kunci aplikasi, bukan kata sandi akun email pribadi. Setelah mengubah `.env`, mulai ulang API dan uji menggunakan tugas yang jadwal pengingatnya segera tiba.

Untuk hosting, siapkan PostgreSQL terkelola, SMTP, HTTPS, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, dan `JWT_SECRET` kuat; jalankan `npx prisma migrate deploy`. Jangan unggah `.env` ke repositori. Penerapan lintas situs memerlukan pengaturan cookie dan perlindungan CSRF. Sebelum peluncuran publik, tambahkan verifikasi email, pemulihan kata sandi, pembatasan percobaan masuk, kebijakan privasi, serta tinjauan keamanan.
