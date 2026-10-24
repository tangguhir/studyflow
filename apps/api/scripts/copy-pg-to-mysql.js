/**
 * Salin data dari PostgreSQL lama (container studyflow-db-1) ke MySQL baru
 * (container studyflow-mysql) lewat Prisma Client yang sudah di-generate untuk
 * schema MySQL. Dijalankan dari apps/api supaya @prisma/client + .env terpakai.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// --- muat DATABASE_URL dari .env (tanpa menampilkan nilainya) ---
const envText = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
const dbLine = envText.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
if (!dbLine) throw new Error("DATABASE_URL tidak ditemukan di .env");
process.env.DATABASE_URL = dbLine.slice("DATABASE_URL=".length).trim();
if (!process.env.DATABASE_URL.startsWith("mysql://")) {
  throw new Error("DATABASE_URL bukan MySQL — batalkan agar data tidak salah target");
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PG = ["exec", process.env.PG_CONTAINER || "studyflow-pg-legacy", "psql", "-U", "studyflow", "-d", "studyflow", "-t", "-A", "-c"];
function pgJson(sql) {
  const out = execFileSync("docker", [...PG, sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  return out ? JSON.parse(out) : [];
}

const TS = (col) => `to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const d = (v) => (v ? new Date(v) : null);

async function main() {
  const users = pgJson(`select coalesce(json_agg(x),'[]') from (
    select id, email, name, "passwordHash", ${TS('"createdAt"')} as "createdAt" from "User"
  ) x`);

  const tasks = pgJson(`select coalesce(json_agg(x),'[]') from (
    select id, "userId", name, course, weight, difficulty, hours,
           ${TS('deadline')} as deadline, ${TS('"startAt"')} as "startAt",
           ${TS('"completedAt"')} as "completedAt", ${TS('"createdAt"')} as "createdAt"
    from "Task"
  ) x`);

  const subtasks = pgJson(`select coalesce(json_agg(x),'[]') from (
    select id, "taskId", name, done, position, ${TS('"createdAt"')} as "createdAt" from "Subtask"
  ) x`);

  const notifs = pgJson(`select coalesce(json_agg(x),'[]') from (
    select id, "userId", "taskId", kind, ${TS('"scheduledFor"')} as "scheduledFor",
           ${TS('"sentAt"')} as "sentAt"
    from "NotificationLog"
  ) x`);

  console.log(`SUMBER  users=${users.length} tasks=${tasks.length} subtasks=${subtasks.length} notifs=${notifs.length}`);

  // bersihkan target (urutan anak -> induk) supaya skrip idempoten
  await prisma.notificationLog.deleteMany();
  await prisma.subtask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: users.map((u) => ({
      id: u.id, email: u.email, name: u.name,
      passwordHash: u.passwordHash, createdAt: d(u.createdAt),
    })),
  });

  await prisma.task.createMany({
    data: tasks.map((t) => ({
      id: t.id, userId: t.userId, name: t.name, course: t.course,
      weight: t.weight, difficulty: t.difficulty, hours: t.hours,
      deadline: d(t.deadline), startAt: d(t.startAt),
      completedAt: d(t.completedAt), createdAt: d(t.createdAt),
    })),
  });

  await prisma.subtask.createMany({
    data: subtasks.map((s) => ({
      id: s.id, taskId: s.taskId, name: s.name, done: s.done,
      position: s.position, createdAt: d(s.createdAt),
    })),
  });

  if (notifs.length) {
    await prisma.notificationLog.createMany({
      data: notifs.map((n) => ({
        id: n.id, userId: n.userId, taskId: n.taskId, kind: n.kind,
        scheduledFor: d(n.scheduledFor), sentAt: d(n.sentAt),
      })),
    });
  }

  const [u2, t2, s2, n2] = await Promise.all([
    prisma.user.count(), prisma.task.count(), prisma.subtask.count(), prisma.notificationLog.count(),
  ]);
  console.log(`TARGET  users=${u2} tasks=${t2} subtasks=${s2} notifs=${n2}`);

  // uji integritas relasi + round-trip tanggal
  const orphanTasks = await prisma.$queryRawUnsafe(
    "select count(*) as c from `Task` t left join `User` u on u.id=t.userId where u.id is null");
  const orphanSubs = await prisma.$queryRawUnsafe(
    "select count(*) as c from `Subtask` s left join `Task` t on t.id=s.taskId where t.id is null");
  console.log(`ORPHANS tasks=${Number(orphanTasks[0].c)} subtasks=${Number(orphanSubs[0].c)}`);

  const sample = await prisma.task.findFirst({ orderBy: { createdAt: "asc" } });
  if (sample) {
    const src = tasks.find((t) => t.id === sample.id);
    console.log(`SAMPLE_TASK ${sample.name.slice(0, 40)}`);
    console.log(`  deadline src=${src.deadline} mysql=${sample.deadline.toISOString()}`);
    console.log(`  match=${src.deadline === sample.deadline.toISOString()}`);
  }

  const ok = u2 === users.length && t2 === tasks.length && s2 === subtasks.length && n2 === notifs.length;
  console.log(ok ? "COPY_OK" : "COPY_MISMATCH");
  if (!ok) process.exitCode = 1;
}

main()
  .catch((e) => { console.error("COPY_FAIL", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
