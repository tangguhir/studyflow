<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Mailer;
use App\Services\Reminder;
use App\Services\ReminderSender;
use App\Services\Repo;
use App\Support\ApiError;
use App\Support\Dates;
use App\Support\Db;
use App\Support\Jwt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * /api/notifications/* - status penyedia email, jadwal pengingat,
 * email uji, dan kirim pengingat manual.
 */
final class NotificationsController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        Jwt::requireUser($request);

        $from = Mailer::from();
        $provider = Mailer::provider();
        $resendSandbox = $provider === 'resend' && preg_match('/@resend\.dev>?$/i', trim($from)) === 1;
        $localInbox = Mailer::localInbox();
        $delivers = Mailer::deliversToRealInbox() && ! $resendSandbox;

        $hint = $localInbox
            ? 'Email saat ini hanya masuk inbox uji lokal (Mailpit di http://localhost:8025), tidak sampai ke Gmail. Isi SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER, dan SMTP_PASS (App Password) di apps/api/.env.'
            : ($resendSandbox
                ? 'Pengirim masih onboarding@resend.dev (alamat uji Resend), jadi email hanya bisa dikirim ke email pemilik akun Resend. Verifikasi domain di resend.com/domains lalu set RESEND_FROM ke alamat domain itu agar pengingat sampai ke semua pengguna.'
                : ($delivers ? null : 'Pengiriman email belum dikonfigurasi. Isi SMTP_* atau RESEND_API_KEY di apps/api/.env.'));

        return $this->json([
            'provider' => $provider,
            'from' => $from,
            'appUrl' => Mailer::appUrl(),
            'configured' => $provider !== 'none',
            'localInbox' => $localInbox,
            'deliversToRealInbox' => $delivers,
            'resendSandbox' => $resendSandbox,
            'hint' => $hint,
        ]);
    }

    public function schedule(Request $request): JsonResponse
    {
        $session = Jwt::requireUser($request);
        $user = Repo::userById($session['id']);
        if ($user === null) {
            throw new ApiError(400, 'Akun tidak ditemukan.');
        }

        $rows = Db::all(
            'SELECT `id`,`name`,`course`,`deadline`,`startAt`,`hours`,`emailReminder`,`completedAt` FROM `Task`'
            . ' WHERE `userId` = ? ORDER BY `deadline` ASC',
            [$user['id']]
        );

        $tasks = [];
        foreach ($rows as $row) {
            $deadline = Dates::fromDb($row['deadline'] ?? null);
            $startAt = Dates::fromDb($row['startAt'] ?? null);
            $completed = $row['completedAt'] !== null;
            $enabled = (bool) $row['emailReminder'];

            $reminders = [];
            if (! $completed && $enabled) {
                foreach (Reminder::schedule($deadline, (float) $row['hours'], $startAt) as $event) {
                    $reminders[] = ['kind' => $event['kind'], 'at' => Dates::out($event['at'])];
                }
            }

            $tasks[] = [
                'id' => (string) $row['id'],
                'name' => (string) $row['name'],
                'course' => (string) $row['course'],
                'emailReminder' => $enabled,
                'completed' => $completed,
                'reminders' => $reminders,
            ];
        }

        return $this->json([
            'to' => (string) $user['email'],
            'provider' => Mailer::provider(),
            'tasks' => $tasks,
        ]);
    }

    public function test(Request $request): JsonResponse
    {
        $session = Jwt::requireUser($request);
        $body = $request->json()->all();

        $user = Repo::userById($session['id']);
        if ($user === null) {
            throw new ApiError(400, 'Akun tidak ditemukan.');
        }

        if (! empty($body['taskId'])) {
            $task = Db::one('SELECT * FROM `Task` WHERE `id` = ? AND `userId` = ? LIMIT 1', [(string) $body['taskId'], $user['id']]);
            if ($task === null) {
                throw new ApiError(404, 'Tugas tidak ditemukan.');
            }
            $shaped = Repo::taskShape($task, Repo::subtasksFor((string) $task['id']));
            $result = ReminderSender::send((string) $user['email'], (string) $user['name'], $shaped, 'manual');
            if (! $result['ok']) {
                throw new ApiError(400, 'Gagal mengirim email: ' . Mailer::errorMessage($result));
            }

            return $this->json([
                'ok' => true,
                'to' => (string) $user['email'],
                'provider' => Mailer::provider(),
                'id' => (string) ($result['id'] ?? ''),
                'taskId' => (string) $task['id'],
            ], 201);
        }

        $result = Mailer::send(
            (string) $user['email'],
            'StudyFlow - Uji pengiriman email',
            "Halo {$user['name']},\n\nIni email uji dari StudyFlow. Jika kamu menerima pesan ini, pengingat tugas sudah aktif dan siap dikirim ke emailmu.\n\nPengirim: " . Mailer::from() . "\nPenyedia: " . Mailer::provider(),
        );
        if (! $result['ok']) {
            throw new ApiError(400, 'Gagal mengirim email: ' . Mailer::errorMessage($result));
        }

        return $this->json([
            'ok' => true,
            'to' => (string) $user['email'],
            'provider' => Mailer::provider(),
            'id' => (string) ($result['id'] ?? ''),
        ], 201);
    }

    public function remind(Request $request): JsonResponse
    {
        $session = Jwt::requireUser($request);
        $body = $request->json()->all();

        if (empty($body['taskId'])) {
            throw new ApiError(400, 'taskId wajib diisi.');
        }

        $user = Repo::userById($session['id']);
        if ($user === null) {
            throw new ApiError(400, 'Akun tidak ditemukan.');
        }

        $task = Db::one('SELECT * FROM `Task` WHERE `id` = ? AND `userId` = ? LIMIT 1', [(string) $body['taskId'], $user['id']]);
        if ($task === null) {
            throw new ApiError(404, 'Tugas tidak ditemukan.');
        }
        if ($task['completedAt'] !== null) {
            throw new ApiError(400, 'Tugas ini sudah selesai, pengingat tidak dikirim.');
        }
        if (! (bool) $task['emailReminder']) {
            throw new ApiError(400, 'Pengingat email untuk tugas ini sedang dimatikan. Nyalakan dulu di tabel Pengingat email.');
        }

        $shaped = Repo::taskShape($task, Repo::subtasksFor((string) $task['id']));
        $result = ReminderSender::send((string) $user['email'], (string) $user['name'], $shaped, 'manual');
        if (! $result['ok']) {
            throw new ApiError(400, 'Gagal mengirim email: ' . Mailer::errorMessage($result));
        }

        return $this->json([
            'ok' => true,
            'to' => (string) $user['email'],
            'provider' => Mailer::provider(),
            'id' => (string) ($result['id'] ?? ''),
            'taskId' => (string) $task['id'],
            'task' => (string) $task['name'],
        ], 201);
    }
}
