// Uji end-to-end pengingat email StudyFlow.
// Memverifikasi: (1) email otomatis H-1 hari, (2) email otomatis H-N jam (N = estimasi),
// (3) isi email memuat nama user/tugas/matkul/deadline/kesulitan, (4) tugas selesai TIDAK dikirimi,
// (5) tombol kirim email per tugas berfungsi dan menolak tugas selesai.
const BASE = process.env.BASE || 'http://127.0.0.1:4000';
const MAILPIT = process.env.MAILPIT || 'http://127.0.0.1:8025';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass += 1; console.log('PASS  ' + name); }
  else { fail += 1; console.log('FAIL  ' + name + (extra !== undefined ? '  :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
};

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

async function req(method, path, { body, cookie } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

async function mailpitMessages(limit = 100) {
  const res = await fetch(`${MAILPIT}/api/v1/messages?limit=${limit}`);
  const json = await res.json();
  return json.messages || [];
}

async function mailpitMessage(id) {
  const res = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  return res.json();
}

async function waitFor(predicate, timeoutMs = 90_000, intervalMs = 5_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

const stamp = Date.now().toString(36);
const email = `rem.${stamp}@studyflow.test`;
const PASSWORD = 'RahasiaStudi123';

(async () => {
  // ---------- 0. siapkan akun ----------
  let r = await req('POST', '/api/auth/register', { body: { name: 'Rani Penguji', email, password: PASSWORD } });
  ok('akun uji terdaftar', r.status === 201 || r.status === 200, r);
  const cookie = r.cookie;

  r = await req('GET', '/api/notifications/status', { cookie });
  ok('penyedia email aktif', r.status === 200 && r.json.provider !== 'none', r.json);

  // ---------- 1. tugas A: H-1 hari jatuh ~2 menit lalu ----------
  const deadlineA = new Date(Date.now() + DAY - 2 * MIN);
  r = await req('POST', '/api/tasks', {
    cookie,
    body: {
      name: 'Laporan Praktikum A',
      course: 'Basis Data',
      weight: 25,
      difficulty: 3,
      hours: 2,
      deadline: deadlineA.toISOString(),
    },
  });
  ok('tugas A dibuat (pengingat H-1 sudah lewat 2 menit)', r.status === 201 || r.status === 200, r);
  const taskA = r.json;

  // ---------- 2. tugas B: H-N jam jatuh ~3 menit lalu (N = 2,05 jam) ----------
  const deadlineB = new Date(Date.now() + 2 * HOUR + 3 * MIN);
  r = await req('POST', '/api/tasks', {
    cookie,
    body: {
      name: 'Esai Filsafat B',
      course: 'Filsafat Ilmu',
      weight: 30,
      difficulty: 2,
      hours: 2.05,
      deadline: deadlineB.toISOString(),
    },
  });
  ok('tugas B dibuat (pengingat H-N jam sudah lewat 3 menit)', r.status === 201 || r.status === 200, r);
  const taskB = r.json;

  // ---------- 3. tugas C: H-1 juga jatuh di jendela, TAPI sudah selesai ----------
  const deadlineC = new Date(Date.now() + DAY - 2 * MIN);
  r = await req('POST', '/api/tasks', {
    cookie,
    body: {
      name: 'Tugas Selesai C',
      course: 'Statistika',
      weight: 10,
      difficulty: 1,
      hours: 1,
      deadline: deadlineC.toISOString(),
    },
  });
  const taskC = r.json;
  r = await req('PATCH', `/api/tasks/${taskC.id}/complete`, { cookie, body: { done: true } });
  ok('tugas C ditandai selesai', r.status === 200 && !!r.json.completedAt, r);

  // ---------- 4. tunggu cron mengirim ----------
  const gotA = await waitFor(async () => {
    const msgs = await mailpitMessages();
    return msgs.some((m) => (m.To || []).some((t) => t.Address === email) && /Besok tenggat/i.test(m.Subject));
  }, 120_000);
  ok('email otomatis H-1 hari terkirim', gotA);

  const gotB = await waitFor(async () => {
    const msgs = await mailpitMessages();
    return msgs.some((m) => (m.To || []).some((t) => t.Address === email) && /jam lagi/i.test(m.Subject));
  }, 120_000);
  ok('email otomatis H-N jam terkirim', gotB);

  // ---------- 5. periksa isi email ----------
  const msgs = await mailpitMessages();
  const mine = msgs.filter((m) => (m.To || []).some((t) => t.Address === email));
  const subjectList = mine.map((m) => m.Subject);
  console.log('      subjek terkirim: ' + JSON.stringify(subjectList));

  const fullA = mine.find((m) => /Laporan Praktikum A/.test(m.Subject) && /Besok tenggat/i.test(m.Subject));
  if (fullA) {
    const detail = await mailpitMessage(fullA.ID);
    const body = String(detail.HTML || detail.Text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    ok('email H-1 memuat sapaan nama user', /Halo,?\s*Rani Penguji/i.test(body), body.slice(0, 160));
    ok('email H-1 memuat nama tugas', /Laporan Praktikum A/.test(body));
    ok('email H-1 memuat nama matkul', /Basis Data/.test(body));
    ok('email H-1 memuat waktu deadline', /November 2026|Oktober 2026|pukul/i.test(body));
    ok('email H-1 memuat tingkat kesulitan', /Sulit/.test(body));
    ok('email H-1 menyebut "satu hari"', /satu hari lagi/i.test(body), body.slice(0, 300));
  } else {
    ok('email H-1 ditemukan untuk diperiksa isinya', false, subjectList);
  }

  const fullB = mine.find((m) => /Esai Filsafat B/.test(m.Subject));
  if (fullB) {
    const detail = await mailpitMessage(fullB.ID);
    const body = String(detail.HTML || detail.Text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    ok('email H-N memuat nama user', /Halo,?\s*Rani Penguji/i.test(body));
    ok('email H-N memuat nama matkul', /Filsafat Ilmu/.test(body));
    ok('email H-N memuat tingkat kesulitan', /Sedang/.test(body));
    ok('email H-N menyebut sisa jam sesuai estimasi', /2,05 jam lagi/i.test(body), body.slice(0, 300));
  } else {
    ok('email H-N ditemukan untuk diperiksa isinya', false, subjectList);
  }

  // ---------- 6. tugas selesai tidak dikirimi ----------
  ok('tugas selesai tidak menerima email apa pun',
    !subjectList.some((s) => /Tugas Selesai C/.test(s)), subjectList);

  // ---------- 7. tombol kirim email per tugas ----------
  r = await req('POST', '/api/notifications/remind', { cookie, body: { taskId: taskA.id } });
  ok('tombol kirim email per tugas berhasil (200)', r.status === 200 || r.status === 201, r);

  const manualArrived = await waitFor(async () => {
    const list = await mailpitMessages();
    return list.some((m) => (m.To || []).some((t) => t.Address === email)
      && /Pengingat tugas: Laporan Praktikum A/i.test(m.Subject));
  }, 45_000, 3_000);
  ok('email dari tombol per tugas benar-benar masuk inbox', manualArrived);

  r = await req('POST', '/api/notifications/remind', { cookie, body: { taskId: taskC.id } });
  ok('tombol email menolak tugas selesai (400)',
    r.status === 400 && /sudah selesai/i.test(JSON.stringify(r.json)), r);

  // ---------- 8. tidak ada duplikat ----------
  const after = await mailpitMessages();
  const mineAfter = after.filter((m) => (m.To || []).some((t) => t.Address === email));
  const h1Count = mineAfter.filter((m) => /Laporan Praktikum A/.test(m.Subject) && /Besok tenggat/i.test(m.Subject)).length;
  ok('email H-1 tidak terkirim dua kali', h1Count === 1, h1Count);

  console.log(`\n===== REMINDER: ${pass} pass, ${fail} fail =====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
