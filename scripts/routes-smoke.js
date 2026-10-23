const base = process.env.WEB_URL || 'http://localhost:3000';
const routes = ['/login', '/dashboard', '/daftar', '/tugas', '/kalender', '/produktivitas'];
(async () => {
  let failed = false;
  for (const route of routes) {
    const response = await fetch(base + route, { redirect: 'manual' });
    if (response.status !== 200) {
      failed = true;
      console.error('FAIL', route, response.status);
    } else {
      console.log('PASS', route, response.status);
    }
  }
  if (failed) process.exit(1);
})().catch(error => { console.error('FAIL', error.message); process.exit(1); });
