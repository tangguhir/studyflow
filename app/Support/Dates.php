<?php

declare(strict_types=1);

namespace App\Support;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Throwable;

/**
 * Helper tanggal: parse ISO-8601 -> UTC, format keluaran gaya Prisma,
 * dan format tampilan bahasa Indonesia (Intl 'id-ID').
 */
final class Dates
{
    private const DAYS = [
        'Sunday' => 'Minggu', 'Monday' => 'Senin', 'Tuesday' => 'Selasa',
        'Wednesday' => 'Rabu', 'Thursday' => 'Kamis', 'Friday' => 'Jumat', 'Saturday' => 'Sabtu',
    ];

    private const MONTHS = [
        'January' => 'Januari', 'February' => 'Februari', 'March' => 'Maret',
        'April' => 'April', 'May' => 'Mei', 'June' => 'Juni', 'July' => 'Juli',
        'August' => 'Agustus', 'September' => 'September', 'October' => 'Oktober',
        'November' => 'November', 'December' => 'Desember',
    ];

    public static function tz(): DateTimeZone
    {
        return new DateTimeZone((string) config('app.timezone', 'Asia/Jakarta'));
    }

    /** Parse string ISO-8601 menjadi DateTimeImmutable UTC, null bila tidak valid. */
    public static function parse(?string $value): ?DateTimeImmutable
    {
        if ($value === null || trim($value) === '') {
            return null;
        }
        try {
            $date = new DateTimeImmutable($value);
        } catch (Throwable $e) {
            return null;
        }
        // Tolak string yang bukan tanggal (mis. "abc", "besok").
        if (preg_match('/^\s*[A-Za-z]+\s*$/', $value) === 1) {
            return null;
        }

        return $date->setTimezone(new DateTimeZone('UTC'));
    }

    /** Format seperti JSON Prisma: 2026-10-25T02:50:00.000Z */
    public static function out(?DateTimeInterface $date): ?string
    {
        if ($date === null) {
            return null;
        }

        return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }

    /** Baca kolom datetime MySQL (UTC) menjadi DateTimeImmutable. */
    public static function fromDb(?string $value): ?DateTimeImmutable
    {
        if ($value === null || $value === '') {
            return null;
        }
        $date = DateTimeImmutable::createFromFormat('Y-m-d H:i:s.u', $value, new DateTimeZone('UTC'))
            ?: DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $value, new DateTimeZone('UTC'));

        return $date === false ? null : $date->setTimezone(new DateTimeZone('UTC'));
    }

    /** Simpan ke kolom DATETIME(3) MySQL (UTC). */
    public static function toDb(?DateTimeInterface $date): ?string
    {
        if ($date === null) {
            return null;
        }

        return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
    }

    /**
     * Tanggal gaya Indonesia seperti Intl.DateTimeFormat('id-ID'):
     * "Minggu, 25 Oktober 2026 pukul 09.50".
     */
    public static function id(DateTimeInterface $date, bool $withWeekday = true, bool $withTime = true, bool $withYear = true): string
    {
        $local = $date->setTimezone(self::tz());
        $parts = [];
        if ($withWeekday) {
            $parts[] = self::DAYS[$local->format('l')] . ',';
        }
        $parts[] = $local->format('j') . ' ' . self::MONTHS[$local->format('F')];
        if ($withYear) {
            $parts[] = $local->format('Y');
        }
        $text = implode(' ', $parts);
        if ($withTime) {
            $text .= ' pukul ' . $local->format('H.i');
        }

        return $text;
    }

    /** Angka gaya JavaScript: 4.0 -> "4", 1.5 -> "1,5". */
    public static function jsNumber(float $value): string
    {
        $text = (string) $value;
        if (str_contains($text, '.')) {
            $text = rtrim(rtrim($text, '0'), '.');
        }

        return str_replace('.', ',', $text);
    }

    /** 0,5 jam -> "30 menit"; 4 jam -> "4 jam". */
    public static function duration(float $hours): string
    {
        if (! is_finite($hours) || $hours <= 0) {
            return '-';
        }
        if ($hours < 1) {
            return ((int) round($hours * 60)) . ' menit';
        }

        return self::jsNumber($hours) . ' jam';
    }
}
