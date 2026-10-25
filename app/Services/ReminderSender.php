<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Kirim pengingat untuk satu tugas (dipakai endpoint manual & cron).
 */
final class ReminderSender
{
    public static function send(string $to, string $userName, array $task, string $kind = 'manual'): array
    {
        $mail = ReminderTemplate::build($task, $userName, $kind);

        return Mailer::send($to, $mail['subject'], $mail['text'], $mail['html']);
    }
}
