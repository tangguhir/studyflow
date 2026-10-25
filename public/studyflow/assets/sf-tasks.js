/* StudyFlow - tampilan halaman daftar tugas, modal form, dan konfirmasi hapus. */
(function () {
  'use strict';
  var SF = window.SF = window.SF || {};
  var esc = function (v) { return SF.esc(v); };

  SF.viewTasks = function (S) {
    var tasks = S.tasks;
    var active = tasks.filter(function (t) { return !t.completedAt; });
    var done = tasks.filter(function (t) { return t.completedAt; });
    var onTime = done.filter(function (t) { return new Date(t.completedAt) <= new Date(t.deadline); });
    var accuracy = done.length ? Math.round(onTime.length / done.length * 100) : 0;
    var plannedHours = active.reduce(function (n, t) { return n + t.hours; }, 0);
    var nearDeadline = active.filter(function (t) { return (new Date(t.deadline) - Date.now()) / 864e5 <= 3; }).length;

    var sorted = SF.sortTasksByPriority(tasks);
    var rank = {};
    sorted.forEach(function (t, i) { rank[t.id] = i + 1; });

    var filtered = tasks.filter(function (t) {
      return S.filter === 'Semua' || (S.filter === 'Aktif' ? !t.completedAt : !!t.completedAt);
    });
    var list = SF.sortTasksByPriority(SF.filterTasksBySearch(filtered, S.search));

    var todayLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
      .format(new Date()).toUpperCase();

    var tabs = ['Semua', 'Aktif', 'Selesai'].map(function (x) {
      return '<button type="button" class="tab' + (S.filter === x ? ' chosen' : '') + '" data-act="filter" data-value="' + x + '">' + x + '</button>';
    }).join('');

    var cards = list.map(function (t) { return SF.taskCard(S, t, rank); }).join('');

    return '<div class="welcome"><div>' +
      '<small class="eyebrow">' + esc(todayLabel) + '</small>' +
      '<h1>Semua tugas</h1>' +
      '<p class="muted">Prioritas jelas, langkah belajar lebih terarah.</p></div>' +
      '<button class="primary" type="button" data-act="open-task">＋ Tambah tugas</button></div>' +
      '<div class="stats">' +
      SF.stat('Tugas aktif', active.length, 'Perlu diselesaikan') +
      SF.stat('Deadline dekat', nearDeadline, 'Dalam 3 hari') +
      SF.stat('Selesai tepat waktu', accuracy + '%', done.length + ' tugas selesai') +
      SF.stat('Waktu terencana', plannedHours + 'j', 'Estimasi aktif') +
      '</div>' +
      '<label class="task-search"><span aria-hidden="true">⌕</span>' +
      '<input type="search" data-k="search" value="' + esc(S.search) + '" placeholder="Cari nama tugas atau mata kuliah…" aria-label="Cari tugas berdasarkan nama tugas atau mata kuliah">' +
      '<button type="button" data-act="clear-search"' + (S.search ? '' : ' disabled') + '>Hapus</button></label>' +
      '<div class="columns"><section class="panel">' +
      '<div class="panel-head"><h2>Prioritas pengerjaan</h2>' + tabs + '</div>' +
      cards +
      (!list.length ? '<div class="empty search-empty">' + (S.search
        ? 'Tidak ada tugas yang cocok dengan “' + esc(S.search) + '”.'
        : 'Belum ada tugas. Tambahkan tugas pertamamu.') + '</div>' : '') +
      '</section><div class="right">' +
      SF.calendar(tasks, S.month, false) +
      SF.mailNote(S) +
      SF.reminderTable(tasks, S.mailSched, S.mailBusy) +
      '</div></div>';
  };

  SF.taskCard = function (S, t, rank) {
    var completed = !!t.completedAt;
    var onTimeBadge = completed
      ? (new Date(t.completedAt) <= new Date(t.deadline) ? 'Tepat waktu' : 'Terlambat')
      : 'Prioritas #' + (rank[t.id] || 1);
    var dot = completed ? 'green' : ((rank[t.id] || 1) === 1 ? 'red' : 'amber');
    var hasUndone = (t.subtasks || []).some(function (s) { return !s.done; });

    var subs = (t.subtasks || []).map(function (s, i) {
      var editing = S.editingSubId === s.id;
      var right = editing
        ? '<form class="subtask-edit-form" data-form="sub-edit" data-task="' + esc(t.id) + '" data-sub="' + esc(s.id) + '">' +
        '<input aria-label="Nama subtugas ' + (i + 1) + '" data-k="editSubName" value="' + esc(S.editingSubName) + '">' +
        '<button type="submit" class="subtask-save">Simpan</button>' +
        '<button type="button" class="subtask-cancel" data-act="cancel-sub-edit">Batal</button></form>'
        : '<div class="subtask-actions">' +
        '<button type="button" title="Edit subtugas" aria-label="Edit subtugas ' + esc(s.name) + '" data-act="edit-sub" data-task="' + esc(t.id) + '" data-sub="' + esc(s.id) + '">✎</button>' +
        '<button type="button" title="Hapus subtugas" aria-label="Hapus subtugas ' + esc(s.name) + '" data-act="del-sub" data-task="' + esc(t.id) + '" data-sub="' + esc(s.id) + '">×</button></div>';

      return '<div class="subtask-line" data-drop-task="' + esc(t.id) + '" data-drop-sub="' + esc(s.id) + '">' +
        '<button type="button" class="subtask-drag-handle" draggable="true" aria-label="Geser subtugas ' + (i + 1) + '"' +
        ' title="Seret untuk mengubah urutan" data-drag-task="' + esc(t.id) + '" data-drag-sub="' + esc(s.id) + '">⠿</button>' +
        '<label class="sub"><input type="checkbox"' + (s.done ? ' checked' : '') +
        ' data-act="toggle-sub" data-task="' + esc(t.id) + '" data-sub="' + esc(s.id) + '">' +
        '<span><small>' + (i + 1) + '.</small> ' + esc(s.name) + '</span></label>' +
        right + '</div>';
    }).join('');

    var addForm = S.subFor === t.id
      ? '<form class="subtask-form" data-form="add-sub" data-task="' + esc(t.id) + '">' +
      '<label>Subtugas <small>Isi satu per baris untuk menambahkan beberapa sekaligus.</small>' +
      '<textarea required rows="3" data-k="subName" placeholder="Contoh: Baca bahan kuliah&#10;Buat rangkuman&#10;Kumpulkan tugas">' + esc(S.subName) + '</textarea></label>' +
      '<div><button type="button" data-act="cancel-add-sub">Batal</button>' +
      '<button class="primary" type="submit">Tambah subtugas</button></div>' +
      (S.err ? '<small class="error">' + esc(S.err) + '</small>' : '') + '</form>'
      : '';

    return '<article class="task"><i class="dot ' + dot + '"></i><div>' +
      '<b>' + esc(t.name) + ' <em class="badge">' + esc(onTimeBadge) + '</em></b>' +
      '<p>' + esc(t.course) + ' · Bobot ' + esc(t.weight) + '% · ' + SF.difficultyLabel[t.difficulty] + ' · ' + esc(t.hours) + ' jam<br>' +
      'Deadline ' + SF.df(t.deadline) + (t.startAt ? ' · Mulai ' + SF.df(t.startAt) : '') + '</p>' +
      subs + addForm + '</div>' +
      '<div class="actions">' +
      '<button type="button" title="Tambah subtugas" aria-label="Tambah subtugas" data-act="toggle-add-sub" data-id="' + esc(t.id) + '">☷</button>' +
      '<button type="button" title="Edit tugas" aria-label="Edit tugas ' + esc(t.name) + '" data-act="edit-task" data-id="' + esc(t.id) + '">✎</button>' +
      '<button type="button" class="' + (completed ? 'action-undo' : (hasUndone ? 'action-disabled' : 'action-complete')) + '"' +
      ' title="' + (completed ? 'Batalkan selesai' : (hasUndone ? 'Centang semua subtugas terlebih dahulu' : 'Tandai selesai')) + '"' +
      ' aria-label="' + (completed ? 'Batalkan status selesai' : 'Tandai tugas selesai') + '"' +
      ((!completed && hasUndone) ? ' disabled' : '') +
      ' data-act="toggle-complete" data-id="' + esc(t.id) + '">' + (completed ? '↶' : '✓') + '</button>' +
      '<button type="button" class="action-delete" title="Hapus tugas" aria-label="Hapus tugas ' + esc(t.name) + '" data-act="del-task" data-id="' + esc(t.id) + '">×</button>' +
      '</div></article>';
  };

  SF.viewTaskModal = function (S) {
    var f = S.form, editing = S.edit;
    var rows = S.formSubs.map(function (s, i) {
      return '<div class="modal-subtask-row"><span>' + (i + 1) + '</span>' +
        '<input aria-label="Nama subtugas ' + (i + 1) + '" placeholder="Subtugas ' + (i + 1) + '" data-k="formSub.' + i + '.name" value="' + esc(s.name) + '">' +
        (editing && s.id ? '<label class="modal-subtask-check"><input type="checkbox"' + (s.done ? ' checked' : '') +
          ' data-k="formSub.' + i + '.done"> Selesai</label>' : '') +
        '<button type="button" class="remove-subtask" aria-label="Hapus subtugas ' + (i + 1) + '" data-act="remove-form-sub" data-index="' + i + '">×</button></div>';
    }).join('');

    var options = [['1', 'Mudah'], ['2', 'Sedang'], ['3', 'Sulit']].map(function (pair) {
      return '<option value="' + pair[0] + '"' + (f.difficulty === pair[0] ? ' selected' : '') + '>' + pair[1] + '</option>';
    }).join('');

    return '<div class="overlay" data-act="overlay-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">' +
      '<div class="panel-head"><h2 id="task-modal-title">' + (editing ? 'Edit tugas' : 'Tambah tugas') + '</h2>' +
      '<button type="button" class="modal-close" aria-label="Tutup form" data-act="close-modal">×</button></div>' +
      '<form class="form" data-form="task">' +
      '<label class="full">Nama tugas<input required data-k="form.name" value="' + esc(f.name) + '"></label>' +
      '<label>Mata kuliah<input required data-k="form.course" value="' + esc(f.course) + '"></label>' +
      '<label>Bobot (%)<input type="number" min="1" max="100" data-k="form.weight" value="' + esc(f.weight) + '"></label>' +
      '<label>Kesulitan<select data-k="form.difficulty">' + options + '</select></label>' +
      '<label>Estimasi jam<input type="number" min=".5" step=".5" data-k="form.hours" value="' + esc(f.hours) + '"></label>' +
      '<label>Deadline<input required type="datetime-local" min="' + SF.localDateTimeMin() + '" data-k="form.deadline" value="' + esc(f.deadline) + '"></label>' +
      '<label>Rencana mulai<input type="datetime-local" data-k="form.startAt" value="' + esc(f.startAt) + '"></label>' +
      '<label class="full reminder-form-row">Pengingat email<span class="reminder-form-inline">' +
      '<button type="button" role="switch" aria-checked="' + f.emailReminder + '" aria-label="Aktifkan pengingat email untuk tugas ini"' +
      ' class="switch-btn' + (f.emailReminder ? ' on' : '') + '" data-act="toggle-form-reminder"><i></i></button>' +
      '<small>' + (f.emailReminder ? 'Aktif' : 'Mati — tidak ada email pengingat untuk tugas ini') + '</small></span></label>' +
      '<div class="full modal-subtasks"><div class="modal-subtasks-head"><div>' +
      '<b>Subtugas</b><small>Tambahkan satu atau beberapa langkah.</small></div>' +
      '<button type="button" class="add-subtask-row" data-act="add-form-sub">＋ Tambah subtugas</button></div>' +
      rows + '</div>' +
      (S.err ? '<p class="error full">' + esc(S.err) + '</p>' : '') +
      '<div class="full formbuttons"><button type="button" data-act="close-modal">Batal</button>' +
      '<button class="primary" type="submit">Simpan tugas</button></div>' +
      '</form></section></div>';
  };

  SF.viewConfirm = function (S) {
    var t = S.deleteTarget;
    var isTask = t.kind === 'task';
    return '<div class="overlay" data-act="confirm-overlay">' +
      '<section class="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">' +
      '<div class="confirm-mark">×</div>' +
      '<h2 id="delete-title">' + (isTask ? 'Hapus tugas?' : 'Hapus subtugas?') + '</h2>' +
      '<p>' + (isTask
        ? 'Tugas <b>“' + esc(t.task.name) + '”</b> dan seluruh subtugasnya akan dihapus permanen.'
        : 'Subtugas <b>“' + esc(t.subtask.name) + '”</b> akan dihapus permanen.') + '</p>' +
      (S.err ? '<p class="error" role="alert">' + esc(S.err) + '</p>' : '') +
      '<div class="confirm-actions"><button type="button" data-act="cancel-delete">Batal</button>' +
      '<button type="button" class="danger-button" data-act="confirm-delete">Ya, hapus</button></div>' +
      '</section></div>';
  };
})();
