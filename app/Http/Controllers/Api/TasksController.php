<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Repo;
use App\Support\ApiError;
use App\Support\Dates;
use App\Support\Db;
use App\Support\Jwt;
use App\Support\Validator;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * /api/tasks - daftar, tambah, ubah, hapus, selesai, toggle pengingat.
 * Semua pesan & bentuk respons sama dengan tasks.controller/service versi Node.
 */
final class TasksController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $session = Jwt::requireUser($request);

        return $this->json(Repo::tasksForUser($session['id']));
    }

    public function store(Request $request): JsonResponse
    {
        $session = Jwt::requireUser($request);

        $v = Validator::make($request->json()->all())->only([
            'name', 'course', 'weight', 'difficulty', 'hours', 'deadline', 'startAt', 'subtasks', 'emailReminder',
        ]);
        $v->string('name', true, 1, 255)
            ->string('course', true, 1, 255)
            ->number('weight', true, 1, 100)
            ->number('difficulty', true, 1, 5)
            ->number('hours', true, 0.5, 1000)
            ->dateString('deadline', true)
            ->dateString('startAt', false, true)
            ->subtaskList('subtasks')
            ->boolean('emailReminder');
        $v->finish();

        $deadline = Dates::parse((string) $v->get('deadline'));
        if ($deadline === null) {
            throw new ApiError(400, 'Tenggat harus berupa tanggal yang valid.');
        }
        Repo::assertDeadline($deadline);

        $name = trim((string) $v->get('name'));
        $course = trim((string) $v->get('course'));
        if ($name === '') {
            throw new ApiError(400, 'Nama tugas wajib diisi.');
        }
        if ($course === '') {
            throw new ApiError(400, 'Mata kuliah wajib diisi.');
        }

        $startAt = $v->has('startAt') ? Dates::parse($v->get('startAt')) : null;
        $emailReminder = ! $v->has('emailReminder') ? true : (bool) $v->get('emailReminder');

        $id = Db::cuid();
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            Db::run(
                'INSERT INTO `Task` (`id`,`userId`,`name`,`course`,`weight`,`difficulty`,`hours`,`deadline`,`startAt`,`emailReminder`,`createdAt`)'
                . ' VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3))',
                [
                    $id,
                    $session['id'],
                    $name,
                    $course,
                    (float) $v->get('weight'),
                    (int) $v->get('difficulty'),
                    (float) $v->get('hours'),
                    Dates::toDb($deadline),
                    Dates::toDb($startAt),
                    $emailReminder ? 1 : 0,
                ]
            );

            $position = 0;
            foreach ((array) $v->get('subtasks', []) as $item) {
                $subName = trim((string) ($item['name'] ?? ''));
                if ($subName === '') {
                    continue;
                }
                Db::run(
                    'INSERT INTO `Subtask` (`id`,`taskId`,`name`,`done`,`position`,`createdAt`) VALUES (?,?,?,0,?,UTC_TIMESTAMP(3))',
                    [Db::cuid(), $id, $subName, $position]
                );
                $position++;
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $row = Db::one('SELECT * FROM `Task` WHERE `id` = ?', [$id]);

        return $this->json(Repo::taskShape($row ?? [], Repo::subtasksFor($id)), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $session = Jwt::requireUser($request);

        $v = Validator::make($request->json()->all())->only([
            'name', 'course', 'weight', 'difficulty', 'hours', 'deadline', 'startAt', 'emailReminder',
        ]);
        $v->string('name', false, 1, 255)
            ->string('course', false, 1, 255)
            ->number('weight', false, 1, 100)
            ->number('difficulty', false, 1, 5)
            ->number('hours', false, 0.5, 1000)
            ->dateString('deadline', false, true)
            ->dateString('startAt', false, true)
            ->boolean('emailReminder');
        $v->finish();

        $task = Repo::ownedTask($session['id'], $id);

        $fields = [];
        $params = [];

        if ($v->has('name')) {
            $name = trim((string) $v->get('name'));
            if ($name === '') {
                throw new ApiError(400, 'Nama tugas wajib diisi.');
            }
            $fields[] = '`name` = ?';
            $params[] = $name;
        }
        if ($v->has('course')) {
            $course = trim((string) $v->get('course'));
            if ($course === '') {
                throw new ApiError(400, 'Mata kuliah wajib diisi.');
            }
            $fields[] = '`course` = ?';
            $params[] = $course;
        }
        if ($v->has('weight')) {
            $fields[] = '`weight` = ?';
            $params[] = (float) $v->get('weight');
        }
        if ($v->has('difficulty')) {
            $fields[] = '`difficulty` = ?';
            $params[] = (int) $v->get('difficulty');
        }
        if ($v->has('hours')) {
            $fields[] = '`hours` = ?';
            $params[] = (float) $v->get('hours');
        }
        if ($v->has('deadline')) {
            $next = Dates::parse((string) $v->get('deadline'));
            if ($next === null) {
                throw new ApiError(400, 'Tenggat harus berupa tanggal yang valid.');
            }
            $current = Dates::fromDb($task['deadline'] ?? null);
            if ($current === null || $next->getTimestamp() !== $current->getTimestamp()) {
                Repo::assertDeadline($next);
                $fields[] = '`deadline` = ?';
                $params[] = Dates::toDb($next);
            }
        }
        if ($v->has('startAt')) {
            $fields[] = '`startAt` = ?';
            $params[] = Dates::toDb(Dates::parse($v->get('startAt')));
        }
        if ($v->has('emailReminder')) {
            $fields[] = '`emailReminder` = ?';
            $params[] = ((bool) $v->get('emailReminder')) ? 1 : 0;
        }

        if ($fields) {
            $params[] = $id;
            Db::run('UPDATE `Task` SET ' . implode(', ', $fields) . ' WHERE `id` = ?', $params);
        }

        $row = Db::one('SELECT * FROM `Task` WHERE `id` = ?', [$id]);

        return $this->json(Repo::taskShape($row ?? [], Repo::subtasksFor($id)));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $session = Jwt::requireUser($request);
        Repo::ownedTask($session['id'], $id);
        Db::run('DELETE FROM `Task` WHERE `id` = ?', [$id]);

        return $this->json(['ok' => true]);
    }

    public function complete(Request $request, string $id): JsonResponse
    {
        $session = Jwt::requireUser($request);

        $v = Validator::make($request->json()->all())->only(['done']);
        $v->boolean('done', true);
        $v->finish();

        $task = Db::one('SELECT * FROM `Task` WHERE `id` = ? AND `userId` = ? LIMIT 1', [$id, $session['id']]);
        if ($task === null) {
            throw new ApiError(404, 'Tugas tidak ditemukan');
        }

        $subtasks = Repo::subtasksFor($id);
        $done = (bool) $v->get('done');
        if ($done) {
            foreach ($subtasks as $s) {
                if (! (bool) $s['done']) {
                    throw new ApiError(400, 'Centang semua subtugas sebelum menyelesaikan tugas.');
                }
            }
        }

        Db::run(
            'UPDATE `Task` SET `completedAt` = ? WHERE `id` = ?',
            [$done ? Dates::toDb(new DateTimeImmutable('now', new DateTimeZone('UTC'))) : null, $id]
        );

        $row = Db::one('SELECT * FROM `Task` WHERE `id` = ?', [$id]);

        return $this->json(Repo::taskShape($row ?? [], Repo::subtasksFor($id)));
    }

    public function reminder(Request $request, string $id): JsonResponse
    {
        $session = Jwt::requireUser($request);

        $v = Validator::make($request->json()->all())->only(['enabled']);
        $v->boolean('enabled', true);
        $v->finish();

        Repo::ownedTask($session['id'], $id);
        $enabled = (bool) $v->get('enabled');
        Db::run('UPDATE `Task` SET `emailReminder` = ? WHERE `id` = ?', [$enabled ? 1 : 0, $id]);

        // Saat pengingat dinyalakan lagi, hapus penanda jadwal ke depan agar email terkirim ulang.
        if ($enabled) {
            Db::run('DELETE FROM `NotificationLog` WHERE `taskId` = ? AND `scheduledFor` > UTC_TIMESTAMP(3)', [$id]);
        }

        $row = Db::one('SELECT * FROM `Task` WHERE `id` = ?', [$id]);

        return $this->json(Repo::taskShape($row ?? [], Repo::subtasksFor($id)));
    }
}
