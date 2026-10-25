<?php

declare(strict_types=1);

namespace App\Support;

use PDO;
use PDOException;
use PDOStatement;
use RuntimeException;
use Throwable;

/**
 * Koneksi PDO tunggal + helper query.
 *
 * Skema MySQL identik dengan versi Node (Prisma): nama tabel & kolom sama,
 * sehingga database yang sudah berjalan dipakai langsung tanpa migrasi data.
 * Selalu UTC agar konsisten dengan Prisma.
 */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            (string) config('database.connections.mysql.host', '127.0.0.1'),
            (int) config('database.connections.mysql.port', 3306),
            (string) config('database.connections.mysql.database', 'studyflow'),
        );

        try {
            self::$pdo = new PDO(
                $dsn,
                (string) config('database.connections.mysql.username', 'studyflow'),
                (string) config('database.connections.mysql.password', ''),
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
            self::$pdo->exec("SET time_zone = '+00:00'");
            self::$pdo->exec('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
        } catch (PDOException $e) {
            throw new RuntimeException('Koneksi database gagal: ' . $e->getMessage(), 0, $e);
        }

        return self::$pdo;
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);

        return $stmt;
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();

        return $row === false ? null : $row;
    }

    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    public static function scalar(string $sql, array $params = []): mixed
    {
        $value = self::run($sql, $params)->fetchColumn();

        return $value === false ? null : $value;
    }

    /** Cek koneksi tanpa melempar exception (dipakai /health). */
    public static function ping(): bool
    {
        try {
            self::pdo()->query('SELECT 1');

            return true;
        } catch (Throwable $e) {
            return false;
        }
    }

    /**
     * ID bergaya cuid (kompatibel data lama: varchar(191), unik, urut waktu).
     * Format: c + timestamp base36 + penghitung + acak.
     */
    public static function cuid(): string
    {
        static $counter = 0;
        $counter = ($counter + 1) % 1679616; // 36^4
        $timestamp = base_convert((string) (int) (microtime(true) * 1000), 10, 36);
        $block = $timestamp . str_pad(base_convert((string) $counter, 10, 36), 4, '0', STR_PAD_LEFT);
        $random = '';
        for ($i = 0; $i < 8; $i++) {
            $random .= base_convert((string) random_int(0, 35), 10, 36);
        }

        return 'c' . $block . $random;
    }
}
