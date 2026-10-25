<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;
use Throwable;

/**
 * Klien SMTP ringkas - cukup untuk mengirim email HTML+teks.
 * Mendukung koneksi langsung TLS (port 465), STARTTLS (587),
 * AUTH LOGIN / PLAIN, dan server tanpa autentikasi (Mailpit lokal).
 */
final class SmtpError extends RuntimeException
{
}

final class SmtpClient
{
    /** @var resource|null */
    private $socket = null;

    private array $transcript = [];

    private ?string $lastMessageId = null;

    public function __construct(
        private string $host,
        private int $port = 587,
        private bool $secure = false,
        private ?string $user = null,
        private ?string $pass = null,
        private int $timeout = 20,
    ) {
    }

    /** Kirim email; mengembalikan Message-ID. */
    public function send(string $from, string $to, string $subject, string $text, ?string $html = null): string
    {
        $this->connect();

        try {
            $this->cmd('EHLO studyflow', 250);

            if (! $this->secure && $this->supportsStartTls()) {
                $this->cmd('STARTTLS', 220);
                $ok = stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if ($ok !== true) {
                    throw new SmtpError('Gagal memulai TLS dengan server SMTP.');
                }
                $this->cmd('EHLO studyflow', 250);
            }

            if ($this->user !== null && $this->user !== '') {
                $this->authenticate($this->user, (string) $this->pass);
            }

            $fromAddress = $this->extractAddress($from);
            $this->cmd('MAIL FROM:<' . $fromAddress . '>', 250);
            $this->cmd('RCPT TO:<' . $this->extractAddress($to) . '>', [250, 251]);
            $this->cmd('DATA', 354);

            $message = $this->buildMessage($from, $to, $subject, $text, $html);
            $this->write($message . "\r\n.");
            $response = $this->read();
            if (! $this->isOk($response, 250)) {
                throw new SmtpError('Server menolak pesan: ' . $response);
            }

            $this->quit();

            return $this->lastMessageId ?? '';
        } catch (Throwable $e) {
            $this->close();
            throw $e;
        }
    }

    // ------------------------------------------------------------- koneksi
    private function connect(): void
    {
        $target = ($this->secure ? 'ssl://' : 'tcp://') . $this->host . ':' . $this->port;
        $ssl = ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false];
        $ca = Mailer::caBundle();
        if ($ca !== null) {
            $ssl['cafile'] = $ca;
        }
        $context = stream_context_create(['ssl' => $ssl]);
        $socket = @stream_socket_client($target, $errno, $errstr, $this->timeout, STREAM_CLIENT_CONNECT, $context);
        if ($socket === false) {
            throw new SmtpError('Tidak dapat terhubung ke ' . $this->host . ':' . $this->port . ' (' . ($errstr ?: 'koneksi ditolak') . ')');
        }
        $this->socket = $socket;
        stream_set_timeout($this->socket, $this->timeout);

