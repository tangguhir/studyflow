<?php

use App\Http\Controllers\PageController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Halaman aplikasi
|--------------------------------------------------------------------------
| Struktur URL dipertahankan persis seperti versi Node:
|   /login, /daftar, /dashboard, /tugas, /kalender, /produktivitas
| Semua halaman adalah satu aplikasi (single-page) yang dirender assets/app.js.
*/

Route::get('/', [PageController::class, 'root']);

foreach (['login', 'daftar', 'dashboard', 'tugas', 'kalender', 'produktivitas'] as $page) {
    Route::get('/' . $page, [PageController::class, 'show'])->defaults('page', '/' . $page);
}

// Alamat lain di dalam folder aplikasi: 404 dengan tampilan StudyFlow,
// sama seperti versi Node/PHP (bukan halaman 404 bawaan framework).
Route::fallback([PageController::class, 'notFound']);
