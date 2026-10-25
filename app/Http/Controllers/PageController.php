<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Halaman aplikasi StudyFlow (single-page, sama seperti versi Next.js).
 * Semua rute halaman dilayani satu view lalu dirender oleh assets/app.js.
 */
final class PageController extends Controller
{
    /** Akar aplikasi selalu mengarah ke halaman masuk (sama seperti app/page.tsx: 307). */
    public function root(): Response
    {
        // Location relatif, persis seperti Next.js redirect('/studyflow/login').
        return new Response('', 307, ['Location' => $this->url('/login')]);
    }

    public function show(Request $request)
    {
        $page = (string) $request->route()->defaults['page'];

        return response()
            ->view('app', [
                'page' => $page,
                'base' => $this->base(),
                'assetBase' => (string) config('studyflow.asset_path', '/assets'),
                'notFound' => false,
            ])
            ->header('Content-Type', 'text/html; charset=utf-8');
    }

    /** 404 dengan tampilan yang sama seperti versi Node. */
    public function notFound()
    {
        return response()
            ->view('app', [
                'page' => '/404',
                'base' => $this->base(),
                'assetBase' => (string) config('studyflow.asset_path', '/assets'),
                'notFound' => true,
            ], 404)
            ->header('Content-Type', 'text/html; charset=utf-8');
    }

    private function base(): string
    {
        $base = (string) config('studyflow.base_path', '');

        return $base === '' ? '' : '/' . $base;
    }

    private function url(string $path): string
    {
        return $this->base() . $path;
    }
}
