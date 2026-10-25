<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Menyamakan perilaku URL dengan versi Next.js:
 *
 *   GET /studyflow/        -> 308 ke /studyflow
 *   GET /studyflow/tugas/  -> 308 ke /studyflow/tugas
 *
 * Next.js membuang garis miring di akhir dengan 308 (Permanent Redirect) dan
 * tidak menyentuh jalur API, jadi middleware ini juga melewati /api/*.
 */
final class StripTrailingSlash
{
    public function handle(Request $request, Closure $next): Response
    {
        $path = $request->getPathInfo();

        if ($path !== '/' && str_ends_with($path, '/') && ! $this->isApi($path)) {
            $target = rtrim($path, '/');
            $query = $request->getQueryString();

            // Location relatif, persis seperti Next.js.
            return new Response('', 308, [
                'Location' => $target . ($query !== null && $query !== '' ? '?' . $query : ''),
            ]);
        }

        return $next($request);
    }

    private function isApi(string $path): bool
    {
        $base = trim((string) config('studyflow.base_path', ''), '/');
        $api = ($base === '' ? '' : '/' . $base) . '/api';

        return $path === $api || str_starts_with($path, $api . '/');
    }
}
