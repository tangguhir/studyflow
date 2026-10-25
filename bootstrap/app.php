<?php

use App\Support\ApiError;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

$base = null;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
        then: function () use ($base) {
            // Dibaca di sini (bukan di atas) karena .env baru dimuat saat bootstrap.
            $prefix = trim((string) config('studyflow.base_path', ''), '/');

            // Halaman aplikasi: /login, /daftar, /dashboard, /tugas, /kalender, /produktivitas
            Route::prefix($prefix)
                ->group(base_path('routes/pages.php'));

            // API: /api/auth/login, /api/tasks, ... (tanpa sesi/CSRF Laravel).
            Route::prefix(($prefix === '' ? '' : $prefix . '/') . 'api')
                ->group(base_path('routes/api.php'));

            // Cron pengingat lewat URL: /cron/reminders dan /<base>/cron/reminders
            Route::group([], base_path('routes/cron.php'));
            if ($prefix !== '') {
                Route::prefix($prefix)->group(base_path('routes/cron.php'));
            }
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // StudyFlow memakai JWT sendiri di cookie sf_token, bukan sesi Laravel.
        $middleware->trustProxies(at: '*');

        // Next.js membuang garis miring di akhir URL dengan 308; samakan.
        $middleware->prepend(\App\Http\Middleware\StripTrailingSlash::class);

        // Versi Node tidak memangkas spasi atau mengubah "" menjadi null sebelum
        // validasi, jadi middleware bawaan Laravel dimatikan untuk rute API.
        $middleware->trimStrings(except: [
            static fn (Request $request): bool => $request->is('*api/*'),
        ]);
        $middleware->convertEmptyStringsToNull(except: [
            static fn (Request $request): bool => $request->is('*api/*'),
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ApiError $e) {
            return response()->json($e->payload(), $e->status, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        });

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
