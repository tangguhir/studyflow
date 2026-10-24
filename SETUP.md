# Panduan penyiapan

1. Dari folder proyek, jalankan `docker compose up -d db mailpit` (service `db` = MySQL 8 di port `3307`).
2. Salin `apps/api/.env.example` menjadi `apps/api/.env`, lalu isi `DATABASE_URL` (`mysql://studyflow:studyflow_dev_password@127.0.0.1:3307/studyflow`) dan `JWT_SECRET` sesuai lingkungan lokal.
3. Di folder `apps/api`, jalankan `npm install`, lalu `npx prisma migrate deploy` dan `npx prisma generate`.
4. Di folder proyek utama, jalankan `npm install && npm run dev`.
5. Buka `http://localhost:3000`. API berjalan di `http://localhost:4000/api`; kotak masuk lokal Mailpit di `http://localhost:8025`.

## Pengiriman email

Mailpit menerima email uji di SMTP `localhost:1025`, tetapi tidak meneruskannya ke alamat sungguhan. Pengingat jadwal mulai dan tenggat H-3/H-1 dikirim ke alamat yang dipakai untuk mendaftar. Untuk pengiriman sungguhan, siapkan akun penyedia email transaksional dan masukkan kredensial SMTP-nya ke `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, serta `MAIL_FROM` pada `apps/api/.env`. Jangan gunakan kata sandi email pribadi. Mulai ulang API sesudah perubahan konfigurasi, lalu buat tugas uji dengan jadwal pengingat segera tiba.

## Sebelum penerapan publik

Siapkan database MySQL lewat phpMyAdmin di cPanel, HTTPS, SMTP, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, dan `JWT_SECRET` yang kuat. Jangan unggah `.env` ke repositori. Pertahankan web dan API pada situs yang sama agar cookie sesi `httpOnly` bawaan bekerja; penerapan lintas situs membutuhkan `SameSite=None; Secure` dan perlindungan CSRF. Sebelum peluncuran publik, tambahkan verifikasi email, pemulihan kata sandi, pembatasan percobaan masuk, kebijakan privasi, dan tinjauan keamanan.

## Impor database lewat phpMyAdmin (hosting cPanel)

1. Di cPanel buka **MySQL Databases**, buat database + user, lalu tambahkan user itu ke database dengan hak **ALL PRIVILEGES**. Catat host (biasanya `localhost`), nama database (sering berawalan `u1234567_`), nama user, dan password.
2. Buka **phpMyAdmin** → pilih database tersebut → tab **Import**.
3. Unggah `apps/api/prisma/phpmyadmin-schema.sql` → **Go**. File ini membuat 5 tabel (`User`, `Task`, `Subtask`, `NotificationLog`, `_prisma_migrations`) dengan InnoDB + `utf8mb4_unicode_ci`.
4. Opsional: ulangi langkah 3 untuk `apps/api/prisma/phpmyadmin-data.sql` bila ingin membawa data akun/tugas yang sudah ada.
5. Isi `DATABASE_URL` di server, contoh: `mysql://USER_DB:PASSWORD_DB@localhost:3306/USER_DB_studyflow`. Bila nama user sama dengan nama database, cukup tulis satu kali.
6. Jalankan `npx prisma generate` saat build, lalu nyalakan API. `prisma migrate deploy` tidak perlu dijalankan lagi karena baris migration sudah ikut terimpor.

Alternatif tanpa phpMyAdmin: `npx prisma migrate deploy` langsung ke database hosting (butuh akses SSH/terminal dari server).


