<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Validator kecil dengan pesan identik ValidationPipe NestJS.
 * Setiap method mencatat pelanggaran pertama per kolom, lalu `finish()`
 * melempar ApiError 400 berisi daftar pesan (seperti class-validator).
 */
final class Validator
{
    private array $errors = [];

    public function __construct(private array $data)
    {
    }

    public static function make(mixed $data): self
    {
        return new self(is_array($data) ? $data : []);
    }

    /** Label bahasa Indonesia, sama dengan versi Node. */
    public static function label(string $property): string
    {
        $map = [
            'name' => 'Nama',
            'email' => 'Email',
            'password' => 'Kata sandi',
            'course' => 'Mata kuliah',
            'weight' => 'Bobot penilaian',
            'difficulty' => 'Tingkat kesulitan',
            'hours' => 'Estimasi waktu',
            'deadline' => 'Tenggat',
            'startAt' => 'Waktu mulai',
            'subtasks' => 'Daftar subtugas',
            'done' => 'Status',
            'enabled' => 'Status pengingat',
            'ids' => 'Urutan subtugas',
        ];

        return $map[$property] ?? ('Kolom ' . $property);
    }

    private static function constraintMessage(string $field, string $constraint): string
    {
        return match ($constraint) {
            'whitelistValidation' => $field . ' tidak diizinkan.',
            'isEmail' => 'Format alamat email tidak valid.',
            'minLength' => $field . ' belum memenuhi panjang minimum.',
            'maxLength' => $field . ' terlalu panjang.',
            'isNotEmpty' => $field . ' wajib diisi.',
            'isString' => $field . ' harus berupa teks.',
            'isArray' => $field . ' harus berupa daftar.',
            'nestedValidation' => $field . ' berisi data yang tidak valid.',
            'isDateString' => $field . ' harus berupa tanggal yang valid.',
            'isNumber' => $field . ' harus berupa angka.',
            'min' => $field . ' berada di bawah batas minimum.',
            'max' => $field . ' melebihi batas maksimum.',
            'isBoolean' => $field . ' harus bernilai benar atau salah.',
            default => $field . ' tidak valid.',
        };
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->data) && $this->data[$key] !== null;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->data[$key] ?? $default;
    }

    public function raw(): array
    {
        return $this->data;
    }

    private function fail(string $key, string $constraint): void
    {
        $this->errors[$key][] = self::constraintMessage(self::label($key), $constraint);
    }

    /** Tolak kolom yang tidak dikenal (forbidNonWhitelisted). */
    public function only(array $allowed): self
    {
        foreach (array_keys($this->data) as $key) {
            if (! in_array($key, $allowed, true)) {
                $this->fail((string) $key, 'whitelistValidation');
            }
        }

        return $this;
    }

    public function string(string $key, bool $required = false, int $min = 0, int $max = 0, bool $email = false): self
    {
        if (! $this->has($key)) {
            if ($required) {
                $this->fail($key, 'isNotEmpty');
            }

            return $this;
        }
        $value = $this->data[$key];
        if (! is_string($value)) {
            $this->fail($key, 'isString');

            return $this;
        }
        if ($required && $value === '') {
            $this->fail($key, 'isNotEmpty');

            return $this;
        }
        if ($min > 0 && mb_strlen($value) < $min) {
            $this->fail($key, 'minLength');
        }
        if ($max > 0 && mb_strlen($value) > $max) {
            $this->fail($key, 'maxLength');
        }
        if ($email && ! filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $this->fail($key, 'isEmail');
        }

        return $this;
    }

    public function number(string $key, bool $required = false, ?float $min = null, ?float $max = null): self
    {
        if (! $this->has($key)) {
            if ($required) {
                $this->fail($key, 'isNotEmpty');
            }

            return $this;
        }
        $value = $this->data[$key];
        if (! is_int($value) && ! is_float($value) && ! (is_string($value) && is_numeric($value))) {
            $this->fail($key, 'isNumber');

            return $this;
        }
        $num = (float) $value;
        if ($min !== null && $num < $min) {
            $this->fail($key, 'min');
        }
        if ($max !== null && $num > $max) {
            $this->fail($key, 'max');
        }

        return $this;
    }

    public function boolean(string $key, bool $required = false): self
    {
        if (! $this->has($key)) {
            if ($required) {
                $this->fail($key, 'isNotEmpty');
            }

            return $this;
        }
        if (! is_bool($this->data[$key])) {
            $this->fail($key, 'isBoolean');
        }

        return $this;
    }

    public function dateString(string $key, bool $required = false, bool $nullable = false): self
    {
        if (! $this->has($key)) {
            if ($required) {
                $this->fail($key, 'isNotEmpty');
            }

            return $this;
        }
        $value = $this->data[$key];
        if ($value === null && $nullable) {
            return $this;
        }
        if (! is_string($value) || Dates::parse($value) === null) {
            $this->fail($key, 'isDateString');
        }

        return $this;
    }

    public function stringArray(string $key, bool $required = false): self
    {
        if (! $this->has($key)) {
            if ($required) {
                $this->fail($key, 'isNotEmpty');
            }

            return $this;
        }
        $value = $this->data[$key];
        if (! is_array($value) || ! array_is_list($value)) {
            $this->fail($key, 'isArray');

            return $this;
        }
        foreach ($value as $item) {
            if (! is_string($item)) {
                $this->fail($key, 'isString');

                return $this;
            }
        }

        return $this;
    }

    /** Validasi daftar subtugas: [{name: string}] */
    public function subtaskList(string $key): self
    {
        if (! $this->has($key)) {
            return $this;
        }
        $value = $this->data[$key];
        if (! is_array($value) || ! array_is_list($value)) {
            $this->fail($key, 'isArray');

            return $this;
        }
        foreach ($value as $item) {
            if (! is_array($item)) {
                $this->fail($key, 'nestedValidation');

                return $this;
            }
            if (! array_key_exists('name', $item) || ! is_string($item['name']) || $item['name'] === '') {
                $this->fail($key, 'nestedValidation');

                return $this;
            }
            if (mb_strlen($item['name']) > 200) {
                $this->fail($key, 'nestedValidation');

                return $this;
            }
        }

        return $this;
    }

    /** Lempar ApiError 400 bila ada pelanggaran. */
    public function finish(): void
    {
        if (! $this->errors) {
            return;
        }

        // Urutkan pesan mengikuti urutan kolom pada badan request, seperti NestJS.
        $order = array_flip(array_keys($this->data));
        $keys = array_keys($this->errors);
        usort($keys, static function ($a, $b) use ($order) {
            $pa = $order[$a] ?? PHP_INT_MAX;
            $pb = $order[$b] ?? PHP_INT_MAX;

            return $pa <=> $pb;
        });

        $messages = [];
        foreach ($keys as $key) {
            foreach ($this->errors[$key] as $message) {
                $messages[] = $message;
            }
        }

        throw new ApiError(400, $messages);
    }
}
