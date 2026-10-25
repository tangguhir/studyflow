<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\ApiError;
use App\Support\Dates;
use App\Support\Db;
use DateTimeImmutable;

/**
 * Lapisan data: pengguna, tugas, subtugas, log notifikasi.
 * Bentuk array yang dikembalikan sama dengan hasil Prisma versi Node,
 * sehingga frontend tidak perlu diubah.
 */
final class Repo
{
    // ------------------------------------------------------------- pengguna
    public static function userByEmail(string $email): ?array
    {
        return Db::one('SELECT * FROM `User` WHERE `email` = ? LIMIT 1', [$email]);
    }

    public static function userById(string $id): ?array
    {
        return Db::one('SELECT * FROM `User` WHERE `id` = ? LIMIT 1', [$id]);
    }

    public static function userPublic(array $user): array
    {
        return [
            'id' => (string) $user['id'],
            'email' => (string) $user['email'],
            'name' => (string) $user['name'],
        ];
    }

    public static function createUser(string $email, string $name, string $password): array
    {
        $id = Db::cuid();
        Db::run(
            'INSERT INTO `User` (`id`, `email`, `name`, `passwordHash`, `createdAt`) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))',
            [$id, $email, $name, password_hash($password, PASSWORD_BCRYPT, ['cost' => 12])]
        );

        return self::userById($id) ?? [];
    }

    // ---------------------------------------------------------------- tugas
    /** Satu tugas + subtugas, siap dikirim sebagai JSON. */
    public static function taskShape(array $row, array $subtasks = []): array
    {
        return [
            'id' => (string) $row['id'],
            'userId' => (string) $row['userId'],
            'name' => (string) $row['name'],
            'course' => (string) $row['course'],
            'weight' => (float) $row['weight'],
            'difficulty' => (int) $row['difficulty'],
            'hours' => (float) $row['hours'],
            'deadline' => Dates::out(Dates::fromDb($row['deadline'])),
            'startAt' => Dates::out(Dates::fromDb($row['startAt'] ?? null)),
            'completedAt' => Dates::out(Dates::fromDb($row['completedAt'] ?? null)),
            'emailReminder' => (bool) $row['emailReminder'],
            'createdAt' => Dates::out(Dates::fromDb($row['createdAt'] ?? null)),
            'subtasks' => array_map([self::class, 'subtaskShape'], $subtasks),
        ];
    }

    public static function subtaskShape(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'taskId' => (string) $row['taskId'],
            'name' => (string) $row['name'],
            'done' => (bool) $row['done'],
            'position' => (int) $row['position'],
            'createdAt' => Dates::out(Dates::fromDb($row['createdAt'] ?? null)),
        ];
    }

    /** Subtugas satu tugas, urut position lalu createdAt lalu id. */
    public static function subtasksFor(string $taskId): array
    {
        return Db::all(
            'SELECT * FROM `Subtask` WHERE `taskId` = ? ORDER BY `position` ASC, `createdAt` ASC, `id` ASC',
            [$taskId]
        );
    }

    /** Semua tugas satu pengguna (deadline ASC) lengkap dengan subtugasnya. */
    public static function tasksForUser(string $userId): array
    {
        $tasks = Db::all('SELECT * FROM `Task` WHERE `userId` = ? ORDER BY `deadline` ASC', [$userId]);
        if (! $tasks) {
            return [];
        }

        $ids = array_column($tasks, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $subs = Db::all(
            "SELECT * FROM `Subtask` WHERE `taskId` IN ($placeholders) ORDER BY `position` ASC, `createdAt` ASC, `id` ASC",
            $ids
        );

        $grouped = [];
        foreach ($subs as $sub) {
            $grouped[$sub['taskId']][] = $sub;
        }

        return array_map(
            static fn (array $task) => self::taskShape($task, $grouped[$task['id']] ?? []),
            $tasks
        );
    }

    /** Tugas milik pengguna atau 404 (pesan sama dengan tasks.service.ts). */
    public static function ownedTask(string $userId, string $id): array
    {
        $task = Db::one('SELECT * FROM `Task` WHERE `id` = ? AND `userId` = ? LIMIT 1', [$id, $userId]);
        if ($task === null) {
            throw new ApiError(404, 'Tugas tidak ditemukan');
        }

        return $task;
    }

    /** Tenggat tidak boleh lampau (assertDeadline). */
    public static function assertDeadline(DateTimeImmutable $deadline): void
    {
        if ($deadline->getTimestamp() < time()) {
            throw new ApiError(400, 'Tenggat tugas tidak boleh sebelum hari ini.');
        }
    }
}
