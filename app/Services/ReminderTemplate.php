<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\Dates;
use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;

/**
 * Isi email pengingat (subjek, teks polos, HTML) — identik dengan
 * buildTaskReminder() versi Node.
 */
final class ReminderTemplate
{
    public static function build(array $task, string $userName, string $kind = 'manual'): array
    {
        $subtasks = $task['subtasks'] ?? [];
        usort($subtasks, static fn ($a, $b) => ((int) ($a['position'] ?? 0)) <=> ((int) ($b['position'] ?? 0)));
        $doneCount = count(array_filter($subtasks, static fn ($s) => (bool) $s['done']));

        $deadline = $task['deadline'] instanceof DateTimeInterface
            ? $task['deadline']
            : (Dates::parse(is_string($task['deadline']) ? $task['deadline'] : null) ?? new DateTimeImmutable('now', new DateTimeZone('UTC')));
        $daysLeft = (int) ceil(($deadline->getTimestamp() - time()) / 86400);

        $leftLabel = $daysLeft < 0
            ? 'sudah lewat'
            : ($daysLeft === 0
                ? 'hari ini'
                : ($daysLeft === 1 ? 'besok' : $daysLeft . ' hari lagi'));

        $startAt = null;
        if (! empty($task['startAt'])) {
            $startAt = $task['startAt'] instanceof DateTimeInterface
                ? $task['startAt']
                : Dates::parse(is_string($task['startAt']) ? $task['startAt'] : null);
        }
        $hours = (float) $task['hours'];

        if ($kind === 'deadline-hours') {
            $intro = 'Tenggat tugas ini tinggal sekitar ' . Dates::duration($hours)
                . ' lagi — sepadan dengan estimasi pengerjaan yang kamu rencanakan. Sebaiknya mulai sekarang agar selesai tepat waktu.';
        } elseif ($kind === 'start') {
            $intro = 'Ini waktu yang kamu rencanakan untuk mulai mengerjakan tugas ini'
                . ($startAt ? ' (' . Reminder::mailDate($startAt) . ')' : '')
                . '. Yuk mulai sekarang agar tidak menumpuk menjelang tenggat.';
        } elseif ($kind === 'manual') {
            $intro = 'Berikut pengingat untuk tugasmu di StudyFlow.';
        } else {
            $intro = 'Tenggat tugas ini tinggal satu hari lagi (' . Reminder::mailDate($deadline) . '). Sebaiknya siapkan waktunya mulai sekarang.';
        }

        if ($kind === 'deadline-hours') {
            $subject = 'StudyFlow - ' . Dates::duration($hours) . ' lagi: ' . $task['name'];
        } elseif ($kind === 'start') {
            $subject = 'StudyFlow - Waktunya mulai: ' . $task['name'];
        } elseif ($kind === 'manual') {
            $subject = 'StudyFlow - Pengingat tugas: ' . $task['name'];
        } else {
            $subject = 'StudyFlow - Besok tenggat: ' . $task['name'];
        }

        $rows = [
            ['Nama tugas', (string) $task['name']],
            ['Mata kuliah', (string) $task['course']],
            ['Deadline', Reminder::mailDate($deadline) . ' (' . $leftLabel . ')'],
            ['Tingkat kesulitan', Reminder::difficultyLabel((float) $task['difficulty']) . ' (' . (int) $task['difficulty'] . '/' . Reminder::difficultyScale((float) $task['difficulty']) . ')'],
            ['Estimasi pengerjaan', Dates::duration($hours)],
        ];
        if ($startAt) {
            $rows[] = ['Rencana mulai', Reminder::mailDate($startAt)];
        }
        if (isset($task['weight']) && $task['weight'] !== null && is_finite((float) $task['weight'])) {
            $rows[] = ['Bobot nilai', Dates::jsNumber((float) $task['weight']) . '%'];
        }
        $rows[] = ['Status', 'Belum selesai'];

        $lines = [
            'Halo ' . $userName . ',',
            '',
            $intro,
            '',
            'DETAIL TUGAS',
        ];
        foreach ($rows as [$k, $v]) {
            $lines[] = '- ' . $k . ': ' . $v;
        }
        if ($subtasks) {
            $lines[] = '';
            $lines[] = 'SUBTUGAS (' . $doneCount . '/' . count($subtasks) . ' selesai)';
            foreach ($subtasks as $s) {
                $lines[] = ((bool) $s['done'] ? '[x]' : '[ ]') . ' ' . $s['name'];
            }
        }
        $lines[] = '';
        $lines[] = 'Buka StudyFlow: ' . Mailer::appUrl();
        $lines[] = '';
        $lines[] = 'Email otomatis dari StudyFlow. Kamu menerimanya karena pengingat tugas aktif di akunmu.';

        return [
            'subject' => $subject,
            'text' => implode("\n", $lines),
            'html' => self::html($subject, $userName, $intro, $rows, $subtasks, $doneCount),
        ];
    }

