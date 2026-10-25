/* StudyFlow - tampilan halaman masuk, kerangka aplikasi, dashboard, daftar tugas. */
(function () {
  'use strict';
  var SF = window.SF = window.SF || {};
  var esc = function (v) { return SF.esc(v); };

  SF.viewConnErr = function (S) {
    return '<main class="auth"><section class="authbox">' + SF.brand() +
      '<h1>Menyambung ulang…</h1>' +
      '<p class="muted">Koneksi ke layanan StudyFlow terputus sementara. Sesi kamu masih aman — tidak perlu masuk ulang. Halaman ini akan tersambung sendiri begitu layanan kembali.</p>' +
      (S.err ? '<div class="alert">' + esc(S.err) + '</div>' : '') +
      '<button class="primary wide" type="button" data-act="retry">Coba sambungkan lagi</button>' +
      '</section></main>';
  };

  SF.viewLoading = function () {
    return '<main class="auth"><section class="authbox">' + SF.brand() +
      '<p class="muted">Memuat akun dan tugas…</p>' +
      '</section></main>';
  };

  SF.viewAuth = function (S) {
    var reg = S.mode === 'register';
    var a = S.auth;
    var pwField = function (key, showKey, show, autoComplete, placeholder) {
      return '<div class="password-field">' +
        '<input required minlength="8" type="' + (show ? 'text' : 'password') + '" autocomplete="' + autoComplete + '"' +
        ' data-k="' + key + '" value="' + esc(a[key]) + '" placeholder="' + placeholder + '">' +
        '<button type="button" class="password-toggle" data-act="toggle-pw" data-which="' + showKey + '"' +
        ' aria-label="' + (show ? 'Sembunyikan kata sandi' : 'Lihat kata sandi') + '"' +
        ' title="' + (show ? 'Sembunyikan kata sandi' : 'Lihat kata sandi') + '" aria-pressed="' + show + '">' +
        SF.eyeIcon(show) + '</button></div>';
    };

    return '<main class="auth"><section class="authbox">' + SF.brand() +
      '<small class="eyebrow">RUANG BELAJAR TERATUR</small>' +
      '<h1>' + (reg ? 'Mulai atur waktumu' : 'Selamat datang kembali') + '</h1>' +
      '<p class="muted">' + (reg ? 'Daftar untuk mulai mengatur tugas dan jadwal kuliahmu.' : 'Masuk untuk mengakses tugas kuliahmu.') + '</p>' +
      '<form data-form="auth">' +
      (reg ? '<label>Nama<input required minlength="2" autocomplete="name" data-k="auth.name" value="' + esc(a.name) + '"></label>' : '') +
      '<label>Email<input required type="email" autocomplete="email" data-k="auth.email" value="' + esc(a.email) + '" placeholder="nama@email.com"></label>' +
      '<label>Kata sandi' + pwField('auth.password', 'password', S.showPassword, reg ? 'new-password' : 'current-password', 'Minimal 8 karakter') + '</label>' +
      (reg ? '<label>Konfirmasi kata sandi' + pwField('auth.confirmPassword', 'confirm', S.showConfirmPassword, 'new-password', 'Ulangi kata sandi') + '</label>' : '') +
      (S.err ? '<p class="error" role="alert">' + esc(S.err) + '</p>' : '') +
      '<button class="primary wide" type="submit">' + (reg ? 'Buat akun' : 'Masuk') + '</button>' +
      '</form>' +
      '<p class="switch">' + (reg ? 'Sudah punya akun?' : 'Belum punya akun?') +
      ' <button type="button" data-act="goto" data-path="' + (reg ? '/login' : '/daftar') + '">' +
      (reg ? 'Masuk' : 'Daftar') + '</button></p>' +
      '<small>Data tugas tersimpan privat di akunmu.</small>' +
      '</section>' +
      '<aside class="authaside"><small>BELAJAR LEBIH TERARAH</small>' +
      '<h2>Lebih fokus pada<br>yang paling penting.</h2>' +
      '<p>Susun prioritas kuliah dan dapatkan pengingat lewat email.</p></aside>' +
      '</main>';
  };

  // ---------------------------------------------------------------- komponen
  SF.stat = function (a, b, c) {
    return '<article class="stat"><small>' + esc(a) + '</small><strong>' + esc(b) + '</strong><span>' + esc(c) + '</span></article>';
  };

  SF.pieChart = function (title, slices) {
    var total = slices.reduce(function (n, s) { return n + s.value; }, 0);
    var cursor = 0;
    var gradient = total ? slices.map(function (s) {
      var start = cursor;
      cursor += s.value / total * 100;
      return s.color + ' ' + start + '% ' + cursor + '%';
    }).join(', ') : 'var(--chart-empty) 0% 100%';
    var label = title + ': ' + slices.map(function (s) { return s.label + ' ' + s.value; }).join(', ');
    var legend = slices.map(function (s) {
      return '<li><i style="background:' + s.color + '"></i><span>' + esc(s.label) + '</span><b>' + s.value + '</b></li>';
    }).join('');
    return '<div class="pie-chart">' +
      '<div class="pie-visual" role="img" aria-label="' + esc(label) + '" style="background:conic-gradient(' + gradient + ')">' +
      '<span><strong>' + total + '</strong><small>tugas</small></span></div>' +
      '<ul class="pie-legend">' + legend + '</ul></div>';
  };

  SF.calendar = function (tasks, month, large) {
    var y = month.getFullYear(), m = month.getMonth();
    var first = new Date(y, m, 1);
    var start = new Date(y, m, 1 - first.getDay());
    var cells = '';
    var today = new Date().toDateString();
    for (var i = 0; i < 42; i++) {
      var d = new Date(start);
      d.setDate(start.getDate() + i);
      var cls = 'calday';
      if (d.getMonth() !== m) cls += ' outside';
      if (d.toDateString() === today) cls += ' today';
      var marks = tasks.filter(function (t) {
        return new Date(t.deadline).toDateString() === d.toDateString();
      }).map(function (t) {
        return '<em>' + esc(t.name) + '</em>';
      }).join('');
      cells += '<div class="' + cls + '"><span>' + d.getDate() + '</span>' + marks + '</div>';
    }
    var monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(first);
    var head = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(function (x) {
      return '<b>' + x + '</b>';
    }).join('');
    return '<section class="panel">' +
      '<div class="panel-head"><h2>' + esc(monthLabel) + '</h2><div>' +
      '<button type="button" aria-label="Bulan sebelumnya" title="Bulan sebelumnya" data-act="month-prev">‹</button>' +
      '<button type="button" class="today-button" data-act="month-today">Hari ini</button>' +
      '<button type="button" aria-label="Bulan berikutnya" title="Bulan berikutnya" data-act="month-next">›</button>' +
      '</div></div>' +
      '<div class="calendar' + (large ? ' large' : '') + '">' + head + cells + '</div></section>';
  };

  SF.reminderTable = function (tasks, schedule, busy) {
    var list = tasks.slice().sort(function (a, b) {
      return new Date(a.deadline) - new Date(b.deadline);
    });
    var on = list.filter(function (t) { return t.emailReminder; }).length;
    var rows = list.map(function (t) {
      return '<div class="reminder-row' + (t.emailReminder ? '' : ' off') + '">' +
        '<span class="reminder-task"><b>' + esc(t.name) + '</b>' +
        '<small>' + esc(t.course) + (t.completedAt ? ' · Selesai' : '') + '</small></span>' +
        '<span class="reminder-switch">' +
        '<button type="button" role="switch" aria-checked="' + t.emailReminder + '"' +
        ' aria-label="' + (t.emailReminder ? 'Matikan' : 'Nyalakan') + ' pengingat email untuk ' + esc(t.name) + '"' +
        ' class="switch-btn' + (t.emailReminder ? ' on' : '') + '"' +
        (busy === t.id ? ' disabled' : '') + ' data-act="toggle-reminder" data-id="' + esc(t.id) + '"><i></i></button>' +
        '<small>' + (t.emailReminder ? 'Aktif' : 'Mati') + '</small></span></div>';
    }).join('');

    return '<section class="panel reminder-table">' +
      '<div class="panel-head"><h2>Pengingat email</h2>' +
      '<span class="reminder-count">' + on + '/' + list.length + ' aktif</span></div>' +
      (!list.length ? '<p class="modal-subtasks-empty">Belum ada tugas.</p>' : '') +
      (list.length ? '<div class="reminder-list">' +
        '<div class="reminder-row reminder-head"><span>Tugas</span><span>Email</span></div>' +
        rows + '</div>' : '') +
      '</section>';
  };

  // ------------------------------------------------------------ kerangka app
  var NAV = [['Dashboard', '/dashboard'], ['Semua tugas', '/tugas'], ['Kalender', '/kalender'], ['Produktivitas', '/produktivitas']];

  SF.viewApp = function (S) {
    var user = S.user;
    var nav = NAV.map(function (pair) {
      var name = pair[0], path = pair[1];
      var sel = S.page === name;
      return '<button type="button" class="nav' + (sel ? ' sel' : '') + '" data-act="nav" data-path="' + path + '"' +
        ' aria-label="' + name + '"' + (sel ? ' aria-current="page"' : '') + '>' +
        '<span class="nav-ico" aria-hidden="true">' + SF.navIcon(name) + '</span>' +
        '<span class="nav-label">' + name + '</span></button>';
    }).join('');

    var initial = (user.name && user.name.trim() ? user.name.trim().charAt(0) : 'M').toUpperCase();

    var body = S.page === 'Dashboard' ? SF.viewDashboard(S)
      : S.page === 'Semua tugas' ? SF.viewTasks(S)
        : S.page === 'Kalender' ? '<h1>Kalender deadline</h1>' + SF.calendar(S.tasks, S.month, true)
          : SF.viewProductivity(S);

    return '<div class="app"><aside class="sidebar">' + SF.brand() +
      '<small class="eyebrow">MENU UTAMA</small>' + nav +
      '<div class="account"><i>' + esc(initial) + '</i>' +
      '<span>' + esc(user.name) + '<small>' + esc(user.email) + '</small></span>' +
      '<button type="button" data-act="logout">Keluar</button></div></aside>' +
      '<main class="main"><header>StudyFlow　/　<b>' + esc(S.page) + '</b>' +
      '<span>' + esc(user.name) + '</span></header>' +
      '<div class="content">' + (S.err ? '<p class="error" role="alert">' + esc(S.err) + '</p>' : '') +
      body + '</div></main>' +
      (S.modal ? SF.viewTaskModal(S) : '') +
      (S.deleteTarget ? SF.viewConfirm(S) : '') +
      '</div>';
  };

  SF.mailNote = function (S) {
    if (!S.mailMsg) return '';
    return '<p class="mail-note ' + (S.mailMsg.err ? 'bad' : 'good') + '" role="status">' + esc(S.mailMsg.text) + '</p>';
  };

  SF.viewDashboard = function (S) {
    var tasks = S.tasks;
    var active = tasks.filter(function (t) { return !t.completedAt; });
    var done = tasks.filter(function (t) { return t.completedAt; });
    var onTime = done.filter(function (t) { return new Date(t.completedAt) <= new Date(t.deadline); });
    var initial = (S.user.name && S.user.name.trim() ? S.user.name.trim().charAt(0) : 'M').toUpperCase();
    var accuracy = done.length ? Math.round(onTime.length / done.length * 100) : 0;

    return '<div class="welcome"><div>' +
      '<small class="eyebrow">PROFIL DAN EVALUASI</small>' +
      '<h1>Ringkasan belajar</h1>' +
      '<p class="muted">Pantau profil dan ketepatan penyelesaian tugasmu.</p></div>' +
      '<button class="primary" type="button" data-act="nav" data-path="/tugas">Lihat tugas</button></div>' +
      '<section class="panel profile-panel"><div class="profile-avatar">' + esc(initial) + '</div><div>' +
      '<small class="eyebrow">PROFIL MAHASISWA</small>' +
      '<h2>' + esc(S.user.name) + '</h2><p>' + esc(S.user.email) + '</p>' +
      '<small>Pengingat tugas akan dikirim ke email ini.</small></div></section>' +
      '<h2 class="section-title">Evaluasi ketepatan waktu</h2>' +
      '<div class="stats">' +
      SF.stat('Tugas selesai', done.length, 'Jumlah tugas yang ditandai selesai') +
      SF.stat('Tepat waktu', onTime.length, 'Selesai sebelum deadline') +
      SF.stat('Terlambat', done.length - onTime.length, 'Selesai setelah deadline') +
      SF.stat('Tingkat ketepatan', accuracy + '%', 'Dari tugas yang selesai') +
      '</div>' +
      '<section class="panel chart dashboard-status-chart"><h2>Ringkasan penyelesaian</h2>' +
      SF.pieChart('Ringkasan status tugas', [
        { label: 'Tepat waktu', value: onTime.length, color: 'var(--chart-good)' },
        { label: 'Terlambat', value: done.length - onTime.length, color: 'var(--chart-late)' },
        { label: 'Belum selesai', value: active.length, color: 'var(--chart-pending)' }
      ]) + '</section>' +
      SF.mailNote(S) +
      SF.reminderTable(tasks, S.mailSched, S.mailBusy);
  };

  SF.viewProductivity = function (S) {
    var tasks = S.tasks;
    var active = tasks.filter(function (t) { return !t.completedAt; });
    var done = tasks.filter(function (t) { return t.completedAt; });
    var onTime = done.filter(function (t) { return new Date(t.completedAt) <= new Date(t.deadline); });
    var accuracy = done.length ? Math.round(onTime.length / done.length * 100) : 0;
    var focus = done.reduce(function (n, t) { return n + t.hours; }, 0);

    var days = [];
    for (var i = 0; i < 7; i++) {
      var date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - 6 + i);
      days.push({
        date: date,
        count: done.filter(function (t) { return new Date(t.completedAt).toDateString() === date.toDateString(); }).length
      });
    }
    var max = Math.max.apply(null, [1].concat(days.map(function (d) { return d.count; })));
    var totalWeek = days.reduce(function (n, d) { return n + d.count; }, 0);

    var bars = days.map(function (d) {
      var h = d.count === 0 ? 4 : Math.max(12, d.count / max * 100);
      return '<div class="bar-column"><span class="bar-value">' + d.count + '</span>' +
        '<div class="bar-track"><i style="height:' + h + '%"></i></div>' +
        '<small>' + new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d.date) + '</small></div>';
    }).join('');

    return '<h1>Produktivitas</h1>' +
      '<div class="stats productivity-stats">' +
      SF.stat('Total selesai', done.length, 'Sepanjang waktu') +
      SF.stat('Tepat waktu', accuracy + '%', 'Dari tugas selesai') +
      SF.stat('Terlambat', done.length - onTime.length, 'Selesai setelah deadline') +
      SF.stat('Jam fokus', focus + 'j', 'Estimasi tugas selesai') +
      '</div>' +
      '<div class="productivity-charts">' +
      '<section class="panel productivity-chart"><div class="panel-head"><div>' +
      '<h2>Tugas selesai</h2><p class="muted">Aktivitas 7 hari terakhir</p></div>' +
      '<span class="chart-total">' + totalWeek + ' tugas</span></div>' +
      '<div class="bar-chart" role="img" aria-label="Grafik jumlah tugas selesai per hari selama tujuh hari terakhir">' +
      bars + '</div>' +
      '<p class="chart-note">Grafik menghitung tanggal penyelesaian tugas.</p></section>' +
      '<section class="panel chart"><h2>Perbandingan status tugas</h2>' +
      SF.pieChart('Perbandingan status tugas', [
        { label: 'Tepat waktu', value: onTime.length, color: 'var(--chart-good)' },
        { label: 'Terlambat', value: done.length - onTime.length, color: 'var(--chart-late)' },
        { label: 'Belum selesai', value: active.length, color: 'var(--chart-pending)' }
      ]) + '</section></div>';
  };
})();
