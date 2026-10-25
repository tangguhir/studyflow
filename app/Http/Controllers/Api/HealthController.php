<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Db;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/health - dipakai frontend untuk cek koneksi & memicu reconnect.
 */
final class HealthController extends Controller
{
    public function index(): JsonResponse
    {
        $start = defined('LARAVEL_START') ? (float) LARAVEL_START : (float) ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true));
        $db = Db::ping();

        return $this->json([
            'ok' => $db,
            'db' => $db,
            'uptime' => (int) max(0, floor(microtime(true) - $start)),
            'at' => (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z'),
        ]);
    }
}
