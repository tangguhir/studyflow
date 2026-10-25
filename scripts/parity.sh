#!/usr/bin/env bash
# Uji paritas API StudyFlow (Laravel) terhadap kontrak versi Node.
# Pakai: bash scripts/parity.sh [base_url]
set -u

B="${1:-http://127.0.0.1:8200/studyflow}"
J="./.parity-jar.txt"
rm -f "$J"
ok=0; fail=0

chk() { # chk <label> <expected> <actual>
  if [ "$2" = "$3" ]; then ok=$((ok+1)); printf '  OK   %-42s %s\n' "$1" "$3"
  else fail=$((fail+1)); printf '  FAIL %-42s expected=%s got=%s\n' "$1" "$2" "$3"; fi
}

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
jget() { python -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1],{'d':d}))" "$1" 2>/dev/null || echo "__err__"; }

echo "== Publik =="
chk "GET /api/health" 200 "$(code "$B/api/health")"
chk "GET /api/tasks tanpa sesi" 401 "$(code "$B/api/tasks")"
chk "GET /api/auth/me tanpa sesi" 401 "$(code "$B/api/auth/me")"
chk "GET /api/tidak-ada" 404 "$(code "$B/api/tidak-ada")"
chk "POST /api/auth/login salah" 401 "$(code -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"salahsekali"}')"
chk "POST /api/auth/login sandi pendek" 400 "$(code -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"salah"}')"
chk "POST /api/auth/register kosong" 400 "$(code -X POST "$B/api/auth/register" -H 'Content-Type: application/json' -d '{}')"

E="parity$(date +%s)$RANDOM@studyflow.test"
echo "== Akun baru: $E =="
chk "POST /api/auth/register" 201 "$(code -c "$J" -X POST "$B/api/auth/register" -H 'Content-Type: application/json' -d "{\"email\":\"$E\",\"password\":\"rahasia123\",\"name\":\"Uji Paritas\"}")"
chk "POST /api/auth/register email sama" 409 "$(code -X POST "$B/api/auth/register" -H 'Content-Type: application/json' -d "{\"email\":\"$E\",\"password\":\"rahasia123\",\"name\":\"Uji\"}")"
chk "GET /api/auth/me" 200 "$(code -b "$J" "$B/api/auth/me")"
chk "GET /api/tasks kosong" 200 "$(code -b "$J" "$B/api/tasks")"

echo "== Tugas =="
TID=$(curl -s -b "$J" -X POST "$B/api/tasks" -H 'Content-Type: application/json' \
  -d '{"name":"Makalah Filsafat","course":"Filsafat Ilmu","weight":25,"difficulty":3,"hours":4,"deadline":"2026-12-02T17:00:00.000Z"}' | jget "d['id']")
if [ "$TID" = "__err__" ] || [ -z "$TID" ]; then echo "  FAIL buat tugas"; fail=$((fail+1)); else ok=$((ok+1)); echo "  OK   buat tugas -> $TID"; fi
chk "POST /api/tasks tanpa nama" 400 "$(code -b "$J" -X POST "$B/api/tasks" -H 'Content-Type: application/json' -d '{"course":"x","weight":10,"difficulty":2,"hours":1,"deadline":"2026-12-02T17:00:00.000Z"}')"
chk "PATCH /api/tasks/{id}" 200 "$(code -b "$J" -X PATCH "$B/api/tasks/$TID" -H 'Content-Type: application/json' -d '{"name":"Makalah Filsafat (revisi)"}')"
chk "PATCH /api/tasks/{id}/reminder" 200 "$(code -b "$J" -X PATCH "$B/api/tasks/$TID/reminder" -H 'Content-Type: application/json' -d '{"enabled":false}')"
chk "PATCH /api/tasks/{id}/complete" 200 "$(code -b "$J" -X PATCH "$B/api/tasks/$TID/complete" -H 'Content-Type: application/json' -d '{"done":true}')"
chk "PATCH tugas tak ada" 404 "$(code -b "$J" -X PATCH "$B/api/tasks/tidakada" -H 'Content-Type: application/json' -d '{"name":"x"}')"

echo "== Sub-tugas =="
SID=$(curl -s -b "$J" -X POST "$B/api/tasks/$TID/subtasks" -H 'Content-Type: application/json' -d '{"name":"Cari referensi"}' | jget "d['id']")
if [ "$SID" = "__err__" ] || [ -z "$SID" ]; then echo "  FAIL buat subtask"; fail=$((fail+1)); else ok=$((ok+1)); echo "  OK   buat subtask -> $SID"; fi
chk "PATCH /subtasks/{sid}" 200 "$(code -b "$J" -X PATCH "$B/api/tasks/$TID/subtasks/$SID" -H 'Content-Type: application/json' -d '{"done":true}')"
chk "PATCH /subtasks/reorder" 200 "$(code -b "$J" -X PATCH "$B/api/tasks/$TID/subtasks/reorder" -H 'Content-Type: application/json' -d "{\"ids\":[\"$SID\"]}")"
chk "DELETE /subtasks/{sid}" 200 "$(code -b "$J" -X DELETE "$B/api/tasks/$TID/subtasks/$SID")"

echo "== Notifikasi =="
chk "GET /api/notifications/status" 200 "$(code -b "$J" "$B/api/notifications/status")"
chk "GET /api/notifications/schedule" 200 "$(code -b "$J" "$B/api/notifications/schedule")"
chk "POST /api/notifications/test (email belum diset)" 400 "$(code -b "$J" -X POST "$B/api/notifications/test")"

echo "== Hapus & keluar =="
chk "DELETE /api/tasks/{id}" 200 "$(code -b "$J" -X DELETE "$B/api/tasks/$TID")"
chk "POST /api/auth/logout" 200 "$(code -b "$J" -X POST "$B/api/auth/logout")"

echo "== Halaman =="
for p in login daftar dashboard tugas kalender produktivitas; do
  chk "GET /$p" 200 "$(code "$B/$p")"
done
chk "GET / (akar)" 302 "$(code "$B/")"
chk "GET /halaman-tidak-ada" 404 "$(code "$B/halaman-tidak-ada")"

echo
echo "RINGKASAN: $ok lolos, $fail gagal"
rm -f "$J"
[ "$fail" -eq 0 ]
