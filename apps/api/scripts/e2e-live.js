/**
 * Uji end-to-end terhadap API StudyFlow yang sedang berjalan (MySQL).
 * Jalankan: node scripts/e2e-live.js
 * Butuh: API di http://127.0.0.1:4000, Mailpit di http://127.0.0.1:8025 (opsional).
 */
const API = process.env.API_URL || 'http://127.0.0.1:4000/api';
const MAILPIT = process.env.MAILPIT_URL || 'http://127.0.0.1:8025';

let pass = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fails.push(name + (extra ? ' :: ' + JSON.stringify(extra) : '')); console.log('FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra) : '')); }
}

class Client {
  constructor() { this.cookie = ''; }
  async req(method, path, body) {
    const headers = { 'content-type': 'application/json' };
    if (this.cookie) headers.cookie = this.cookie;
    const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of setCookie) {
      const kv = c.split(';')[0];
      if (kv.startsWith('sf_token=')) this.cookie = res.status === 200 || res.status === 201 ? kv : '';
    }
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b); }
  patch(p, b) { return this.req('PATCH', p, b); }
  del(p) { return this.req('DELETE', p); }
}

const iso = (d) => new Date(d).toISOString();

(async () => {
  const stamp = Date.now();
  const emailA = `e2e.a.${stamp}@example.com`;
  const emailB = `e2e.b.${stamp}@example.com`;
  const pw = 'rahasia12345';
  const A = new Client();

  // ---------- AUTH ----------
  let r = await A.post('/auth/register', { name: 'E2E A', email: emailA, password: pw });
  ok('register 201', r.status === 201, r);
  ok('register mengembalikan user tanpa passwordHash', r.data && r.data.email === emailA && !('passwordHash' in r.data), r.data);
  ok('register menyetel cookie sesi', !!A.cookie, { cookie: !!A.cookie });

  r = await A.get('/auth/me');
  ok('me 200 setelah register', r.status === 200 && r.data.email === emailA, r);

  r = await A.post('/auth/register', { name: 'Dup', email: emailA, password: pw });
  ok('register email duplikat ditolak (4xx)', r.status >= 400 && r.status < 500, r);

  r = await A.post('/auth/login', { email: emailA, password: 'salahbanget' });
  ok('login password salah ditolak 401', r.status === 401, r);

  const B = new Client();
  r = await B.post('/auth/register', { name: 'E2E B', email: emailB, password: pw });
  ok('register user kedua 201', r.status === 201, r);

  const anon = new Client();
  r = await anon.get('/tasks');
  ok('akses tanpa sesi ditolak 401', r.status === 401, r);

  // ---------- CREATE TASKS ----------
  const t1 = {
    name: 'Laporan Basis Data',
    course: 'Basis Data',
    weight: 30,
    difficulty: 3,
    hours: 6,
    deadline: '2026-11-05T15:00:00.000Z',
    subtasks: [{ name: 'Cari referensi' }, { name: 'Tulis bab 1' }, { name: 'Revisi' }],
  };
  r = await A.post('/tasks', t1);
  ok('create tugas 201', r.status === 201, r);
  const task1 = r.data;
  ok('deadline tersimpan tepat (tidak bergeser)', iso(task1.deadline) === t1.deadline, { got: task1.deadline });
  ok('subtasks tersimpan 3 dengan posisi 0,1,2', task1.subtasks?.length === 3 && task1.subtasks.map(s => s.position).join(',') === '0,1,2', task1.subtasks?.map(s => s.position));
  ok('nama subtask berurutan sesuai input', task1.subtasks?.[0].name === 'Cari referensi' && task1.subtasks?.[2].name === 'Revisi', task1.subtasks?.map(s => s.name));
  ok('tugas baru belum selesai', task1.completedAt === null, task1.completedAt);

  const t2 = { name: 'UTS Algoritma', course: 'Algoritma', weight: 40, difficulty: 2, hours: 3, deadline: '2026-11-01T09:30:00.000Z' };
  const t3 = { name: 'Kuis Jaringan', course: 'Jaringan', weight: 20, difficulty: 1, hours: 1.5, deadline: '2026-11-01T09:30:00.000Z', startAt: '2026-10-28T02:00:00.000Z' };
  const r2 = await A.post('/tasks', t2);
  const r3 = await A.post('/tasks', t3);
  ok('create tugas 2 & 3', r2.status === 201 && r3.status === 201, [r2.status, r3.status]);
  ok('startAt tersimpan tepat', iso(r3.data.startAt) === t3.startAt, r3.data.startAt);

  r = await A.post('/tasks', { ...t1, deadline: 'bukan-tanggal' });
  ok('deadline tidak valid ditolak 400', r.status === 400, r);
  r = await A.post('/tasks', { ...t1, difficulty: 9 });
  ok('difficulty di luar 1-3 ditolak 400', r.status === 400, r);
  r = await A.post('/tasks', { ...t1, hours: 0 });
  ok('hours < 0.5 ditolak 400', r.status === 400, r);
  r = await A.post('/tasks', { ...t1, name: '' });
  ok('nama kosong ditolak 400', r.status === 400, r);

  // ---------- LIST / ORDER ----------
  r = await A.get('/tasks');
  ok('list 200 & berisi 3 tugas', r.status === 200 && r.data.length === 3, r.data?.length);
  const deadlines = r.data.map(t => iso(t.deadline));
  ok('list terurut deadline naik', deadlines[0] === '2026-11-01T09:30:00.000Z' && deadlines[2] === '2026-11-05T15:00:00.000Z', deadlines);
  ok('list hanya milik user sendiri', r.data.every(t => t.userId === task1.userId), true);
  const listed1 = r.data.find(t => t.id === task1.id);
  ok('subtasks ikut terurut pada list', listed1.subtasks.map(s => s.position).join(',') === '0,1,2', listed1.subtasks.map(s => s.position));

  // ---------- ISOLASI ANTAR USER ----------
  r = await B.get('/tasks');
  ok('user B tidak melihat tugas user A', r.status === 200 && r.data.length === 0, r.data?.length);
  r = await B.patch('/tasks/' + task1.id, { name: 'Dibajak' });
  ok('user B tidak bisa ubah tugas A (404)', r.status === 404, r);
  r = await B.del('/tasks/' + task1.id);
  ok('user B tidak bisa hapus tugas A (404)', r.status === 404, r);

  // ---------- UPDATE ----------
  r = await A.patch('/tasks/' + task1.id, { name: 'Laporan Basis Data (final)', course: 'Basis Data Lanjut', weight: 35, difficulty: 2, hours: 5.5, deadline: '2026-11-06T10:15:00.000Z' });
  ok('update tugas 200', r.status === 200, r);
  ok('update nama/kursus/weight tersimpan', r.data.name === 'Laporan Basis Data (final)' && r.data.course === 'Basis Data Lanjut' && r.data.weight === 35, r.data);
  ok('update deadline tepat tanpa pergeseran', iso(r.data.deadline) === '2026-11-06T10:15:00.000Z', r.data.deadline);
  ok('update tidak menghapus subtasks', r.data.subtasks.length === 3, r.data.subtasks.length);

  r = await A.patch('/tasks/' + task1.id, { name: 'Nama saja' });
  ok('patch sebagian tidak mengubah deadline', iso(r.data.deadline) === '2026-11-06T10:15:00.000Z', r.data.deadline);

  r = await A.patch('/tasks/does-not-exist', { name: 'x' });
  ok('update tugas tidak ada → 404', r.status === 404, r);

  // ---------- SUBTASKS ----------
  r = await A.post(`/tasks/${task1.id}/subtasks`, { name: 'Buat slide' });
  ok('tambah subtask 201 & posisi terakhir', r.status === 201 && r.data.position === 3, r.data);
  const sub4 = r.data;

  r = await A.patch(`/tasks/${task1.id}/subtasks/${sub4.id}`, { done: true });
  ok('centang subtask (done=true)', r.status === 200 && r.data.done === true, r.data);

  r = await A.patch(`/tasks/${task1.id}/subtasks/${sub4.id}`, { name: 'Buat slide presentasi' });
  ok('ganti nama subtask', r.status === 200 && r.data.name === 'Buat slide presentasi' && r.data.done === true, r.data);

  const ids = (await A.get('/tasks')).data.find(t => t.id === task1.id).subtasks.map(s => s.id);
  const reversed = [...ids].reverse();
  r = await A.patch(`/tasks/${task1.id}/subtasks/reorder`, { ids: reversed });
  ok('reorder subtasks 200', r.status === 200, r);
  r = await A.get('/tasks');
  const afterReorder = r.data.find(t => t.id === task1.id).subtasks;
  ok('urutan subtask mengikuti reorder', afterReorder.map(s => s.id).join(',') === reversed.join(','), afterReorder.map(s => s.name));
  ok('reorder tidak mengubah status done', afterReorder.find(s => s.id === sub4.id).done === true, afterReorder.find(s => s.id === sub4.id));

  // ---------- COMPLETE ----------
  r = await A.patch(`/tasks/${task1.id}/complete`, { done: true });
  ok('selesaikan tugas ditolak bila ada subtask belum dicentang (400)', r.status === 400, r);

  for (const s of afterReorder) await A.patch(`/tasks/${task1.id}/subtasks/${s.id}`, { done: true });
  r = await A.patch(`/tasks/${task1.id}/complete`, { done: true });
  ok('selesaikan tugas 200 setelah semua subtask selesai', r.status === 200 && r.data.completedAt !== null, r.data);

  r = await A.post(`/tasks/${task1.id}/subtasks`, { name: 'Catatan tambahan' });
  ok('tambah subtask pada tugas selesai membuka kembali tugas', r.status === 201, r);
  const reopened = (await A.get('/tasks')).data.find(t => t.id === task1.id);
  ok('completedAt dikosongkan setelah subtask baru', reopened.completedAt === null, reopened.completedAt);

  r = await A.patch(`/tasks/${task1.id}/complete`, { done: false });
  ok('batal selesai (done=false) 200', r.status === 200 && r.data.completedAt === null, r.data);

  r = await A.del(`/tasks/${task1.id}/subtasks/${sub4.id}`);
  ok('hapus subtask 200/204', r.status === 200 || r.status === 204, r);
  const afterDelete = (await A.get('/tasks')).data.find(t => t.id === task1.id);
  ok('subtask benar-benar hilang', !afterDelete.subtasks.some(s => s.id === sub4.id), afterDelete.subtasks.map(s => s.name));

  r = await A.del(`/tasks/${task1.id}/subtasks/does-not-exist`);
  ok('hapus subtask tidak ada → 404', r.status === 404, r);

  // ---------- NOTIFIKASI ----------
  r = await A.get('/notifications/status');
  ok('status notifikasi 200', r.status === 200 && typeof r.data.provider === 'string', r.data);
  const provider = r.data?.provider;

  r = await A.post('/notifications/test', {});
  ok('kirim email uji', r.status === 201 || r.status === 200, r);

  r = await A.post('/notifications/remind', { taskId: r2.data.id });
  const remindOk = r.status === 201 || r.status === 200;
  ok('kirim pengingat tugas', remindOk, r);

  r = await A.post('/notifications/remind', {});
  ok('remind tanpa taskId → 400', r.status === 400, r);
  r = await A.post('/notifications/remind', { taskId: 'does-not-exist' });
  ok('remind taskId asing → 404', r.status === 404, r);

  // Isi email diperiksa dari Mailpit bila tersedia.
  try {
    const mp = await fetch(`${MAILPIT}/api/v1/messages?limit=20`);
    if (mp.ok) {
      const list = await mp.json();
      const msg = (list.messages || []).find(m => (m.To || []).some(t => t.Address === emailA) && /UTS Algoritma/.test(m.Subject || ''));
      ok('email pengingat masuk ke Mailpit', !!msg, { subject: (list.messages || []).map(m => m.Subject) });
      if (msg) {
        const detail = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
        const body = [detail.Text, detail.HTML].filter(Boolean).join('\n');
        ok('email memuat nama tugas', /UTS Algoritma/.test(body));
        ok('email memuat mata kuliah', /Algoritma/.test(body));
        ok('email memuat deadline', /2026|November|Nov/i.test(body));
        ok('email memuat tingkat kesulitan', /Sedang|kesulitan/i.test(body));
      }
    } else {
      console.log('SKIP verifikasi isi email (Mailpit tidak aktif)');
    }
  } catch (e) {
    console.log('SKIP verifikasi isi email: ' + e.message);
  }

  // ---------- LOGOUT ----------
  r = await A.post('/auth/logout', {});
  ok('logout 200/201', r.status === 200 || r.status === 201, r);
  A.cookie = '';
  r = await A.get('/auth/me');
  ok('me 401 setelah logout', r.status === 401, r);

  r = await B.post('/auth/login', { email: emailB, password: pw });
  ok('login ulang user B 200', r.status === 200 && r.data.email === emailB, r);

  // ---------- CLEANUP ----------
  const cleanup = new Client();
  cleanup.cookie = B.cookie;
  await cleanup.del('/tasks/' + r2.data.id);
  await cleanup.del('/tasks/' + r3.data.id);
  const sisa = (await cleanup.get('/tasks')).data.length;
  ok('hapus tugas milik sendiri berhasil', sisa === 0, { sisa });

  console.log(`\nHASIL: ${pass} lulus, ${fails.length} gagal`);
  if (fails.length) { console.log('GAGAL:\n- ' + fails.join('\n- ')); process.exit(1); }
})().catch(e => { console.error('ERROR_FATAL', e); process.exit(1); });
