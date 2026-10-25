<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\NotificationsController;
use App\Http\Controllers\Api\SubtasksController;
use App\Http\Controllers\Api\TasksController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API StudyFlow
|--------------------------------------------------------------------------
| Path publik sama seperti versi Node:
|   /api/auth/login, /api/tasks, /api/tasks/:id/subtasks,
|   /api/notifications/status, /api/health, dst.
*/

Route::get('health', [HealthController::class, 'index']);

Route::post('auth/register', [AuthController::class, 'register']);
Route::post('auth/login', [AuthController::class, 'login']);
Route::post('auth/logout', [AuthController::class, 'logout']);
Route::get('auth/me', [AuthController::class, 'me']);

Route::get('tasks', [TasksController::class, 'index']);
Route::post('tasks', [TasksController::class, 'store']);
Route::patch('tasks/{id}', [TasksController::class, 'update']);
Route::delete('tasks/{id}', [TasksController::class, 'destroy']);
Route::patch('tasks/{id}/complete', [TasksController::class, 'complete']);
Route::patch('tasks/{id}/reminder', [TasksController::class, 'reminder']);

Route::patch('tasks/{id}/subtasks/reorder', [SubtasksController::class, 'reorder']);
Route::post('tasks/{id}/subtasks', [SubtasksController::class, 'store']);
Route::patch('tasks/{id}/subtasks/{sid}', [SubtasksController::class, 'update']);
Route::delete('tasks/{id}/subtasks/{sid}', [SubtasksController::class, 'destroy']);

Route::get('notifications/status', [NotificationsController::class, 'status']);
Route::get('notifications/schedule', [NotificationsController::class, 'schedule']);
Route::post('notifications/test', [NotificationsController::class, 'test']);
Route::post('notifications/remind', [NotificationsController::class, 'remind']);

// Fallback: pesan sama seperti Express/NestJS versi Node ("Cannot GET /api/...").
Route::any('{any}', function () {
    $method = request()->getMethod();
    // Path tanpa BASE_PATH, persis seperti req.originalUrl di Express.
    $path = '/' . ltrim(request()->getPathInfo(), '/');
    $base = '/' . trim((string) config('studyflow.base_path', ''), '/');
    if ($base !== '/' && str_starts_with($path, $base . '/')) {
        $path = substr($path, strlen($base));
    }

    return response()->json([
        'message' => 'Cannot ' . $method . ' ' . $path,
        'error' => 'Not Found',
        'statusCode' => 404,
    ], 404, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
})->where('any', '.*');