    private static function html(string $subject, string $userName, string $intro, array $rows, array $subtasks, int $doneCount): string
    {
        $detailRows = '';
        foreach ($rows as [$k, $v]) {
            $detailRows .= '<tr><td style="padding:7px 0;color:#7b8095;font-size:13px;width:42%;vertical-align:top">' . Mailer::escape((string) $k) . '</td>'
                . '<td style="padding:7px 0;color:#1f2333;font-size:13px;font-weight:600;vertical-align:top">' . Mailer::escape((string) $v) . '</td></tr>';
        }

        $subtaskHtml = '';
        if ($subtasks) {
            $subtaskHtml .= '<div style="margin:18px 0 0">'
                . '<div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#7b8095;margin-bottom:8px">Subtask ('
                . $doneCount . '/' . count($subtasks) . ' selesai)</div>';
            foreach ($subtasks as $s) {
                $done = (bool) $s['done'];
                $subtaskHtml .= '<div style="font-size:13px;color:' . ($done ? '#9aa0b4' : '#1f2333') . ';padding:4px 0;'
                    . ($done ? 'text-decoration:line-through' : '') . '">'
                    . ($done ? '&#10003;' : '&#9744;') . ' ' . Mailer::escape((string) $s['name']) . '</div>';
            }
            $subtaskHtml .= '</div>';
        }

        return '<div style="font-family:system-ui,-apple-system,\'Segoe UI\',sans-serif;max-width:560px;color:#1f2333;background:#ffffff">'
            . '<div style="height:4px;background:#5b5bd6;border-radius:4px 4px 0 0"></div>'
            . '<div style="border:1px solid #e8e9f2;border-top:0;border-radius:0 0 12px 12px;padding:22px 24px">'
            . '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5b5bd6;font-weight:700;margin-bottom:6px">'
            . '<img src="' . Mailer::escape(Mailer::appUrl() . '/assets/logo-email.png') . '" width="26" height="20" alt="" style="display:inline-block;vertical-align:-3px;margin-right:7px;border:0;outline:none">'
            . 'StudyFlow</div>'
            . '<h2 style="font-size:18px;line-height:1.35;margin:0 0 10px">' . Mailer::escape($subject) . '</h2>'
            . '<p style="margin:0 0 6px;font-size:14px;color:#1f2333;line-height:1.5;font-weight:600">Halo, ' . Mailer::escape($userName) . ',</p>'
            . '<p style="margin:0 0 18px;font-size:14px;color:#4a4f66;line-height:1.5">' . Mailer::escape($intro) . '</p>'
            . '<div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#7b8095;margin-bottom:2px">Detail tugas</div>'
            . '<table role="presentation" style="width:100%;border-collapse:collapse">' . $detailRows . '</table>'
            . $subtaskHtml
            . '<div style="margin-top:22px"><a href="' . Mailer::escape(Mailer::appUrl()) . '" style="display:inline-block;background:#5b5bd6;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px">Buka StudyFlow</a></div>'
            . '</div>'
            . '<p style="margin:14px 0 0;font-size:12px;color:#7b8095">Email otomatis dari StudyFlow. Kamu menerimanya karena pengingat tugas aktif di akunmu.</p>'
            . '</div>';
    }
}
