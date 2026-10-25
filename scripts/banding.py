#!/usr/bin/env python3
"""Bandingkan respons API Laravel (studyflowphp) dengan versi Node (StudyFlow).

Kedua aplikasi memakai database MySQL yang sama, jadi akun dibuat sekali di sisi
Node lalu dipakai login di kedua sisi. Setiap sisi membuat tugasnya sendiri agar
id tidak bertabrakan; yang dibandingkan adalah status HTTP dan bentuk JSON-nya.

Pakai: python scripts/banding.py [--node URL] [--laravel URL]
"""
from __future__ import annotations

import argparse
import json
import subprocess
import time
from typing import Any

pairs: list[tuple[str, str, str, bool]] = []
NODE = ""      # API Node (NestJS), mis. http://127.0.0.1:4000
NODEWEB = ""   # Web Node (Next.js), mis. http://127.0.0.1:3000/studyflow
LAR = ""       # Laravel, mis. http://127.0.0.1:8200/studyflow


def curl(url: str, jar: str | None = None, method: str = "GET", body: Any = None):
    cmd = ["curl", "-s", "-w", "\n%{http_code}", url]
    if method != "GET":
        cmd += ["-X", method]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    if jar:
        cmd += ["-b", jar, "-c", jar]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    payload, code = out.rsplit("\n", 1)
    try:
        return code, json.loads(payload)
    except json.JSONDecodeError:
        return code, payload


def shape(v: Any) -> Any:
    if isinstance(v, dict):
        return {k: shape(x) for k, x in sorted(v.items())}
    if isinstance(v, list):
        return [shape(v[0])] if v else []
    return type(v).__name__


def cmp(label, path, method="GET", body=None, jn=None, jl=None):
    """Bandingkan satu jalur yang sama di kedua sisi."""
    cn, rn = curl(NODE + path, jn, method, body)
    cl, rl = curl(LAR + path, jl, method, body)
    sn, sl = shape(rn), shape(rl)
    same = cn == cl and sn == sl
    pairs.append((label, cn, cl, same))
    print(("OK   " if same else "BEDA ") + f"{label:36} node={cn} lar={cl}")
    if not same:
        print("   node:", json.dumps(sn)[:300])
        print("   lar :", json.dumps(sl)[:300])
    return rn, rl


def both(label, pn, pl, method="GET", body_n=None, body_l=None, jn=None, jl=None):
    """Bandingkan jalur berbeda (id tiap sisi) dengan payload berbeda."""
    cn, rn = curl(NODE + pn, jn, method, body_n)
    cl, rl = curl(LAR + pl, jl, method, body_l)
    sn, sl = shape(rn), shape(rl)
    same = cn == cl and sn == sl
    pairs.append((label, cn, cl, same))
    print(("OK   " if same else "BEDA ") + f"{label:36} node={cn} lar={cl}")
    if not same:
        print("   node:", json.dumps(sn)[:300])
        print("   lar :", json.dumps(sl)[:300])
    return rn, rl


