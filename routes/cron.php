<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Cron pengingat lewat HTTP
|--------------------------------------------------------------------------
| Untuk cPanel yang hanya menyediakan cron berbasis URL (tanpa CLI).
| Dimuat dua kali lewat bootstrap/app.php: di root (/cron/reminders) dan di
| dalam folder aplikasi (/studyflow/cron/reminders), sama seperti versi Node
| dan versi PHP murni (/studyflow/cron/reminders.php).
|
| Token dibaca dari CRON_TOKEN di .env. Bila kosong, cron lewat web ditolak
| dan hanya bisa dijalankan dari CLI: php artisan studyflow:reminders
*/

$cronAction = function () {
    $expected = (string) config('studyflow.cron_token', '');
    $given = (string) request()->query('token', '');

    if ($expected === '' || ! hash_equals($expected, $given)) {
        return response("Cron hanya boleh dijalankan dari CLI atau dengan token yang valid.\n", 403)
            ->header('Content-Type', 'text/plain; charset=utf-8');
    }

    Artisan::call('studyflow:reminders');

    return response(Artisan::output(), 200)
        ->header('Content-Type', 'text/plain; charset=utf-8');
};

Route::get('/cron/reminders', $cronAction)->withoutMiddleware(['web']);
Route::get('/cron/reminders.php', $cronAction)->withoutMiddleware(['web']);
