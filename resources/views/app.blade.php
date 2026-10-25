<!DOCTYPE html>
<html lang="id" class="h-full antialiased">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ config('studyflow.name', 'StudyFlow') }}</title>
<meta name="description" content="Atur tugas akademik, prioritas, dan tenggat dalam satu ruang belajar.">
<script>
/* Tema tersimpan diterapkan sebelum paint supaya tidak berkedip. */
(function(){try{var t=localStorage.getItem('studyflow-theme');if(t==='dark'){var r=document.documentElement;r.setAttribute('data-theme','dark');r.style.colorScheme='dark';}}catch(e){}})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="icon" href="{{ $assetBase }}/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="{{ $assetBase }}/favicon.svg">
<link rel="apple-touch-icon" href="{{ $assetBase }}/apple-touch-icon.png">
<link rel="stylesheet" href="{{ $assetBase }}/base.css">
<link rel="stylesheet" href="{{ $assetBase }}/study.css">
</head>
<body class="min-h-full flex flex-col">
@if ($notFound)
  <main class="auth"><section class="authbox">
    <div class="brand"><i class="mark"><img src="{{ $assetBase }}/logo.svg" alt="" width="34" height="34" decoding="async"></i> StudyFlow</div>
    <h1>Halaman tidak ditemukan</h1>
    <p class="muted">Alamat yang kamu buka tidak tersedia. Kembali ke halaman masuk untuk melanjutkan.</p>
    <p><a class="primary wide" style="display:block;text-align:center;margin-top:22px" href="{{ $base }}/login">Ke halaman masuk</a></p>
  </section></main>
@else
  <div id="root">
    <main class="auth"><section class="authbox">
      <div class="brand"><i class="mark"><img src="{{ $assetBase }}/logo.svg" alt="" width="34" height="34" decoding="async"></i> StudyFlow</div>
      <p class="muted">Memuat akun dan tugas…</p>
    </section></main>
  </div>
@endif

<button type="button" class="theme-toggle" id="theme-toggle" aria-label="Beralih ke mode gelap" title="Mode gelap">
  <svg class="i-moon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M20.6 14.4A8.6 8.6 0 1 1 9.6 3.4a7 7 0 0 0 11 11Z"/>
  </svg>
  <svg class="i-sun" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="4.1"/>
    <path d="M12 2.6v2.2M12 19.2v2.2M4.6 12H2.4M21.6 12h-2.2M6.5 6.5 4.9 4.9M19.1 19.1l-1.6-1.6M17.5 6.5l1.6-1.6M4.9 19.1l1.6-1.6"/>
  </svg>
</button>

<script>window.STUDYFLOW={base:@json($base), page:@json($page)};</script>
<script src="{{ $assetBase }}/sf-util.js" defer></script>
<script src="{{ $assetBase }}/sf-views.js" defer></script>
<script src="{{ $assetBase }}/sf-tasks.js" defer></script>
<script src="{{ $assetBase }}/sf-app.js" defer></script>
<script src="{{ $assetBase }}/sf-actions.js" defer></script>
<script src="{{ $assetBase }}/app.js" defer></script>
</body>
</html>
