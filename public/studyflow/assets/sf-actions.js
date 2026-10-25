/* StudyFlow - aksi pengguna: klik, ketik, kirim form, dan seret subtugas. */
(function () {
  'use strict';
  var SF = window.SF;
  var S = SF.S;
  var call = SF.call;
  var render = SF.render;

  // ------------------------------------------------------------------ util
  function setErr(text) { S.err = text || ''; }
  function taskById(id) {
    for (var i = 0; i < S.tasks.length; i++) if (S.tasks[i].id === id) return S.tasks[i];
    return null;
  }
  function subById(task, id) {
    var list = (task && task.subtasks) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function setTasks(value) { S.tasks = value; }

  // ------------------------------------------------------------- masuk/daftar
  async function authSubmit() {
    setErr('');
    var reg = S.mode === 'register';
    if (reg && S.auth.password !== S.auth.confirmPassword) {
      setErr('Kata sandi dan konfirmasi kata sandi tidak sama.');
      render();
      return;
    }
    var body = reg
      ? { name: S.auth.name.trim(), email: S.auth.email.trim(), password: S.auth.password }
      : { email: S.auth.email.trim(), password: S.auth.password };
    try {
      var profile = await call('/auth/' + S.mode, { method: 'POST', body: JSON.stringify(body) });
      S.user = profile;
      S.tasks = await call('/tasks');
      SF.go('/dashboard', true);
    } catch (x) {
      setErr(x.message);
      render();
    }
  }

  async function logout() {
    try {
      await call('/auth/logout', { method: 'POST' });
      S.user = null;
      S.tasks = [];
      SF.go('/login', true);
    } catch (x) {
      setErr(x.message);
      render();
    }
  }

  // -------------------------------------------------------------- form tugas
  function openTask(task) {
    setErr('');
    S.edit = task || null;
    S.form = task
      ? {
        name: task.name, course: task.course,
        weight: '' + task.weight, difficulty: '' + task.difficulty, hours: '' + task.hours,
        deadline: SF.toLocalDT(task.deadline), startAt: SF.toLocalDT(task.startAt) || '',
        emailReminder: task.emailReminder !== false
      }
      : {
        name: '', course: '', weight: '20', difficulty: '2', hours: '3',
        deadline: '', startAt: '', emailReminder: true
      };
    S.formSubs = ((task && task.subtasks) || []).map(function (s) {
      return { id: s.id, name: s.name, done: s.done };
    });
    S.modal = true;
    render();
  }

  async function saveTask() {
    setErr('');
    var f = S.form;
    if (!f.deadline) { setErr('Tenggat tugas wajib diisi.'); render(); return; }
    var sameDeadline = !!S.edit && f.deadline === SF.toLocalDT(S.edit.deadline);
    var sameStart = !!S.edit && (f.startAt || '') === (SF.toLocalDT(S.edit.startAt) || '');
    if (!sameDeadline && new Date(f.deadline).getTime() < Date.now()) {
      setErr('Deadline tugas tidak boleh sebelum hari ini.');
      render();
      return;
    }
    var hasBlank = S.formSubs.some(function (s) { return !s.name.trim(); });
    if (hasBlank) { setErr('Isi nama semua subtugas atau hapus baris yang kosong.'); render(); return; }

    var d = {
      name: f.name.trim(), course: f.course.trim(),
      weight: +f.weight, difficulty: +f.difficulty, hours: +f.hours,
      deadline: new Date(f.deadline).toISOString(),
      startAt: f.startAt ? new Date(f.startAt).toISOString() : null,
      emailReminder: f.emailReminder
    };
    if (S.edit && sameDeadline) delete d.deadline;
    if (S.edit && sameStart) delete d.startAt;
    if (!S.edit) {
      d.subtasks = S.formSubs.map(function (s) { return { name: s.name.trim() }; });
    }

    try {
      if (S.edit) {
        var editId = S.edit.id;
        await call('/tasks/' + editId, { method: 'PATCH', body: JSON.stringify(d) });
        var keep = {};
        S.formSubs.forEach(function (s) { if (s.id) keep[s.id] = 1; });
        var olds = S.edit.subtasks || [];
        for (var i = 0; i < olds.length; i++) {
          if (!keep[olds[i].id]) {
            await call('/tasks/' + editId + '/subtasks/' + olds[i].id, { method: 'DELETE' });
          }
        }
        for (var j = 0; j < S.formSubs.length; j++) {
          var draft = S.formSubs[j];
          if (draft.id) {
            await call('/tasks/' + editId + '/subtasks/' + draft.id, {
              method: 'PATCH', body: JSON.stringify({ name: draft.name.trim(), done: draft.done })
            });
          } else {
            await call('/tasks/' + editId + '/subtasks', {
              method: 'POST', body: JSON.stringify({ name: draft.name.trim() })
            });
          }
        }
        setTasks(await call('/tasks'));
      } else {
        var saved = await call('/tasks', { method: 'POST', body: JSON.stringify(d) });
        setTasks([saved].concat(S.tasks));
      }
      S.modal = false;
      render();
      await SF.refreshSchedule();
      render();
    } catch (x) {
      setErr(x.message);
      render();
    }
  }

  async function toggleComplete(task) {
    try {
      var saved = await call('/tasks/' + task.id + '/complete', {
        method: 'PATCH', body: JSON.stringify({ done: !task.completedAt })
      });
      setTasks(S.tasks.map(function (t) { return t.id === task.id ? saved : t; }));
      setErr('');
    } catch (x) {
      setErr(x.message);
    }
    render();
  }

  async function toggleSubtask(task, sub) {
    try {
      await call('/tasks/' + task.id + '/subtasks/' + sub.id, {
        method: 'PATCH', body: JSON.stringify({ done: !sub.done })
      });
      setTasks(await call('/tasks'));
      setErr('');
    } catch (x) {
      setErr(x.message);
    }
    render();
  }

  function startEditSub(sub) {
    S.editingSubId = sub.id;
    S.editingSubName = sub.name;
    setErr('');
    render();
    SF.focusSoon('k:editSubName');
  }

  async function saveSubEdit(task, sub) {
    var name = S.editingSubName.trim();
    if (!name) { setErr('Nama subtugas tidak boleh kosong.'); render(); return; }
    try {
      await call('/tasks/' + task.id + '/subtasks/' + sub.id, {
        method: 'PATCH', body: JSON.stringify({ name: name })
      });
      setTasks(await call('/tasks'));
      S.editingSubId = null;
      S.editingSubName = '';
      setErr('');
    } catch (x) {
      setErr(x.message);
    }
    render();
  }

  async function addSubtasks(task) {
    var seen = {};
    var names = S.subName.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(function (x) {
      if (!x || seen[x]) return false;
      seen[x] = 1;
      return true;
    });
    if (!names.length) { setErr('Masukkan setidaknya satu nama subtugas.'); render(); return; }
    try {
      for (var i = 0; i < names.length; i++) {
        await call('/tasks/' + task.id + '/subtasks', {
          method: 'POST', body: JSON.stringify({ name: names[i] })
        });
      }
      setTasks(await call('/tasks'));
      S.subFor = null;
      S.subName = '';
      setErr('');
    } catch (x) {
      setErr(x.message);
    }
    render();
  }

  async function confirmDelete() {
    var target = S.deleteTarget;
    if (!target) return;
    try {
      if (target.kind === 'task') {
        await call('/tasks/' + target.task.id, { method: 'DELETE' });
        setTasks(S.tasks.filter(function (x) { return x.id !== target.task.id; }));
      } else {
        await call('/tasks/' + target.task.id + '/subtasks/' + target.subtask.id, { method: 'DELETE' });
        setTasks(await call('/tasks'));
      }
      S.deleteTarget = null;
      setErr('');
    } catch (x) {
      setErr(x.message);
    }
    render();
  }

  async function reorderSubs(task, sourceId, targetId) {
    var ids = (task.subtasks || []).map(function (s) { return s.id; });
    var from = ids.indexOf(sourceId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setTasks(S.tasks.map(function (t) {
      if (t.id !== task.id) return t;
      var copy = Object.assign({}, t);
      copy.subtasks = ids.map(function (id) { return subById(t, id); }).filter(Boolean);
      return copy;
    }));
    render();
    try {
      await call('/tasks/' + task.id + '/subtasks/reorder', {
        method: 'PATCH', body: JSON.stringify({ ids: ids })
      });
      setTasks(await call('/tasks'));
      setErr('');
    } catch (x) {
      setErr(x.message);
      try { setTasks(await call('/tasks')); } catch (e) { /* abaikan */ }
    }
    render();
  }

  async function toggleReminder(task) {
    var next = !task.emailReminder;
    setTasks(S.tasks.map(function (t) { return t.id === task.id ? Object.assign({}, t, { emailReminder: next }) : t; }));
    setErr('');
    render();
    try {
      var saved = await call('/tasks/' + task.id + '/reminder', {
        method: 'PATCH', body: JSON.stringify({ enabled: next })
      });
      setTasks(S.tasks.map(function (t) { return t.id === task.id ? saved : t; }));
      S.mailMsg = { text: 'Pengingat email “' + task.name + '” ' + (next ? 'dinyalakan' : 'dimatikan') + '.', err: false };
      render();
      await SF.refreshSchedule();
      render();
    } catch (x) {
      setTasks(S.tasks.map(function (t) {
        return t.id === task.id ? Object.assign({}, t, { emailReminder: !next }) : t;
      }));
      S.mailMsg = { text: x.message, err: true };
      render();
    }
  }

  // ------------------------------------------------------------- penanganan
  function onInput(e) {
    var el = e.target;
    var k = el.getAttribute && el.getAttribute('data-k');
    if (!k) return;
    var v = el.type === 'checkbox' ? el.checked : el.value;

    if (k.indexOf('auth.') === 0) {
      S.auth[k.slice(5)] = v;
      return; // input akun tidak mengubah tampilan lain
    }
    if (k === 'search') { S.search = v; render(); return; }
    if (k === 'subName') { S.subName = v; return; }
    if (k === 'editSubName') { S.editingSubName = v; return; }
    if (k.indexOf('form.') === 0) { S.form[k.slice(5)] = v; return; }
    if (k.indexOf('formSub.') === 0) {
      var parts = k.split('.');
      var idx = parseInt(parts[1], 10);
      if (S.formSubs[idx]) S.formSubs[idx][parts[2]] = v;
      return;
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      if (S.deleteTarget) { S.deleteTarget = null; setErr(''); render(); }
      else if (S.modal) { S.modal = false; render(); }
    }
  }

  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el) {
      // klik di luar modal menutup modal, sama seperti React (onMouseDown pada overlay)
      return;
    }
    var act = el.getAttribute('data-act');
    // Tugas bisa ditunjuk lewat data-id (tombol aksi tugas) atau data-task (tombol subtugas).
    var id = el.getAttribute('data-id') || el.getAttribute('data-task');
    var task = id ? taskById(id) : null;

    switch (act) {
      case 'retry':
        setErr(''); S.connErr = false; S.authResolved = false; render(); SF.load(); return;
      case 'nav':
        SF.go(el.getAttribute('data-path')); return;
      case 'goto':
        SF.go(el.getAttribute('data-path')); return;
      case 'logout':
        logout(); return;
      case 'toggle-pw':
        if (el.getAttribute('data-which') === 'confirm') S.showConfirmPassword = !S.showConfirmPassword;
        else S.showPassword = !S.showPassword;
        render();
        return;
      case 'filter':
        S.filter = el.getAttribute('data-value'); render(); return;
      case 'clear-search':
        S.search = ''; render(); SF.focusSoon('k:search'); return;
      case 'open-task':
        openTask(null); return;
      case 'edit-task':
        if (task) openTask(task); return;
      case 'close-modal':
        S.modal = false; setErr(''); render(); return;
      case 'overlay-close':
        if (e.target === el) { S.modal = false; setErr(''); render(); }
        return;
      case 'confirm-overlay':
        if (e.target === el) { S.deleteTarget = null; setErr(''); render(); }
        return;
      case 'toggle-form-reminder':
        S.form.emailReminder = !S.form.emailReminder; render(); return;
      case 'add-form-sub':
        S.formSubs.push({ name: '', done: false });
        render();
        SF.focusSoon('k:formSub.' + (S.formSubs.length - 1) + '.name');
        return;
      case 'remove-form-sub':
        S.formSubs.splice(parseInt(el.getAttribute('data-index'), 10), 1);
        render();
        return;
      case 'toggle-add-sub':
        S.subFor = S.subFor === id ? null : id;
        S.subName = ''; setErr(''); render();
        if (S.subFor) SF.focusSoon('k:subName');
        return;
      case 'cancel-add-sub':
        S.subFor = null; S.subName = ''; setErr(''); render(); return;
      case 'edit-sub':
        if (task) {
          var s = subById(task, el.getAttribute('data-sub'));
          if (s) startEditSub(s);
        }
        return;
      case 'cancel-sub-edit':
        S.editingSubId = null; S.editingSubName = ''; setErr(''); render(); return;
      case 'del-sub':
        if (task) {
          var sd = subById(task, el.getAttribute('data-sub'));
          if (sd) { S.deleteTarget = { kind: 'subtask', task: task, subtask: sd }; setErr(''); render(); }
        }
        return;
      case 'del-task':
        if (task) { S.deleteTarget = { kind: 'task', task: task }; setErr(''); render(); }
        return;
      case 'cancel-delete':
        S.deleteTarget = null; setErr(''); render(); return;
      case 'confirm-delete':
        confirmDelete(); return;
      case 'toggle-complete':
        if (task) toggleComplete(task);
        return;
      case 'toggle-reminder':
        if (task) toggleReminder(task);
        return;
      case 'month-prev':
        S.month = new Date(S.month.getFullYear(), S.month.getMonth() - 1, 1); render(); return;
      case 'month-next':
        S.month = new Date(S.month.getFullYear(), S.month.getMonth() + 1, 1); render(); return;
      case 'month-today':
        S.month = new Date(); render(); return;
      default:
        return;
    }
  }

  function onChange(e) {
    var el = e.target;
    if (el.type === 'checkbox' && el.getAttribute('data-act') === 'toggle-sub') {
      var id = el.getAttribute('data-task');
      var task = taskById(id);
      var sub = task ? subById(task, el.getAttribute('data-sub')) : null;
      if (task && sub) toggleSubtask(task, sub);
      else render();
      return;
    }
    onInput(e);
  }

  function onSubmit(e) {
    var form = e.target;
    var kind = form.getAttribute && form.getAttribute('data-form');
    if (!kind) return;
    e.preventDefault();
    if (kind === 'auth') { authSubmit(); return; }
    if (kind === 'task') { saveTask(); return; }
    if (kind === 'add-sub') {
      var t = taskById(form.getAttribute('data-task'));
      if (t) addSubtasks(t);
      return;
    }
    if (kind === 'sub-edit') {
      var t2 = taskById(form.getAttribute('data-task'));
      var s = t2 ? subById(t2, form.getAttribute('data-sub')) : null;
      if (t2 && s) saveSubEdit(t2, s);
    }
  }

  // ------------------------------------------------------ seret & lepas subtugas
  function onDragStart(e) {
    var h = e.target.closest('[data-drag-task]');
    if (!h) return;
    S.draggedSub = { taskId: h.getAttribute('data-drag-task'), subtaskId: h.getAttribute('data-drag-sub') };
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; }
  }

  function onDragEnd() { S.draggedSub = null; }

  function onDragOver(e) {
    if (e.target.closest('[data-drop-task]')) e.preventDefault();
  }

  function onDrop(e) {
    var line = e.target.closest('[data-drop-task]');
    if (!line || !S.draggedSub) return;
    e.preventDefault();
    var taskId = line.getAttribute('data-drop-task');
    if (S.draggedSub.taskId !== taskId) return;
    var task = taskById(taskId);
    if (task) reorderSubs(task, S.draggedSub.subtaskId, line.getAttribute('data-drop-sub'));
  }

  // ------------------------------------------------------------------ pasang
  SF.focusSoon = function (key) {
    setTimeout(function () {
      var nodes = document.querySelectorAll('[data-k],[data-act]');
      for (var i = 0; i < nodes.length; i++) {
        var k = nodes[i].getAttribute('data-k');
        if (k && 'k:' + k === key) { nodes[i].focus(); return; }
      }
    }, 0);
  };

  SF.bindEvents = function (root) {
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('dragstart', onDragStart);
    root.addEventListener('dragend', onDragEnd);
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('drop', onDrop);
  };
})();
