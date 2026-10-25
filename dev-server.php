<?php

/**
 * Server pengembangan lokal: `php -S 127.0.0.1:8190 -t public dev-server.php`
 *
 * Meniru mod_rewrite Apache seperti public/.htaccess. Tidak dipakai di hosting
 * (Apache/cPanel melayani public/index.php langsung).
 */

declare(strict_types=1);

$public = __DIR__ . '/public';
$uri = urldecode((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH));

if ($uri !== '/' && is_file($public . $uri)) {
    return false;
}

require $public . '/index.php';
