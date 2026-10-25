<?php

declare(strict_types=1);

namespace App\Support;

use RuntimeException;

/**
 * Kesalahan API dengan bentuk respons identik NestJS:
 * {message, error, statusCode}. `message` boleh berupa daftar pesan validasi.
 */
final class ApiError extends RuntimeException
{
    public string|array $detail;

    public function __construct(public int $status, string|array $detail)
    {
        $this->detail = $detail;
        parent::__construct(is_array($detail) ? implode(' ', $detail) : $detail);
    }

    public function payload(): array
    {
        return [
            'message' => $this->detail,
            'error' => self::statusText($this->status),
            'statusCode' => $this->status,
        ];
    }

    public static function statusText(int $status): string
    {
        return match ($status) {
            400 => 'Bad Request',
            401 => 'Unauthorized',
            403 => 'Forbidden',
            404 => 'Not Found',
            405 => 'Method Not Allowed',
            409 => 'Conflict',
            422 => 'Unprocessable Entity',
            429 => 'Too Many Requests',
            default => $status >= 500 ? 'Internal Server Error' : 'Error',
        };
    }
}
