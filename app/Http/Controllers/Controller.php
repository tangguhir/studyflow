<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

abstract class Controller
{
    /**
     * Respons JSON dengan format yang sama seperti versi Node:
     * UTF-8 tanpa escape garis miring/unicode.
     */
    protected function json(mixed $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
