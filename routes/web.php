<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web routes
|--------------------------------------------------------------------------
| Rute halaman StudyFlow ada di routes/pages.php, API di routes/api.php, dan
| cron lewat URL di routes/cron.php. Ketiganya dimuat lewat bootstrap/app.php
| agar BASE_PATH (/studyflow) ikut ter-prefix seperti versi Node.
*/

Route::get('/up', function () {
    return response()->json(['ok' => true]);
});
