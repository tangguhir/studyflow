# Panduan penyiapan

1. Dari folder proyek, jalankan `docker compose up -d db mailpit`.
2. Salin `apps/api/.env.example` menjadi `apps/api/.env`, lalu isi `DATABASE_URL` dan `JWT_SECRET` sesuai lingkungan lokal.
3. Di folder `apps/api`, jalankan `npm install` lalu `npx prisma migrate dev --name init`.
4. Di folder proyek utama, jalankan `npm install && npm run dev`.
5. Buka `http://localhost:3000`. API berjalan di `http://localhost:4000/api`; kotak masuk lokal Mailpit di `http://localhost:8025`.

## Pengiriman email

Mailpit menerima email uji di SMTP `localhost:1025`, tetapi tidak meneruskannya ke alamat sungguhan. Pengingat jadwal mulai dan tenggat H-3/H-1 dikirim ke alamat yang dipakai untuk mendaftar. Untuk pengiriman sungguhan, siapkan akun penyedia email transaksional dan masukkan kredensial SMTP-nya ke `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, serta `MAIL_FROM` pada `apps/api/.env`. Jangan gunakan kata sandi email pribadi. Mulai ulang API sesudah perubahan konfigurasi, lalu buat tugas uji dengan jadwal pengingat segera tiba.

## Sebelum penerapan publik

Siapkan PostgreSQL terkelola, HTTPS, SMTP, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, dan `JWT_SECRET` yang kuat, kemudian jalankan `npx prisma migrate deploy`. Jangan unggah `.env` ke repositori. Pertahankan web dan API pada situs yang sama agar cookie sesi `httpOnly` bawaan bekerja; penerapan lintas situs membutuhkan `SameSite=None; Secure` dan perlindungan CSRF. Sebelum peluncuran publik, tambahkan verifikasi email, pemulihan kata sandi, pembatasan percobaan masuk, kebijakan privasi, dan tinjauan keamanan.

