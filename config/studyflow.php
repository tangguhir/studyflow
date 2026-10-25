<?php

/*
|--------------------------------------------------------------------------
| StudyFlow
|--------------------------------------------------------------------------
| Semua nilai diambil dari .env supaya sama persis dengan versi Node/PHP.
| Nama variabel sengaja dipertahankan (BASE_PATH, APP_URL, DB_*, JWT_SECRET,
| RESEND_*, SMTP_*, MAIL_FROM, CRON_TOKEN, APP_TIMEZONE).
*/

$basePath = trim((string) env('BASE_PATH', ''), '/');

return [

    // Folder aplikasi di domain. Kosong bila dipasang di root domain.
    'base_path' => $basePath,

    // Prefix URL untuk aset statis (mis. /studyflow/assets).
    'asset_path' => ($basePath === '' ? '' : '/' . $basePath) . '/assets',

    // Domain publik aplikasi, dipakai untuk tautan di email.
    // Sama seperti versi Node: WEB_URL -> WEB_ORIGIN -> APP_URL.
    'app_url' => rtrim((string) (env('WEB_URL') ?: env('WEB_ORIGIN') ?: env('APP_URL', 'https://tangguhir.web.id/' . $basePath)), '/'),

    'name' => 'StudyFlow',

    // Sesi JWT: cookie httpOnly `sf_token`, umur 7 hari (sama dengan versi Node).
    'jwt_secret' => (string) env('JWT_SECRET', 'ubah-secret-ini-di-hosting'),
    'jwt_ttl' => 7 * 24 * 60 * 60,
    'cookie' => 'sf_token',

    // Token untuk memicu cron lewat URL (cPanel yang hanya mendukung HTTP cron).
    'cron_token' => (string) env('CRON_TOKEN', ''),

    // Email: Resend (RESEND_API_KEY) -> SMTP (SMTP_HOST) -> nonaktif.
    'mail' => [
        'resend_key' => (string) env('RESEND_API_KEY', ''),
        'resend_from' => (string) env('RESEND_FROM', ''),
        'smtp_host' => (string) env('SMTP_HOST', ''),
        'smtp_port' => (int) env('SMTP_PORT', 587),
        'smtp_secure' => strtolower((string) env('SMTP_SECURE', 'false')) === 'true',
        'smtp_user' => (string) env('SMTP_USER', ''),
        'smtp_pass' => (string) env('SMTP_PASS', ''),
        'from' => (string) env('MAIL_FROM', ''),
    ],

    // Jendela toleransi cron (detik) agar pengingat tidak hilang bila cron tertunda.
    'cron_window' => 30 * 60,
];
