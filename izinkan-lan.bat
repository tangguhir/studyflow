@echo off
REM ===================================================================
REM  StudyFlow - izinkan akses dari laptop lain di Wi-Fi yang sama
REM  Jalankan file ini dengan KLIK KANAN > "Run as administrator".
REM  Cukup sekali saja; aturannya permanen sampai dihapus.
REM ===================================================================
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo [!] File ini harus dijalankan sebagai Administrator.
  echo     Klik kanan file ini lalu pilih "Run as administrator".
  pause
  exit /b 1
)

echo [1/3] Membuka port 3000 (web StudyFlow)...
netsh advfirewall firewall delete rule name="StudyFlow Web 3000" >nul 2>&1
netsh advfirewall firewall add rule name="StudyFlow Web 3000" dir=in action=allow protocol=TCP localport=3000 profile=any

echo [2/3] Membuka port 4000 (API StudyFlow)...
netsh advfirewall firewall delete rule name="StudyFlow API 4000" >nul 2>&1
netsh advfirewall firewall add rule name="StudyFlow API 4000" dir=in action=allow protocol=TCP localport=4000 profile=any

echo [3/3] Selesai. Alamat akses dari laptop lain:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo     http://%%b:3000/studyflow/login
)
echo.
echo Catatan: laptop lain harus tersambung ke Wi-Fi yang sama.
pause
