/* E2E lengkap StudyFlow API (MySQL/phpMyAdmin). Jalankan: node scripts/e2e-v2.js [baseUrl] */
const BASE = process.argv[2] || 'http://127.0.0.1:4001';
const MAIL = process.env.MAILPIT_URL || 'http://127.0.0.1:8025';

let pass = 0;
const fails = [];
const skips = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fails.push(name + (extra ? ' :: ' + JSON.stringify(extra) : '')); console.log('FAIL  ' + name + (extra ? ' :: ' + JSON.stringify(extra) : '')); }
}
/** Tandai pemeriksaan yang tidak bisa dijalankan karena batasan akun/lingkungan, bukan bug kode. */
function skip(name, why) {
  skips.push(name + ' :: ' + why);
  console.log('SKIP  ' + name + ' :: ' + why);
}

async function req(method, path, { body, cookie, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (raw) return { status: res.status, json, setCookie };
  return { status: res.status, json, setCookie };
}
function cookieOf(r) {
  const c = (r.setCookie || []).find((x) => x.startsWith('sf_token='));
  return c ? c.split(';')[0] : null;
}
const uid = () => Math.random().toString(36).slice(2, 10);
const iso = (ms) => new Date(ms).toISOString();

(async () => {
  console.log('== BASE ' + BASE + ' ==');

  // ---------- AUTH ----------
  const emailA = `e2e.a.${uid()}@studyflow.test`;
  const emailB = `e2e.b.${uid()}@studyflow.test`;
  const pw = 'rahasia123';

  let r = await req('POST', '/api/auth/register', { body: { email: emailA, password: 'pendek', name: 'A' } });
  ok('register: password < 8 ditolak 400', r.status === 400, r);
  ok('register: pesan validasi Indonesia', (typeof r.json.message === 'string' ? r.json.message : (r.json.message || []).join(' ')).match(/panjang minimum/i) !== null, r.json);

  r = await req('POST', '/api/auth/register', { body: { email: 'bukan-email', password: pw, name: 'A' } });
  ok('register: email invalid ditolak 400', r.status === 400, r);

  r = await req('POST', '/api/auth/register', { body: { email: emailA, password: pw, name: 'User A' } });
  ok('register: sukses 201', r.status === 201, r);
  ok('register: mengembalikan user tanpa password', r.json && r.json.email === emailA && r.json.password === undefined, r.json);
  const cookieA = cookieOf(r);
  ok('register: set cookie sf_token httpOnly', !!cookieA, r.setCookie);

  r = await req('POST', '/api/auth/register', { body: { email: emailA, password: pw, name: 'User A' } });
  ok('register: email duplikat ditolak 409', r.status === 409, r);

  r = await req('POST', '/api/auth/login', { body: { email: emailA, password: 'salahsekali' } });
  ok('login: password salah 401', r.status === 401, r);

  r = await req('POST', '/api/auth/login', { body: { email: emailA, password: pw } });
  ok('login: sukses 200', r.status === 200, r);
  const loginCookie = cookieOf(r) || cookieA;

  r = await req('GET', '/api/auth/me', { cookie: loginCookie });
  ok('me: mengembalikan email user', r.status === 200 && r.json.email === emailA, r);

  r = await req('GET', '/api/auth/me');
  ok('me: tanpa cookie 401', r.status === 401, r);

  r = await req('POST', '/api/auth/logout', { cookie: loginCookie });
  ok('logout: 200', r.status === 200, r);

  // ---------- TASKS ----------
  const soon = Date.now() + 60 * 60 * 1000;
  const baseTask = { name: 'Tugas E2E', course: 'Algoritma', weight: 20, difficulty: 2, hours: 3, deadline: iso(soon) };

  r = await req('POST', '/api/tasks', { cookie: cookieA, body: baseTask });
  ok('create: sukses 201', r.status === 201, r);
  const task = r.json;
  ok('create: field tersimpan benar', task.name === 'Tugas E2E' && task.course === 'Algoritma' && Number(task.hours) === 3, task);

  r = await req('POST', '/api/tasks', { cookie: cookieA, body: { ...baseTask, deadline: iso(Date.now() - 3600_000) } });
  ok('create: deadline masa lalu 400', r.status === 400, r);

  r = await req('POST', '/api/tasks', { cookie: cookieA, body: { ...baseTask, name: '   ' } });
  ok('create: nama hanya spasi 400', r.status === 400, r);

  r = await req('POST', '/api/tasks', { cookie: cookieA, body: { ...baseTask, fieldAsing: 'x' } });
  ok('create: field asing ditolak 400 (whitelist)', r.status === 400, r);

  r = await req('POST', '/api/tasks', { cookie: cookieA, body: { ...baseTask, difficulty: 9 } });
  ok('create: difficulty > 5 ditolak 400', r.status === 400, r);

  r = await req('POST', '/api/tasks', { cookie: cookieA, body: { ...baseTask, weight: 0 } });
  ok('create: weight 0 ditolak 400', r.status === 400, r);

  r = await req('POST', '/api/tasks', { cookie: cookieA, body: { ...baseTask, hours: 0 } });
  ok('create: hours 0 ditolak 400', r.status === 400, r);

  r = await req('POST', '/api/tasks', { cookie: cookieA, body: { ...baseTask, name: '  Tugas Bersubtugas  ', subtasks: [{ name: ' Riset ' }, { name: 'Nulis' }] } });
  ok('create: dengan subtugas 201', r.status === 201, r);
  const taskSub = r.json;
  ok('create: subtugas tersimpan & posisi 0..n', taskSub.subtasks.length === 2 && taskSub.subtasks[0].position === 0 && taskSub.subtasks[1].position === 1, taskSub.subtasks);
  ok('create: nama di-trim', taskSub.name === 'Tugas Bersubtugas' && taskSub.subtasks[0].name === 'Riset', { n: taskSub.name, s: taskSub.subtasks[0].name });

  r = await req('GET', '/api/tasks', { cookie: cookieA });
  ok('list: 200 dan memuat tugas', r.status === 200 && Array.isArray(r.json) && r.json.length >= 2, { status: r.status, n: r.json && r.json.length });

  // deadline tersimpan presisi (detik/ms tidak bergeser)
  const savedDeadline = task.deadline;
  ok('create: deadline tidak bergeser', new Date(savedDeadline).getTime() === new Date(iso(soon)).getTime(), { savedDeadline, sent: iso(soon) });

  // edit nama saja pada tugas yang deadline-nya sudah lewat
  const quick = await req('POST', '/api/tasks', { cookie: cookieA, body: { ...baseTask, name: 'Tugas Cepat', deadline: iso(Date.now() + 1500) } });
  ok('create: tugas deadline dekat 201', quick.status === 201, quick);
  await new Promise((res) => setTimeout(res, 2200));
  r = await req('PATCH', '/api/tasks/' + quick.json.id, { cookie: cookieA, body: { name: 'Tugas Cepat (edit)' } });
  ok('update: edit nama tugas overdue tanpa kirim deadline → 200', r.status === 200 && r.json.name === 'Tugas Cepat (edit)', r);

  r = await req('PATCH', '/api/tasks/' + task.id, { cookie: cookieA, body: { deadline: savedDeadline } });
  ok('update: kirim deadline yang sama → 200 & tidak bergeser', r.status === 200 && new Date(r.json.deadline).getTime() === new Date(savedDeadline).getTime(), r.json);

  r = await req('PATCH', '/api/tasks/' + task.id, { cookie: cookieA, body: { deadline: iso(Date.now() - 3600_000) } });
  ok('update: ubah deadline ke masa lalu 400', r.status === 400, r);

  r = await req('PATCH', '/api/tasks/' + task.id, { cookie: cookieA, body: { startAt: null } });
  ok('update: startAt null diterima', r.status === 200 && r.json.startAt === null, r.json);

  r = await req('PATCH', '/api/tasks/' + task.id, { cookie: cookieA, body: { difficulty: 5 } });
  ok('update: difficulty 5 (kompatibilitas data lama) 200', r.status === 200 && Number(r.json.difficulty) === 5, r.json);

  r = await req('PATCH', '/api/tasks/' + task.id, { cookie: cookieA, body: { name: '  ' } });
  ok('update: nama kosong 400', r.status === 400, r);

  // subtugas: add / rename / reorder / delete
  r = await req('POST', `/api/tasks/${task.id}/subtasks`, { cookie: cookieA, body: { name: '  Subtugas baru ' } });
  ok('subtask: tambah 201 & nama di-trim', r.status === 201 && r.json.name === 'Subtugas baru', r.json);
  const subA = r.json;
  r = await req('POST', `/api/tasks/${task.id}/subtasks`, { cookie: cookieA, body: { name: '   ' } });
  ok('subtask: nama kosong 400', r.status === 400, r);
  r = await req('PATCH', `/api/tasks/${task.id}/subtasks/${subA.id}`, { cookie: cookieA, body: { name: 'Subtask renamed' } });
  ok('subtask: rename 200', r.status === 200 && r.json.name === 'Subtask renamed', r.json);
  r = await req('PATCH', `/api/tasks/${task.id}/subtasks/${subA.id}`, { cookie: cookieA, body: { done: true } });
  ok('subtask: centang 200 & done true', r.status === 200 && r.json.done === true, r.json);

  const ids = (await req('GET', '/api/tasks', { cookie: cookieA })).json.find((t) => t.id === task.id).subtasks.map((s) => s.id);
  r = await req('PATCH', `/api/tasks/${task.id}/subtasks/reorder`, { cookie: cookieA, body: { ids: [...ids].reverse() } });
  const reordered = Array.isArray(r.json) ? r.json : (r.json.subtasks || []);
  ok('subtask: reorder 200 & urutan berubah', r.status === 200 && reordered[0] && reordered[0].id === ids[ids.length - 1], r.json);
  r = await req('PATCH', `/api/tasks/${taskSub.id}/subtasks/reorder`, { cookie: cookieA, body: { ids: [taskSub.subtasks[0].id] } });
  ok('subtask: reorder dengan daftar tidak lengkap 400', r.status === 400, r);
  r = await req('PATCH', `/api/tasks/${taskSub.id}/subtasks/reorder`, { cookie: cookieA, body: { ids: ['id-ngawur', 'lain'] } });
  ok('subtask: reorder id asing 400', r.status === 400, r);

  // complete: subtugas belum semua → 400
  await req('PATCH', `/api/tasks/${task.id}/subtasks/${subA.id}`, { cookie: cookieA, body: { done: false } });
  r = await req('PATCH', `/api/tasks/${task.id}/complete`, { cookie: cookieA, body: { done: true } });
  ok('complete: subtugas belum selesai semua → 400', r.status === 400, r);

  // selesaikan semua subtugas lalu complete
  for (const s of (await req('GET', '/api/tasks', { cookie: cookieA })).json.find((t) => t.id === task.id).subtasks) {
    await req('PATCH', `/api/tasks/${task.id}/subtasks/${s.id}`, { cookie: cookieA, body: { done: true } });
  }
  r = await req('PATCH', `/api/tasks/${task.id}/complete`, { cookie: cookieA, body: { done: true } });
  ok('complete: semua subtugas selesai → 200 & completedAt terisi', r.status === 200 && !!r.json.completedAt, r.json);

  // toggle subtugas setelah selesai → tugas terbuka lagi
  const firstSub = r.json.subtasks[0];
  r = await req('PATCH', `/api/tasks/${task.id}/subtasks/${firstSub.id}`, { cookie: cookieA, body: { done: false } });
  ok('subtask: uncheck setelah selesai 200', r.status === 200, r.json);
  r = await req('GET', '/api/tasks', { cookie: cookieA });
  const reopened = r.json.find((t) => t.id === task.id);
  ok('subtask: uncheck membuka kembali tugas (completedAt null)', reopened.completedAt === null, { completedAt: reopened.completedAt });

  // hapus subtugas
  r = await req('DELETE', `/api/tasks/${task.id}/subtasks/${firstSub.id}`, { cookie: cookieA });
  ok('subtask: hapus 200', r.status === 200, r);
  r = await req('DELETE', `/api/tasks/${task.id}/subtasks/${firstSub.id}`, { cookie: cookieA });
  ok('subtask: hapus dua kali 404', r.status === 404, r);

  // ---------- PRIORITAS ----------
  const mk = (name, dl, hours, diff) => req('POST', '/api/tasks', { cookie: cookieA, body: { name, course: 'Prioritas', weight: 10, difficulty: diff, hours, deadline: iso(dl) } });
  const DL = Date.now() + 3 * 86400_000;
  const pLate = (await mk('P-late', DL + 5 * 86400_000, 1, 1)).json;
  const pEarlyLong = (await mk('P-early-long', DL, 9, 1)).json;
  const pEarlyShortHard = (await mk('P-early-short-hard', DL, 2, 3)).json;
  const pEarlyShortEasy = (await mk('P-early-short-easy', DL, 2, 1)).json;
  r = await req('GET', '/api/tasks', { cookie: cookieA });
  const order = r.json.map((t) => t.name);
  ok('prioritas: deadline lebih awal didahulukan', order.indexOf('P-early-long') < order.indexOf('P-late'), order);

  // ---------- KEPEMILIKAN ----------
  r = await req('POST', '/api/auth/register', { cookie: null, body: { email: emailB, password: pw, name: 'User B' } });
  const cookieB = cookieOf(r);
  ok('register: user B 201', r.status === 201 && !!cookieB, r);

  r = await req('GET', '/api/tasks', { cookie: cookieB });
  ok('isolasi: user B tidak melihat tugas user A', r.status === 200 && r.json.length === 0, { n: r.json.length });
  r = await req('PATCH', '/api/tasks/' + task.id, { cookie: cookieB, body: { name: 'dibajak' } });
  ok('isolasi: user B tidak bisa update tugas A (404)', r.status === 404, r);
  r = await req('DELETE', '/api/tasks/' + task.id, { cookie: cookieB });
  ok('isolasi: user B tidak bisa hapus tugas A (404)', r.status === 404, r);
  r = await req('POST', `/api/tasks/${task.id}/subtasks`, { cookie: cookieB, body: { name: 'x' } });
  ok('isolasi: user B tidak bisa tambah subtugas A (404)', r.status === 404, r);

  // ---------- NOTIFIKASI / EMAIL ----------
  r = await req('GET', '/api/notifications/status', { cookie: cookieA });
  ok('notifikasi: status 200 & menyebut provider', r.status === 200 && !!r.json.provider, r.json);
  const provider = r.json.provider;

  r = await req('POST', '/api/notifications/remind', { cookie: cookieB, body: { taskId: task.id } });
  ok('notifikasi: remind tugas milik orang lain 404', r.status === 404, r);

  const mailBefore = (await (await fetch(MAIL + '/api/v1/messages?limit=1')).json()).total || 0;
  r = await req('POST', '/api/notifications/remind', { cookie: cookieA, body: { taskId: taskSub.id } });
  const resendUnverified = r.status === 400 && /testing emails to your own email address|domain pengirim belum diverifikasi/i.test(JSON.stringify(r.json || {}));
  if (resendUnverified) {
    const msg = JSON.stringify(r.json || {});
    ok('notifikasi: error Resend dipetakan ke petunjuk Indonesia', /domain pengirim belum diverifikasi/i.test(msg), r.json);
    skip('notifikasi: remind manual terkirim', 'domain Resend belum diverifikasi (batasan akun Resend; pakai SMTP atau verifikasi domain)');
  } else {
    ok('notifikasi: remind manual 200/201', r.status === 200 || r.status === 201, r);
  }

  if (provider === 'smtp') {
    let found = null;
    for (let i = 0; i < 12 && !found; i++) {
      await new Promise((res) => setTimeout(res, 500));
      const list = await (await fetch(MAIL + '/api/v1/messages?limit=5')).json();
      if ((list.total || 0) > mailBefore) {
        const msg = await (await fetch(MAIL + '/api/v1/message/' + list.messages[0].ID)).json();
        found = msg;
      }
    }
    ok('email: tertangkap Mailpit', !!found, { mailBefore });
    if (found) {
      const body = (found.Text || '') + (found.HTML || '');
      ok('email: memuat nama tugas', /Tugas Bersubtugas/.test(body), found.Subject);
      ok('email: memuat mata kuliah', /Algoritma/.test(body), found.Subject);
      ok('email: memuat deadline', /Deadline/.test(body) && /WIB/.test(body), found.Subject);
      ok('email: memuat tingkat kesulitan + label', /Tingkat kesulitan/.test(body) && /(Mudah|Sedang|Sulit|Sangat sulit)/.test(body), found.Subject);
      ok('email: memuat subtugas', /Subtask/i.test(body) && /Riset/.test(body), found.Subject);
      ok('email: subjek menyebut tugas', /Tugas Bersubtugas/.test(found.Subject), found.Subject);
      ok('email: penerima benar', (found.To || []).some((t) => t.Address === emailA), found.To);
    }
  } else {
    console.log('SKIP  verifikasi email (provider=' + provider + ', bukan smtp)');
  }

  // ---------- DELETE ----------
  r = await req('DELETE', '/api/tasks/' + taskSub.id, { cookie: cookieA });
  ok('delete: hapus tugas 200', r.status === 200, r);
  r = await req('PATCH', '/api/tasks/' + taskSub.id, { cookie: cookieA, body: { name: 'x' } });
  ok('delete: tugas terhapus → 404', r.status === 404, r);

  // bersihkan sisa data uji
  const all = (await req('GET', '/api/tasks', { cookie: cookieA })).json;
  for (const t of all) await req('DELETE', '/api/tasks/' + t.id, { cookie: cookieA });

  console.log('\n===== HASIL: ' + pass + ' pass, ' + fails.length + ' fail, ' + skips.length + ' skip =====');
  if (skips.length) console.log('SKIP:\n' + skips.join('\n'));
  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