def main() -> int:
    global NODE, NODEWEB, LAR
    ap = argparse.ArgumentParser()
    ap.add_argument("--node", default="http://127.0.0.1:4000")
    ap.add_argument("--node-web", default="http://127.0.0.1:3000/studyflow")
    ap.add_argument("--laravel", default="http://127.0.0.1:8200/studyflow")
    a = ap.parse_args()
    NODE = a.node.rstrip("/")
    NODEWEB = a.node_web.rstrip("/")
    LAR = a.laravel.rstrip("/")

    email = f"banding{int(time.time())}@studyflow.test"
    cred = {"email": email, "password": "rahasia123", "name": "Banding"}
    jn, jl = ".banding-node.txt", ".banding-lar.txt"

    # Akun dibuat sekali (database sama), lalu login di kedua sisi.
    curl(NODE + "/api/auth/register", jn, "POST", cred)
    curl(LAR + "/api/auth/login", jl, "POST", cred)

    print("== publik & sesi ==")
    cmp("GET /api/health", "/api/health")
    cmp("GET /api/tasks tanpa sesi", "/api/tasks")
    cmp("GET /api/auth/me", "/api/auth/me", jn=jn, jl=jl)
    cmp("POST login salah", "/api/auth/login", "POST", {"email": email, "password": "salahsekali"})
    cmp("POST login sandi pendek", "/api/auth/login", "POST", {"email": email, "password": "salah"})
    cmp("POST register email sama", "/api/auth/register", "POST", cred)
    cmp("POST register kosong", "/api/auth/register", "POST", {})

    print("== tugas ==")
    task = {
        "name": "Tugas Banding",
        "course": "MK",
        "weight": 25,
        "difficulty": 3,
        "hours": 4,
        "deadline": "2026-12-02T17:00:00.000Z",
        "startAt": "2026-11-30T10:00:00.000Z",
    }
    # Tugas dibuat per sisi dan id-nya diambil dari respons POST masing-masing:
    # daftar tugas berisi tugas dari kedua sisi (database sama), jadi mencari
    # lewat nama saja bisa salah ambil id milik sisi lain.
    cn, tn_post = curl(NODE + "/api/tasks", jn, "POST", task)
    cl, tl_post = curl(LAR + "/api/tasks", jl, "POST", task)
    same = cn == cl and shape(tn_post) == shape(tl_post)
    pairs.append(("POST /api/tasks", cn, cl, same))
    print(("OK   " if same else "BEDA ") + f"{'POST /api/tasks':36} node={cn} lar={cl}")
    if not same:
        print("   node:", json.dumps(shape(tn_post))[:300])
        print("   lar :", json.dumps(shape(tl_post))[:300])
    idn, idl = tn_post["id"], tl_post["id"]

    cmp("POST /api/tasks tanpa nama", "/api/tasks", "POST", {"course": "x"}, jn=jn, jl=jl)
    cmp("POST /api/tasks tenggat lampau", "/api/tasks", "POST",
        dict(task, deadline="2020-01-01T00:00:00.000Z"), jn=jn, jl=jl)
    cmp("GET /api/tasks", "/api/tasks", jn=jn, jl=jl)

    both("PATCH /api/tasks/{id}", f"/api/tasks/{idn}", f"/api/tasks/{idl}",
         "PATCH", {"name": "Revisi", "weight": 30}, {"name": "Revisi", "weight": 30}, jn, jl)
    both("PATCH complete", f"/api/tasks/{idn}/complete", f"/api/tasks/{idl}/complete",
         "PATCH", {"done": True}, {"done": True}, jn, jl)
    both("PATCH reminder", f"/api/tasks/{idn}/reminder", f"/api/tasks/{idl}/reminder",
         "PATCH", {"enabled": False}, {"enabled": False}, jn, jl)
    cmp("PATCH tugas tak ada", "/api/tasks/tidakada", "PATCH", {"name": "x"}, jn=jn, jl=jl)

    print("== sub-tugas ==")
    cn, sn = curl(NODE + f"/api/tasks/{idn}/subtasks", jn, "POST", {"name": "Sub satu"})
    cl, sl = curl(LAR + f"/api/tasks/{idl}/subtasks", jl, "POST", {"name": "Sub satu"})
    same = cn == cl and shape(sn) == shape(sl)
    pairs.append(("POST subtasks", cn, cl, same))
    print(("OK   " if same else "BEDA ") + f"{'POST subtasks':36} node={cn} lar={cl}")
    if not same:
        print("   node:", json.dumps(shape(sn))[:300])
        print("   lar :", json.dumps(shape(sl))[:300])
    sidn, sidl = sn["id"], sl["id"]
    both("POST subtasks nama kosong", f"/api/tasks/{idn}/subtasks", f"/api/tasks/{idl}/subtasks",
         "POST", {"name": "  "}, {"name": "  "}, jn, jl)
    both("PATCH subtasks/{sid}", f"/api/tasks/{idn}/subtasks/{sidn}", f"/api/tasks/{idl}/subtasks/{sidl}",
         "PATCH", {"done": True}, {"done": True}, jn, jl)
    both("PATCH reorder", f"/api/tasks/{idn}/subtasks/reorder", f"/api/tasks/{idl}/subtasks/reorder",
         "PATCH", {"ids": [sidn]}, {"ids": [sidl]}, jn, jl)
    both("PATCH reorder salah", f"/api/tasks/{idn}/subtasks/reorder", f"/api/tasks/{idl}/subtasks/reorder",
         "PATCH", {"ids": ["x"]}, {"ids": ["x"]}, jn, jl)
    both("DELETE subtasks/{sid}", f"/api/tasks/{idn}/subtasks/{sidn}", f"/api/tasks/{idl}/subtasks/{sidl}",
         "DELETE", None, None, jn, jl)

    print("== notifikasi ==")
    cmp("GET notifications/status", "/api/notifications/status", jn=jn, jl=jl)
    cmp("GET notifications/schedule", "/api/notifications/schedule", jn=jn, jl=jl)
    cmp("POST notifications/test", "/api/notifications/test", "POST", None, jn=jn, jl=jl)
    both("POST notifications/remind", "/api/notifications/remind", "/api/notifications/remind",
         "POST", {"taskId": idn}, {"taskId": idl}, jn, jl)
    cmp("POST notifications/remind kosong", "/api/notifications/remind", "POST", {}, jn=jn, jl=jl)

    print("== hapus & keluar ==")
    cmp("GET api tak ada", "/api/tidak-ada", jn=jn, jl=jl)
    both("DELETE tasks/{id}", f"/api/tasks/{idn}", f"/api/tasks/{idl}", "DELETE", None, None, jn, jl)
    both("DELETE tasks/{id} lagi", f"/api/tasks/{idn}", f"/api/tasks/{idl}", "DELETE", None, None, jn, jl)
    cmp("POST logout", "/api/auth/logout", "POST", None, jn=jn, jl=jl)

    print("== halaman ==")
    for p in ("/login", "/daftar", "/dashboard", "/tugas", "/kalender", "/produktivitas", "/", "/tidak-ada"):
        cn, _ = curl(NODEWEB + p)
        cl, _ = curl(LAR + p)
        ok = cn == cl
        pairs.append((f"GET {p}", cn, cl, ok))
        print(("OK   " if ok else "BEDA ") + f"GET {p:36} node={cn} lar={cl}")

    okn = sum(1 for p in pairs if p[3])
    bad = len(pairs) - okn
    print(f"\nRINGKASAN: {okn} sama, {bad} beda")
    for label, cn, cl, same in pairs:
        if not same:
            print(f"  - {label}: node={cn} laravel={cl}")
    subprocess.run(["rm", "-f", jn, jl])
    return 0 if bad == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
