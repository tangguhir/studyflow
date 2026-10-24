@echo off
REM ===================================================================
REM  StudyFlow - jalankan aplikasi (API + web) agar bisa dibuka dari
REM  laptop lain di Wi-Fi yang sama.
REM  Pakai: klik dua kali file ini.
REM ===================================================================
cd /d "%~dp0"

echo [1/3] Memastikan PM2 tersedia...
if not exist node_modules\next (
  echo [!] Dependensi belum terpasang. Jalankan: npm install
  pause
  exit /b 1
)

echo [2/3] Build ulang aplikasi...
call npm run build
if errorlevel 1 (
  echo [!] Build gagal. Periksa pesan di atas.
  pause
  exit /b 1
)

echo [3/3] Menjalankan API + web (bind ke semua jaringan)...
call npx pm2 delete studyflow-web >nul 2>&1
call npx pm2 start ecosystem.config.js --update-env
call npx pm2 save >nul 2>&1

echo.
echo ============================================================
echo  StudyFlow berjalan. Buka dari laptop lain di Wi-Fi yang sama:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo     http://%%b:3000/studyflow/login
)
echo.
echo  Di laptop ini:  http://localhost:3000/studyflow/login
echo  Jika laptop lain tidak bisa membuka: jalankan izinkan-lan.bat
echo  sebagai Administrator (sekali saja) untuk membuka port 3000.
echo ============================================================
echo.
pause
