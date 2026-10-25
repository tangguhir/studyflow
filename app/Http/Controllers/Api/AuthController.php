<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Repo;
use App\Support\ApiError;
use App\Support\Jwt;
use App\Support\Validator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * /api/auth/* - register, login, logout, me.
 * Bentuk respons & pesan error identik dengan versi Node.
 */
final class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $v = Validator::make($request->json()->all())->only(['email', 'password', 'name']);
        $v->string('email', true, 0, 0, true)
            ->string('password', true, 8)
            ->string('name', true, 2);
        $v->finish();

        $email = strtolower(trim((string) $v->get('email')));
        $name = trim((string) $v->get('name'));
        $password = (string) $v->get('password');

        if (Repo::userByEmail($email) !== null) {
            throw new ApiError(409, 'Email sudah terdaftar');
        }

        $user = Repo::createUser($email, $name, $password);
        $token = Jwt::sign(['sub' => (string) $user['id'], 'email' => (string) $user['email']]);

        return $this->json(Repo::userPublic($user), 201)
            ->withCookie(cookie(
                (string) config('studyflow.cookie', 'sf_token'),
                $token,
                (int) config('studyflow.jwt_ttl', 604800) / 60,
                '/',
                null,
                Jwt::isHttps(),
                true,
                false,
                'Lax',
            ));
    }

    public function login(Request $request): JsonResponse
    {
        $v = Validator::make($request->json()->all())->only(['email', 'password', 'name']);
        $v->string('email', true, 0, 0, true)
            ->string('password', true, 8);
        if ($v->has('name')) {
            $v->string('name');
        }
        $v->finish();

        $email = strtolower(trim((string) $v->get('email')));
        $user = Repo::userByEmail($email);
        if ($user === null || ! password_verify((string) $v->get('password'), (string) $user['passwordHash'])) {
            throw new ApiError(401, 'Email atau kata sandi salah');
        }

        $token = Jwt::sign(['sub' => (string) $user['id'], 'email' => (string) $user['email']]);

        return $this->json(Repo::userPublic($user))
            ->withCookie(cookie(
                (string) config('studyflow.cookie', 'sf_token'),
                $token,
                (int) config('studyflow.jwt_ttl', 604800) / 60,
                '/',
                null,
                Jwt::isHttps(),
                true,
                false,
                'Lax',
            ));
    }

    public function logout(): JsonResponse
    {
        return $this->json(['ok' => true])
            ->withCookie(cookie()->forget((string) config('studyflow.cookie', 'sf_token'), '/'));
    }

    public function me(Request $request): JsonResponse
    {
        $session = Jwt::requireUser($request);
        $user = Repo::userById($session['id']);
        if ($user === null) {
            throw new ApiError(401, 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.');
        }

        return $this->json(Repo::userPublic($user));
    }
}
