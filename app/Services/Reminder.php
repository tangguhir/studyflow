<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\Dates;
use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;

/**
 * Susun subjek/teks/html pengingat untuk satu tugas.
 * Sama persis dengan buildTaskReminder() versi Node/PHP.
 */
final class Reminder
{
    public const KINDS = ['deadline-1d', 'deadline-hours', 'start', 'manual'];

    public static function difficultyLabel(float $value): string
    {
        return match ((int) $value) {
            1 => 'Mudah',
            2 => 'Sedang',
            3 => 'Sulit',
            4 => 'Sangat sulit',
            5 => 'Sangat sulit',
            default => 'Tidak diketahui',
        };
    }

    public static function difficultyScale(float $value): int
    {
        return $value > 3 ? 5 : 3;
    }

    /** Tanggal panjang untuk email: "Minggu, 25 Oktober 2026 pukul 09.50 WIB". */
    public static function mailDate(?DateTimeInterface $date): string
    {
        if ($date === null) {
            return '-';
        }

        return Dates::id($date, true, true, true) . ' WIB';
    }

    /**
     * Jadwal pengingat otomatis (maksimal 3 email), urut waktu:
     * deadline-1d, deadline-hours (N jam sebelum tenggat), start (rencana mulai).
     *
     * @return array<int, array{kind:string, at:DateTimeImmutable}>
     */
    public static function schedule(?DateTimeInterface $deadline, float $hours, ?DateTimeInterface $startAt): array
    {
        if ($deadline === null) {
            return [];
        }
        $due = $deadline->getTimestamp();

        $events = [
            ['kind' => 'deadline-1d', 'at' => (new DateTimeImmutable('@' . ($due - 86400)))->setTimezone(new DateTimeZone('UTC'))],
        ];

        if (is_finite($hours) && $hours > 0) {
            $at = $due - (int) round($hours * 3600);
            if ($at !== $due - 86400) {
                $events[] = ['kind' => 'deadline-hours', 'at' => (new DateTimeImmutable('@' . $at))->setTimezone(new DateTimeZone('UTC'))];
            }
        }

        if ($startAt !== null) {
            $at = $startAt->getTimestamp();
            $exists = false;
            foreach ($events as $e) {
                if ($e['at']->getTimestamp() === $at) {
                    $exists = true;
                    break;
                }
            }
            if (! $exists) {
                $events[] = ['kind' => 'start', 'at' => (new DateTimeImmutable('@' . $at))->setTimezone(new DateTimeZone('UTC'))];
            }
        }

        usort($events, static fn ($a, $b) => $a['at']->getTimestamp() <=> $b['at']->getTimestamp());

        return $events;
    }
}
