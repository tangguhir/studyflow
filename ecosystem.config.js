// Menjalankan StudyFlow (API + web) di bawah PM2.
// PM2 menjaga proses tetap hidup, me-restart otomatis bila crash, dan
// menyalakannya lagi setelah reboot — jadi koneksi tidak putus mendadak.
// Pakai: npx pm2 start ecosystem.config.js && npx pm2 save
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'studyflow-api',
      cwd: path.join(__dirname, 'apps/api'),
      script: 'dist/apps/api/src/main.js',
      // Bangun ulang lebih dulu agar yang dijalankan selalu kode terbaru.
      interpreter: 'node',
      autorestart: true,
      max_restarts: 100,
      min_uptime: '10s',
      restart_delay: 1500,
      exp_backoff_restart_delay: 200,
      watch: false,
      max_memory_restart: '450M',
      env: { NODE_ENV: 'production', PORT: '4000' },
      out_file: path.join(__dirname, 'logs/api.out.log'),
      error_file: path.join(__dirname, 'logs/api.err.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'studyflow-web',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 0.0.0.0',
      autorestart: true,
      max_restarts: 100,
      min_uptime: '10s',
      restart_delay: 1500,
      watch: false,
      max_memory_restart: '600M',
      env: { NODE_ENV: 'production' },
      out_file: path.join(__dirname, 'logs/web.out.log'),
      error_file: path.join(__dirname, 'logs/web.err.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
