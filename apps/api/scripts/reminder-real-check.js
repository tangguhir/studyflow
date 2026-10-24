/* Uji nyata: pengingat otomatis lewat Resend ke inbox Gmail pemilik akun.
   Membuat satu tugas sementara untuk user nyata, menunggu cron mengirim,
   memeriksa NotificationLog, lalu menghapus tugas tersebut. */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8');
const url = (env.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
if (!url) throw new Error('DATABASE_URL tidak ditemukan di .env');

const db = new PrismaClient({ datasources: { db: { url } } });
const MIN = 60_000;
const DAY = 86_400_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const targetEmail = process.argv[2] || 'tanqquh@gmail.com';
  const user = await db.user.findFirst({ where: { email: targetEmail } });
  if (!user) throw new Error('user tidak ditemukan');
  console.log('user:', user.email, '| nama:', user.name);

  const task = await db.task.create({
    data: {
      userId: user.id,
      name: 'Uji Pengingat Otomatis',
      course: 'Verifikasi Email',
      weight: 10,
      difficulty: 2,
      hours: 2,
      deadline: new Date(Date.now() + DAY - 2 * MIN),
    },
  });
  console.log('task dibuat:', task.id, '| deadline:', task.deadline.toISOString());

  // tunggu cron (jalan tiap menit)
  let logs = [];
  for (let i = 0; i < 20; i++) {
    await sleep(6000);
    logs = await db.notificationLog.findMany({ where: { taskId: task.id } });
    if (logs.length) break;
  }

  console.log('NotificationLog:', logs.map((l) => `${l.kind} @ ${l.scheduledFor.toISOString()}`));

  await db.task.delete({ where: { id: task.id } });
  const left = await db.notificationLog.count({ where: { taskId: task.id } });
  console.log('tugas uji dihapus | sisa log:', left);
  await db.$disconnect();
  process.exit(logs.length ? 0 : 1);
})().catch(async (e) => {
  console.error('ERROR', e.message);
  try { await db.$disconnect(); } catch {}
  process.exit(1);
});
