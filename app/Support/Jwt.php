<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\Request;

/**
 * JWT HS256 tanpa dependensi (setara @nestjs/jwt / jsonwebtoken).
 *
 * Cookie sesi tetap bernama `sf_token`, httpOnly, SameSite=Lax, path=/,
 * umur 7 hari - identik dengan versi Node. Token yang diterbitkan versi Node
 * juga valid di sini karena algoritma & secret sama.
 */
final class Jwt
{
    private static function b64Encode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64Decode(string $data): string
    {
        $rest = strlen($data) % 4;
        if ($rest > 0) {
            $data .= str_repeat('=', 4 - $rest);
        }
        $decoded = base64_decode(strtr($data, '-_', '+/'), true);

        return $decoded === false ? '' : $decoded;
    }

    /** Terbitkan token sesi. */
    public static function sign(array $payload): string
    {
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $now = time();
        $claims = $payload + ['iat' => $now, 'exp' => $now + (int) config('studyflow.jwt_ttl', 604800)];

        $segments = [
            self::b64Encode(json_encode($header, JSON_UNESCAPED_SLASHES)),
            self::b64Encode(json_encode($claims, JSON_UNESCAPED_SLASHES)),
        ];
        $signature = hash_hmac('sha256', implode('.', $segments), self::secret(), true);
        $segments[] = self::b64Encode($signature);

        return implode('.', $segments);
    }

    /** Verifikasi token; null bila tanda tangan salah, kedaluwarsa, atau rusak. */
    public static function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$headerB64, $payloadB64, $signatureB64] = $parts;

        $header = json_decode(self::b64Decode($headerB64), true);
        if (! is_array($header) || ($header['alg'] ?? '') !== 'HS256') {
            return null;
        }

        $expected = hash_hmac('sha256', $headerB64 . '.' . $payloadB64, self::secret(), true);
        if (! hash_equals($expected, self::b64Decode($signatureB64))) {
            return null;
        }

        $claims = json_decode(self::b64Decode($payloadB64), true);
        if (! is_array($claims)) {
            return null;
        }
        if (isset($claims['exp']) && time() >= (int) $claims['exp']) {
            return null;
        }
        if (! isset($claims['sub']) || ! is_string($claims['sub'])) {
            return null;
        }

        return $claims;
    }

    private static function secret(): string
    {
        return (string) config('studyflow.jwt_secret', '');
    }

    /** Token dari cookie `sf_token`, atau header Authorization: Bearer ... */
    public static function tokenFrom(Request $request): ?string
    {
        $cookie = $request->cookie((string) config('studyflow.cookie', 'sf_token'));
        if (is_string($cookie) && $cookie !== '') {
            return $cookie;
        }
        $auth = (string) $request->header('Authorization', '');
        if (preg_match('/^Bearer\s+(.+)$/i', $auth, $m) === 1) {
            return trim($m[1]);
        }

        return null;
    }

    /** Opsi cookie sesi (Secure hanya bila benar-benar HTTPS). */
    public static function cookieOptions(): array
    {
        return [
            'path' => '/',
            'secure' => self::isHttps(),
            'httpOnly' => true,
            'sameSite' => 'Lax',
        ];
    }

    public static function isHttps(): bool
    {
        $proto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
        if ($proto !== '') {
            return strtolower(trim(explode(',', $proto)[0])) === 'https';
        }
        if (! empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }

        return (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
    }

    /**
     * Pengguna yang sedang login (id + email), atau lempar 401.
     * Pesan sama dengan AuthGuard versi Node.
     */
    public static function requireUser(Request $request): array
    {
        $token = self::tokenFrom($request);
        if ($token === null) {
            throw new ApiError(401, 'Sesi tidak ditemukan. Silakan masuk terlebih dahulu.');
        }
        $claims = self::verify($token);
        if ($claims === null) {
            throw new ApiError(401, 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.');
        }

        return ['id' => (string) $claims['sub'], 'email' => (string) ($claims['email'] ?? '')];
    }
}
