<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Mailer;
use App\Services\Reminder;
use App\Services\ReminderTemplate;
use App\Services\Repo;
use App\Support\Dates;
use App\Support\Db;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Console\Command;

/**
 * Cron pengingat email - logika identik dengan EmailReminderService.sendDue()
 * versi Node dan cron/reminders.php versi PHP:
 * - hanya tugas yang belum selesai dan pengingatnya menyala,
 * - maksimal 3 email: H-1 hari, H-N jam (N = estimasi jam), dan saat rencana mulai,
 * - jendela toleransi 30 menit agar pengingat tidak hilang bila cron tertunda,
 * - NotificationLog mencegah email yang sama terkirim dua kali.
 */
final class SendReminders extends Command
{
    protected $signature = 'studyflow:reminders {--token= : Token untuk pemanggilan lewat HTTP cron}';

    protected $description = 'Kirim email pengingat tugas StudyFlow yang sudah jatuh tempo';

    public function handle(): int
    {
        $provider = Mailer::provider();
        if ($provider === 'none') {
            $this->error('Pengiriman email nonaktif (isi RESEND_API_KEY atau SMTP_HOST).');

            return self::SUCCESS;
        }

        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $nowTs = $now->getTimestamp();
        $windowStart = $nowTs - (int) config('studyflow.cron_window', 1800);

        $rows = Db::all(
            'SELECT t.*, u.`email` AS `userEmail`, u.`name` AS `userName` FROM `Task` t'
            . ' JOIN `User` u ON u.`id` = t.`userId`'
            . ' WHERE t.`completedAt` IS NULL AND t.`emailReminder` = 1 AND ('
            . '   (t.`deadline` >= ? AND t.`deadline` <= ?)'
            . '   OR (t.`startAt` IS NOT NULL AND t.`startAt` >= ? AND t.`startAt` <= ?)'
            . ' )',
            [
                Dates::toDb(new DateTimeImmutable('@' . $windowStart)),
                Dates::toDb(new DateTimeImmutable('@' . ($nowTs + 86400 + 3600))),
                Dates::toDb(new DateTimeImmutable('@' . $windowStart)),
                Dates::toDb($now),
            ]
        );

        $sent = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($rows as $row) {
            if ($row['completedAt'] !== null || ! (bool) $row['emailReminder']) {
                continue;
            }

            $deadline = Dates::fromDb($row['deadline'] ?? null);
            $startAt = Dates::fromDb($row['startAt'] ?? null);
            $events = Reminder::schedule($deadline, (float) $row['hours'], $startAt);
            $task = Repo::taskShape($row, Repo::subtasksFor((string) $row['id']));

            foreach ($events as $event) {
                $at = $event['at']->getTimestamp();
                if ($at < $windowStart || $at > $nowTs) {
                    continue;
                }

                $prior = Db::one(
                    'SELECT `id` FROM `NotificationLog` WHERE `taskId` = ? AND `kind` = ? AND `scheduledFor` = ? LIMIT 1',
                    [$row['id'], $event['kind'], Dates::toDb($event['at'])]
                );
                if ($prior !== null) {
                    $skipped++;
                    continue;
                }

                $mail = ReminderTemplate::build($task, (string) $row['userName'], $event['kind']);
                $result = Mailer::sendWithRetry((string) $row['userEmail'], $mail['subject'], $mail['text'], $mail['html']);

                if (! $result['ok']) {
                    $error = (string) ($result['error'] ?? '');
                    // Masalah konfigurasi penyedia tidak akan sembuh dengan percobaan berikutnya;
                    // catat supaya tidak dicoba ulang setiap menit.
                    if (preg_match('/testing emails to your own email address|restricted_api_key/i', $error) === 1) {
                        $this->warn('Email ' . $event['kind'] . ' ke ' . $row['userEmail'] . ' ditolak penyedia: ' . $error);
                        $this->logSent($row, $event['kind'], $event['at']);
                    } else {
                        $this->warn('Email ' . $event['kind'] . ' ke ' . $row['userEmail'] . ' gagal: ' . $error);
                    }
                    $failed++;
                    continue;
                }

                $this->logSent($row, $event['kind'], $event['at']);
                $sent++;
                $this->line('Email ' . $event['kind'] . ' terkirim ke ' . $row['userEmail'] . ' (id: ' . ($result['id'] ?? '-') . ')');
            }
        }

        $this->line(
            'StudyFlow cron: provider=' . $provider . ' kandidat=' . count($rows) . ' terkirim=' . $sent
            . ' dilewati=' . $skipped . ' gagal=' . $failed
        );

        return self::SUCCESS;
    }

    private function logSent(array $row, string $kind, \DateTimeInterface $at): void
    {
        Db::run(
            'INSERT IGNORE INTO `NotificationLog` (`id`,`userId`,`taskId`,`kind`,`scheduledFor`,`sentAt`) VALUES (?,?,?,?,?,UTC_TIMESTAMP(3))',
            [Db::cuid(), $row['userId'], $row['id'], $kind, Dates::toDb($at)]
        );
    }
}
