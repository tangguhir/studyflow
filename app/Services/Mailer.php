<?php

declare(strict_types=1);

namespace App\Services;

use Throwable;

/**
 * Pengiriman email + penyusunan isi pengingat.
 *
 * Prioritas penyedia sama seperti versi Node:
 *   Resend (RESEND_API_KEY) -> SMTP (SMTP_HOST) -> nonaktif.
 * Ke Resend memakai cURL; ke SMTP memakai klien SMTP ringkas (SmtpClient)
 * supaya tidak perlu dependensi tambahan di hosting.
 */
final class Mailer
{
    public static function provider(): string
    {
        if (self::cfg('resend_key') !== '') {
            return 'resend';
        }
        if (self::cfg('smtp_host') !== '') {
            return 'smtp';
        }

        return 'none';
    }

    private static function cfg(string $key): string
    {
        $value = config('studyflow.mail.' . $key, '');

        return is_string($value) ? $value : (string) $value;
    }

    public static function from(): string
    {
        $resendFrom = self::cfg('resend_from');
        if ($resendFrom !== '') {
            return $resendFrom;
        }
        $mailFrom = self::cfg('from');
        if ($mailFrom !== '') {
            return $mailFrom;
        }

        return 'StudyFlow <onboarding@resend.dev>';
    }

    /** Alamat SMTP lokal (Mailpit) hanya menampung email untuk pengujian. */
    public static function localInbox(): bool
    {
        if (self::provider() !== 'smtp') {
            return false;
        }

        return preg_match('/^(localhost|127\.0\.0\.1|::1|mailpit|host\.docker\.internal)$/i', trim(self::cfg('smtp_host'))) === 1;
    }

    /** true bila email benar-benar bisa sampai ke inbox pengguna. */
    public static function deliversToRealInbox(): bool
    {
        $provider = self::provider();
        if ($provider === 'resend') {
            return true;
        }
        if ($provider === 'smtp') {
            return ! self::localInbox();
        }

        return false;
    }

    /** URL aplikasi untuk tautan di email: memakai domain produksi. */
    public static function appUrl(): string
    {
        return (string) config('studyflow.app_url', '');
    }

    /**
     * Berkas CA bawaan aplikasi (opsional). Sebagian instalasi PHP tidak punya
     * daftar CA root sehingga HTTPS ke Resend gagal. Bila cacert.pem tersedia,
     * pakai itu; kalau tidak, ikuti konfigurasi sistem.
     */
    public static function caBundle(): ?string
    {
        $candidates = [
            storage_path('app/cacert.pem'),
            base_path('cacert.pem'),
            base_path('setup/cacert.pem'),
        ];
        foreach ($candidates as $file) {
            if (is_readable($file)) {
                return $file;
            }
        }
        $ini = (string) ini_get('curl.cainfo');
        if ($ini !== '' && is_readable($ini)) {
            return $ini;
        }
        $ssl = (string) ini_get('openssl.cafile');

        return ($ssl !== '' && is_readable($ssl)) ? $ssl : null;
    }

    /** Kirim satu email. Mengembalikan ['ok'=>bool, 'id'=>string, 'error'=>string]. */
    public static function send(string $to, string $subject, string $text, ?string $html = null): array
    {
        $provider = self::provider();
        if ($provider === 'resend') {
            return self::sendResend($to, $subject, $text, $html);
        }
        if ($provider === 'smtp') {
            return self::sendSmtp($to, $subject, $text, $html);
        }

        return ['ok' => false, 'error' => 'Layanan email belum dikonfigurasi (set RESEND_API_KEY atau SMTP_HOST).'];
    }

    public static function sendResend(string $to, string $subject, string $text, ?string $html): array
    {
        $payload = [
            'from' => self::from(),
            'to' => [$to],
            'subject' => $subject,
            'text' => $text,
            'html' => $html ?: self::textToHtml($subject, $text),
        ];

        $ch = curl_init('https://api.resend.com/emails');
        $options = [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . self::cfg('resend_key'),
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
        $ca = self::caBundle();
        if ($ca !== null) {
            $options[CURLOPT_CAINFO] = $ca;
        }
        curl_setopt_array($ch, $options);
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            return ['ok' => false, 'error' => $curlError !== '' ? $curlError : 'Gagal menghubungi Resend.'];
        }
        $body = json_decode((string) $raw, true);
        if ($status < 200 || $status >= 300) {
            $message = is_array($body) && isset($body['message']) ? (string) $body['message'] : ('HTTP ' . $status);

            return ['ok' => false, 'error' => $message];
        }

        return ['ok' => true, 'id' => (string) ($body['id'] ?? '')];
    }

    public static function sendSmtp(string $to, string $subject, string $text, ?string $html): array
    {
        $from = self::cfg('from') !== '' ? self::cfg('from') : self::cfg('smtp_user');
        if ($from === '') {
            $from = self::from();
        }
        $user = self::cfg('smtp_user');
        $pass = self::cfg('smtp_pass');

        try {
            $client = new SmtpClient(
                self::cfg('smtp_host'),
                (int) config('studyflow.mail.smtp_port', 587),
                (bool) config('studyflow.mail.smtp_secure', false),
                $user !== '' && $pass !== '' ? $user : null,
                $user !== '' && $pass !== '' ? $pass : null,
            );
            $id = $client->send($from, $to, $subject, $text, $html ?: self::textToHtml($subject, $text));

            return ['ok' => true, 'id' => $id];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    public static function escape(string $value): string
    {
        return str_replace(['&', '<', '>'], ['&amp;', '&lt;', '&gt;'], $value);
    }

    public static function textToHtml(string $subject, string $text): string
    {
        $body = '';
        foreach (explode("\n", $text) as $line) {
            $escaped = self::escape($line);
            $body .= '<p style="margin:0 0 10px">' . ($escaped !== '' ? $escaped : '&nbsp;') . '</p>';
        }

        return '<div style="font-family:system-ui,-apple-system,\'Segoe UI\',sans-serif;max-width:520px;color:#1f2333">'
            . '<h2 style="font-size:17px;margin:0 0 14px">' . self::escape($subject) . '</h2>' . $body
            . '<hr style="border:0;border-top:1px solid #e8e9f2;margin:18px 0">'
            . '<p style="margin:0;font-size:12px;color:#7b8095">Email otomatis dari StudyFlow.</p></div>';
    }

    /** Kirim dengan 3 percobaan; kegagalan konfigurasi tidak diulang. */
    public static function sendWithRetry(string $to, string $subject, string $text, ?string $html): array
    {
        $last = ['ok' => false, 'error' => 'tidak ada percobaan'];
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $last = self::send($to, $subject, $text, $html);
            if ($last['ok']) {
                return $last;
            }
            $error = (string) ($last['error'] ?? '');
            if (preg_match('/testing emails to your own email address|restricted_api_key|not configured|belum dikonfigurasi/i', $error) === 1) {
                return $last;
            }
            if ($attempt < 2) {
                usleep(1500 * ($attempt + 1) * 1000);
            }
        }

        return $last;
    }

    /** Terjemahkan error penyedia email ke pesan yang bisa ditindaklanjuti. */
    public static function errorMessage(array $result): string
    {
        $error = (string) ($result['error'] ?? '');
        if (preg_match('/testing emails to your own email address/i', $error) === 1) {
            return 'domain pengirim belum diverifikasi di Resend. Verifikasi domain di resend.com/domains lalu sesuaikan RESEND_FROM, atau kosongkan RESEND_API_KEY agar aplikasi memakai SMTP.';
        }

        return $error;
    }
}
