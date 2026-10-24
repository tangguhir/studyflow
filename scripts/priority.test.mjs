/* Unit test logika prioritas frontend (src/app/task-priority.ts).
   Kompilasi dulu: npx tsc src/app/task-priority.ts --outDir .tmp-priority --module esnext --target es2020 --skipLibCheck
   Jalankan: node scripts/priority.test.mjs */
import { compareTasksByPriority, sortTasksByPriority, filterTasksBySearch } from '../.tmp-priority/task-priority.js';

let pass = 0; const fails = [];
const ok = (n, c, x) => { if (c) { pass++; console.log('PASS  ' + n); } else { fails.push(n + (x ? ' :: ' + JSON.stringify(x) : '')); console.log('FAIL  ' + n + (x ? ' :: ' + JSON.stringify(x) : '')); } };

const DL = new Date('2026-11-01T09:00:00.000Z').toISOString();
const t = (id, o = {}) => ({ id, name: 'Tugas ' + id, course: 'Matkul', deadline: DL, weight: 20, difficulty: 2, hours: 3, completedAt: null, ...o });

// 1. tugas selesai selalu di bawah
let arr = [t('a', { completedAt: new Date().toISOString() }), t('b'), t('c', { completedAt: new Date().toISOString() }), t('d')];
let sorted = sortTasksByPriority(arr).map((x) => x.id);
ok('selesai selalu paling bawah', sorted.indexOf('b') < sorted.indexOf('a') && sorted.indexOf('d') < sorted.indexOf('c'), sorted);

// 2. deadline lebih awal didahulukan
arr = [t('late', { deadline: new Date('2026-12-01T00:00:00.000Z').toISOString() }), t('early', { deadline: new Date('2026-10-30T00:00:00.000Z').toISOString() })];
ok('deadline lebih awal didahulukan', sortTasksByPriority(arr)[0].id === 'early');

// 3. deadline sama → jam lebih singkat didahulukan
arr = [t('long', { hours: 9 }), t('short', { hours: 2 })];
ok('jam lebih singkat didahulukan', sortTasksByPriority(arr)[0].id === 'short');

// 4. jam sama → kesulitan lebih rendah didahulukan
arr = [t('hard', { difficulty: 3 }), t('easy', { difficulty: 1 })];
ok('kesulitan lebih rendah didahulukan', sortTasksByPriority(arr)[0].id === 'easy');

// 5. semua sama → id leksikografis
arr = [t('zzz'), t('aaa')];
ok('tie-breaker id leksikografis', sortTasksByPriority(arr)[0].id === 'aaa');

// 6. deadline invalid dianggap paling akhir (tidak merusak urutan)
arr = [t('bad', { deadline: 'bukan-tanggal' }), t('good')];
ok('deadline invalid ditaruh paling akhir', sortTasksByPriority(arr)[0].id === 'good');

// 7. label/peringkat stabil antara daftar penuh dan hasil pencarian
const all = sortTasksByPriority([t('x1'), t('x2', { hours: 1 }), t('x3', { completedAt: new Date().toISOString() }), t('y1', { course: 'Fisika' })]);
const rankOf = new Map(all.map((x, i) => [x.id, i + 1]));
const searched = sortTasksByPriority(filterTasksBySearch(all, 'fisika'));
ok('label stabil: hasil search memakai peringkat global', searched.every((x) => rankOf.get(x.id) === all.findIndex((a) => a.id === x.id) + 1), searched.map((x) => [x.id, rankOf.get(x.id)]));
ok('label stabil: filter tidak mengubah peringkat relatif', searched.map((x) => x.id).join() === all.filter((x) => x.course === 'Fisika').map((x) => x.id).join());

// 8. input tidak dimutasi
const before = [t('p1'), t('p2', { hours: 1 })];
const snapshot = JSON.stringify(before);
sortTasksByPriority(before);
ok('sort tidak memutasi array asli', JSON.stringify(before) === snapshot);

// 9. komparator antisimetris
const a = t('a1'), b = t('b1', { hours: 1 });
ok('komparator antisimetris', compareTasksByPriority(a, b) === -compareTasksByPriority(b, a));

console.log('\n===== PRIORITAS: ' + pass + ' pass, ' + fails.length + ' fail =====');
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
