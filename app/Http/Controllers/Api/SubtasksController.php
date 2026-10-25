<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Repo;
use App\Support\ApiError;
use App\Support\Db;
use App\Support\Jwt;
use App\Support\Validator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * /api/tasks/:id/subtasks - tambah, ubah, hapus, urutkan subtugas.
 */
final class SubtasksController extends Controller
{
    public function store(Request $request, string $id): JsonResponse
    {
        $session = Jwt::requireUser($request);

        $v = Validator::make($request->json()->all())->only(['name']);
        $v->string('name', true, 1, 200);
        $v->finish();

        $task = Repo::ownedTask($session['id'], $id);
        $clean = trim((string) $v->get('name'));
        if ($clean === '') {
            throw new ApiError(400, 'Nama subtugas wajib diisi.');
        }

        $last = Db::one('SELECT MAX(`position`) AS `maxPos` FROM `Subtask` WHERE `taskId` = ?', [$id]);
        $position = ($last['maxPos'] === null ? -1 : (int) $last['maxPos']) + 1;
        $sid = Db::cuid();
        Db::run(
            'INSERT INTO `Subtask` (`id`,`taskId`,`name`,`done`,`position`,`createdAt`) VALUES (?,?,?,0,?,UTC_TIMESTAMP(3))',
            [$sid, $id, $clean, $position]
        );

        if ($task['completedAt'] !== null) {
            Db::run('UPDATE `Task` SET `completedAt` = NULL WHERE `id` = ?', [$id]);
        }

        return $this->json(Repo::subtaskShape(Db::one('SELECT * FROM `Subtask` WHERE `id` = ?', [$sid]) ?? []), 201);
    }

    public function update(Request $request, string $id, string $sid): JsonResponse
    {
        $session = Jwt::requireUser($request);

        $v = Validator::make($request->json()->all())->only(['name', 'done']);
        $v->string('name', false, 1, 200)->boolean('done');
        $v->finish();

        $task = Repo::ownedTask($session['id'], $id);
        $subtask = Db::one('SELECT * FROM `Subtask` WHERE `id` = ? AND `taskId` = ? LIMIT 1', [$sid, $id]);
        if ($subtask === null) {
            throw new ApiError(404, 'Subtugas tidak ditemukan');
        }

        $fields = [];
        $params = [];
        if ($v->has('name')) {
            $clean = trim((string) $v->get('name'));
            if ($clean === '') {
                throw new ApiError(400, 'Nama subtugas wajib diisi.');
            }
            $fields[] = '`name` = ?';
            $params[] = $clean;
        }
        if ($v->has('done')) {
            $fields[] = '`done` = ?';
            $params[] = ((bool) $v->get('done')) ? 1 : 0;
        }
        if ($fields) {
            $params[] = $sid;
            Db::run('UPDATE `Subtask` SET ' . implode(', ', $fields) . ' WHERE `id` = ?', $params);
        }

        if ($v->has('done') && $v->get('done') === false && $task['completedAt'] !== null) {
            Db::run('UPDATE `Task` SET `completedAt` = NULL WHERE `id` = ?', [$id]);
        }

        return $this->json(Repo::subtaskShape(Db::one('SELECT * FROM `Subtask` WHERE `id` = ?', [$sid]) ?? []));
    }

    public function destroy(Request $request, string $id, string $sid): JsonResponse
    {
        $session = Jwt::requireUser($request);
        Repo::ownedTask($session['id'], $id);

        $subtask = Db::one('SELECT * FROM `Subtask` WHERE `id` = ? AND `taskId` = ? LIMIT 1', [$sid, $id]);
        if ($subtask === null) {
            throw new ApiError(404, 'Subtugas tidak ditemukan');
        }
        Db::run('DELETE FROM `Subtask` WHERE `id` = ?', [$sid]);

        return $this->json(['ok' => true]);
    }

    public function reorder(Request $request, string $id): JsonResponse
    {
        $session = Jwt::requireUser($request);

        $v = Validator::make($request->json()->all())->only(['ids']);
        $v->stringArray('ids', true);
        $v->finish();

        Repo::ownedTask($session['id'], $id);

        $current = Db::all('SELECT `id` FROM `Subtask` WHERE `taskId` = ?', [$id]);
        $ids = (array) $v->get('ids');
        $requested = array_values(array_unique($ids));

        if (count($requested) !== count($ids) || count($requested) !== count($current)) {
            throw new ApiError(400, 'Urutan subtugas tidak valid. Muat ulang halaman lalu coba lagi.');
        }
        $known = array_column($current, 'id');
        foreach ($requested as $sid) {
            if (! in_array($sid, $known, true)) {
                throw new ApiError(400, 'Urutan subtugas tidak valid. Muat ulang halaman lalu coba lagi.');
            }
        }

        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            foreach ($requested as $position => $sid) {
                Db::run('UPDATE `Subtask` SET `position` = ? WHERE `id` = ?', [$position, $sid]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return $this->json(array_map([Repo::class, 'subtaskShape'], Repo::subtasksFor($id)));
    }
}
