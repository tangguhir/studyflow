/* Uji nyata fitur pengingat email:
   A. HTTP: toggle PATCH /tasks/:id/reminder benar-benar mengubah status, dan
      create/update tugas menghormati field emailReminder.
   B. Cron: pengingat ketiga ('start') benar-benar terkirim tepat pada startAt.
   C. Cron: bila toggle dimatikan, tidak ada email sama sekali.
   Semua data uji dihapus di akhir. */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8');
const url = (env.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
if (!url) throw new Error('DATABASE_URL tidak ditemukan di .env');

const db = new PrismaClient({ datasources: { db: { url } } });
const BASE = process.env.SF_BASE || 'http://127.0.0.1:4000';
const MIN = 60_000;
const DAY = 86_400_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  :: ' + JSON.stringify(extra) : '')); }
}

async function http(p, method, body, cookie) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const jar = setCookie.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
  return { status: res.status, json, cookie: jar || cookie };
}

(async () => {
  const stamp = Date.now();
  const email = `start.check.${stamp}@studyflow.test`;
  const password = 'Rahasia123';
  const created = { tasks: [], userId: null };

  // ---------- A. HTTP: toggle & DTO ----------
  const reg = await http('/api/auth/register', 'POST', { name: 'Uji Start', email, password });
  ok('A1 register 201', reg.status === 201, reg.status);
  const login = await http('/api/auth/login', 'POST', { email, password });
  ok('A2 login 200', login.status === 200, login.status);
  const cookie = login.cookie;
  created.userId = login.json?.user?.id || reg.json?.user?.id || null;

  const mk = await http('/api/tasks', 'POST', {
    name: 'Tugas Toggle', course: 'Uji', weight: 20, difficulty: 2, hours: 2,
    deadline: new Date(Date.now() + 3 * DAY).toISOString(),
    startAt: new Date(Date.now() + 2 * DAY).toISOString(),
    emailReminder: false,
  }, cookie);
  ok('A3 create dengan emailReminder:false dihormati', mk.status === 201 && mk.json?.emailReminder === false, mk.json);
  const taskId = mk.json?.id;
  if (taskId) created.tasks.push(taskId);

  const off = await http(`/api/tasks/${taskId}/reminder`, 'PATCH', { enabled: true }, cookie);
  ok('A4 PATCH toggle nyalakan -> true', off.status === 200 && off.json?.emailReminder === true, off.json);
  const on = await http(`/api/tasks/${taskId}/reminder`, 'PATCH', { enabled: false }, cookie);
  ok('A5 PATCH toggle matikan -> false', on.status === 200 && on.json?.emailReminder === false, on.json);

  const list = await http('/api/tasks', 'GET', undefined, cookie);
  const listed = Array.isArray(list.json) ? list.json.find((t) => t.id === taskId) : null;
  ok('A6 list tugas memuat emailReminder', !!listed && listed.emailReminder === false, listed && listed.emailReminder);

  const upd = await http(`/api/tasks/${taskId}`, 'PATCH', { emailReminder: true }, cookie);
  ok('A7 update form edit mengubah emailReminder', upd.status === 200 && upd.json?.emailReminder === true, upd.json);

  // ---------- B & C. Cron nyata ----------
  const owner = await db.user.findFirst({ where: { email: 'tanqquh@gmail.com' } });
  if (!owner) throw new Error('user pemilik email tidak ditemukan');

  const startAt = new Date(Date.now() + MIN + 15_000);
  const liveTask = await db.task.create({
    data: {
      userId: owner.id,
      name: 'Uji Pengingat Waktu Mulai',
      course: 'Verifikasi Email',
      weight: 10, difficulty: 2, hours: 3,
      deadline: new Date(Date.now() + 5 * DAY),
      startAt,
      emailReminder: true,
    },
  });
  console.log('task start dibuat:', liveTask.id, '| startAt:', startAt.toISOString());

  let logs = [];
  for (let i = 0; i < 30; i++) {
    await sleep(6000);
    logs = await db.notificationLog.findMany({ where: { taskId: liveTask.id } });
    if (logs.length) break;
  }
  const startLog = logs.find((l) => l.kind === 'start');
  ok('B1 email pengingat waktu mulai terkirim', !!startLog, logs.map((l) => l.kind));
  ok('B2 dijadwalkan tepat pada startAt', !!startLog && startLog.scheduledFor.getTime() === startAt.getTime(), startLog && startLog.scheduledFor.toISOString());
  ok('B3 tidak ada email H-1/H-N prematur', !logs.some((l) => l.kind !== 'start'), logs.map((l) => l.kind));

  const mutedAt = new Date(Date.now() + MIN + 10_000);
  const mutedTask = await db.task.create({
    data: {
      userId: owner.id,
      name: 'Uji Toggle Mati',
      course: 'Verifikasi Email',
      weight: 10, difficulty: 2, hours: 3,
      deadline: new Date(Date.now() + 6 * DAY),
      startAt: mutedAt,
      emailReminder: false,
    },
  });
  console.log('task mati dibuat:', mutedTask.id, '| startAt:', mutedAt.toISOString());
  await sleep(2 * MIN + 20_000);
  const mutedLogs = await db.notificationLog.findMany({ where: { taskId: mutedTask.id } });
  ok('C1 toggle mati -> tidak ada email sama sekali', mutedLogs.length === 0, mutedLogs.map((l) => l.kind));

  // ---------- bersihkan ----------
  for (const t of [liveTask.id, mutedTask.id]) {
    await db.notificationLog.deleteMany({ where: { taskId: t } });
    await db.task.delete({ where: { id: t } }).catch(() => {});
  }
  for (const t of created.tasks) {
    await db.subtask.deleteMany({ where: { taskId: t } });
    await db.task.delete({ where: { id: t } }).catch(() => {});
  }
  if (created.userId) {
    await db.notificationLog.deleteMany({ where: { userId: created.userId } }).catch(() => {});
    await db.task.deleteMany({ where: { userId: created.userId } }).catch(() => {});
    await db.user.delete({ where: { id: created.userId } }).catch(() => {});
  }
  console.log('data uji dibersihkan');

  await db.$disconnect();
  console.log(`\n===== PENGINGAT: ${pass} pass, ${fail} fail =====`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error('ERROR', e && e.stack ? e.stack : e);
  try { await db.$disconnect(); } catch {}
  process.exit(1);
});
