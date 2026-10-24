/* eslint-disable @typescript-eslint/no-require-imports */
// Unit test jadwal pengingat: H-1 hari dan H-N jam (N = estimasi pengerjaan).
// Memakai prototype langsung agar tidak perlu koneksi DB / provider email.
const path = require('path');
const { EmailReminderService } = require(
  path.join(__dirname, '..', 'apps', 'api', 'dist', 'apps', 'api', 'src', 'email-reminder.service.js'),
);

const svc = Object.create(EmailReminderService.prototype);
let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log('PASS  ' + name);
  } else {
    fail += 1;
    console.log('FAIL  ' + name + (extra !== undefined ? '  :: ' + JSON.stringify(extra) : ''));
  }
}

function iso(d) {
  return new Date(d).toISOString();
}

// Contoh dari spesifikasi: deadline 13 Nov 14:50, estimasi 1 jam.
const caseA = new Date('2026-11-13T14:50:00+07:00');
const a = svc.reminderSchedule(caseA, 1);
ok('jadwal: dua pengingat untuk estimasi 1 jam', a.length === 2, a);
ok('jadwal: H-1 hari = 12 Nov 14:50 WIB',
  a[0].kind === 'deadline-1d' && iso(a[0].at) === iso(new Date('2026-11-12T14:50:00+07:00')), a[0]);
ok('jadwal: H-1 jam = 13 Nov 13:50 WIB',
  a[1].kind === 'deadline-hours' && iso(a[1].at) === iso(new Date('2026-11-13T13:50:00+07:00')), a[1]);

// Contoh lain: deadline 18:00, estimasi 4 jam -> pengingat 14:00 hari yang sama.
const caseB = new Date('2026-11-20T18:00:00+07:00');
const b = svc.reminderSchedule(caseB, 4);
ok('jadwal: estimasi 4 jam -> 14:00 di hari deadline',
  iso(b[1].at) === iso(new Date('2026-11-20T14:00:00+07:00')), b[1]);

// Estimasi pecahan (0,5 jam = 30 menit).
const c = svc.reminderSchedule(new Date('2026-11-20T18:00:00+07:00'), 0.5);
ok('jadwal: estimasi 0,5 jam -> 17:30', iso(c[1].at) === iso(new Date('2026-11-20T17:30:00+07:00')), c[1]);

// Estimasi 24 jam bertabrakan dengan H-1 -> hanya satu pengingat.
const d = svc.reminderSchedule(new Date('2026-11-20T18:00:00+07:00'), 24);
ok('jadwal: estimasi 24 jam tidak menduplikasi H-1', d.length === 1, d);

// Estimasi tidak valid / nol -> tetap ada H-1.
ok('jadwal: estimasi 0 hanya H-1', svc.reminderSchedule(new Date('2026-11-20T18:00:00+07:00'), 0).length === 1);
ok('jadwal: deadline invalid -> kosong', svc.reminderSchedule('bukan-tanggal', 2).length === 0);

// ===== Pengingat ketiga: waktu rencana mulai =====
// Contoh dari spesifikasi: rencana mulai 13 Nov 2026 13:30.
const withStart = svc.reminderSchedule(
  new Date('2026-11-20T18:00:00+07:00'),
  4,
  new Date('2026-11-13T13:30:00+07:00'),
);
ok('mulai: total tiga pengingat', withStart.length === 3, withStart.map((e) => e.kind));
const startEvt = withStart.find((e) => e.kind === 'start');
ok('mulai: dikirim tepat pada waktu rencana mulai',
  !!startEvt && iso(startEvt.at) === iso(new Date('2026-11-13T13:30:00+07:00')), startEvt);
ok('mulai: urutan jadwal naik (paling awal dulu)',
  withStart.every((e, i) => i === 0 || withStart[i - 1].at <= e.at), withStart.map((e) => iso(e.at)));
ok('mulai: jadwal H-1 dan H-N jam tetap ada',
  withStart.some((e) => e.kind === 'deadline-1d') && withStart.some((e) => e.kind === 'deadline-hours'),
  withStart.map((e) => e.kind));

// Tanpa rencana mulai -> tetap dua pengingat (tidak ada email 'start').
ok('mulai: tanpa rencana mulai tidak menambah email',
  svc.reminderSchedule(new Date('2026-11-20T18:00:00+07:00'), 4, null).length === 2);

// Rencana mulai yang sama persis dengan jadwal lain tidak boleh menduplikasi email.
const dup = svc.reminderSchedule(
  new Date('2026-11-20T18:00:00+07:00'),
  4,
  new Date('2026-11-20T14:00:00+07:00'),
);
ok('mulai: jadwal kembar tidak menghasilkan dua email', dup.length === 2, dup.map((e) => e.kind));

// Rencana mulai tidak valid diabaikan, bukan merusak jadwal lain.
ok('mulai: tanggal mulai invalid diabaikan',
  svc.reminderSchedule(new Date('2026-11-20T18:00:00+07:00'), 4, 'bukan-tanggal').length === 2);

console.log('\n===== JADWAL: ' + pass + ' pass, ' + fail + ' fail =====');
process.exit(fail ? 1 : 0);