        $greeting = $this->read();
        if (! $this->isOk($greeting, 220)) {
            throw new SmtpError('Server SMTP menolak koneksi: ' . $greeting);
        }
    }

    private function supportsStartTls(): bool
    {
        $this->cmd('EHLO studyflow', 250);
        foreach ($this->transcript as $line) {
            if (stripos($line, 'STARTTLS') !== false) {
                return true;
            }
        }

        return false;
    }

    private function authenticate(string $user, string $pass): void
    {
        try {
            $this->cmd('AUTH LOGIN', 334);
            $this->cmd(base64_encode($user), 334);
            $this->cmd(base64_encode($pass), 235);

            return;
        } catch (SmtpError $e) {
            $this->reconnect();
        }

        $token = base64_encode("\0" . $user . "\0" . $pass);
        $this->cmd('AUTH PLAIN ' . $token, 235);
    }

    private function reconnect(): void
    {
        $this->close();
        $this->connect();
        $this->cmd('EHLO studyflow', 250);
        if (! $this->secure && $this->supportsStartTls()) {
            $this->cmd('STARTTLS', 220);
            stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $this->cmd('EHLO studyflow', 250);
        }
    }

    private function quit(): void
    {
        try {
            $this->cmd('QUIT', 221);
        } catch (Throwable $e) {
            // server kadang menutup lebih dulu; bukan masalah.
        }
        $this->close();
    }

    private function close(): void
    {
        if (is_resource($this->socket)) {
            @fclose($this->socket);
        }
        $this->socket = null;
    }

    // --------------------------------------------------------------- protokol
    private function write(string $data): void
    {
        if (! is_resource($this->socket)) {
            throw new SmtpError('Koneksi SMTP sudah tertutup.');
        }
        if (@fwrite($this->socket, $data . "\r\n") === false) {
            throw new SmtpError('Gagal mengirim data ke server SMTP.');
        }
    }

    private function read(): string
    {
        if (! is_resource($this->socket)) {
            throw new SmtpError('Koneksi SMTP sudah tertutup.');
        }
        $lines = [];
        while (($line = fgets($this->socket, 2048)) !== false) {
            $lines[] = rtrim($line, "\r\n");
            if (preg_match('/^\d{3} /', $line) === 1) {
                break;
            }
        }
        if (! $lines) {
            throw new SmtpError('Server SMTP tidak menjawab.');
        }
        $response = end($lines);
        $this->transcript = $lines;

        return $response;
    }

    /** @param int|int[] $expect */
    private function cmd(string $command, int|array $expect): string
    {
        $this->write($command);
        $response = $this->read();
        if (! $this->isOk($response, $expect)) {
            throw new SmtpError('Perintah SMTP "' . preg_replace('/^AUTH .*/', 'AUTH ***', $command) . '" gagal: ' . $response);
        }

        return $response;
    }

    /** @param int|int[] $expect */
    private function isOk(string $response, int|array $expect): bool
    {
        $codes = is_array($expect) ? $expect : [$expect];
        $code = (int) substr($response, 0, 3);

        return in_array($code, $codes, true);
    }

    private function extractAddress(string $value): string
    {
        if (preg_match('/<([^>]+)>/', $value, $m) === 1) {
            return $m[1];
        }

        return trim($value);
    }

    // ----------------------------------------------------------------- pesan
    private function buildMessage(string $from, string $to, string $subject, string $text, ?string $html): string
    {
        $domain = 'studyflow.local';
        $fromAddress = $this->extractAddress($from);
        if (str_contains($fromAddress, '@')) {
            $domain = substr($fromAddress, strpos($fromAddress, '@') + 1);
        }
        $messageId = '<' . bin2hex(random_bytes(12)) . '@' . $domain . '>';
        $this->lastMessageId = $messageId;

        $headers = [
            'Date: ' . date('r'),
            'From: ' . $from,
            'To: ' . $to,
            'Subject: ' . $this->encodeHeader($subject),
            'Message-ID: ' . $messageId,
            'MIME-Version: 1.0',
            'X-Mailer: StudyFlow',
        ];

        if ($html === null || $html === '') {
            $headers[] = 'Content-Type: text/plain; charset=UTF-8';
            $headers[] = 'Content-Transfer-Encoding: base64';
            $body = chunk_split(base64_encode($text), 76, "\r\n");

            return implode("\r\n", $headers) . "\r\n\r\n" . $body;
        }

        $boundary = 'sf-' . bin2hex(random_bytes(12));
        $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';

        $parts = [];
        $parts[] = '--' . $boundary . "\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($text), 76, "\r\n");
        $parts[] = '--' . $boundary . "\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html), 76, "\r\n");
        $parts[] = '--' . $boundary . "--\r\n";

        return implode("\r\n", $headers) . "\r\n\r\n" . implode('', $parts);
    }

    private function encodeHeader(string $value): string
    {
        if (preg_match('/[\x80-\xFF]/', $value) !== 1) {
            return $value;
        }

        return '=?UTF-8?B?' . base64_encode($value) . '?=';
    }
}
