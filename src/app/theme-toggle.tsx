"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "studyflow-theme";

/**
 * Tombol tema global. Ikon ditentukan CSS lewat atribut `data-theme` pada <html>
 * (bukan state React) supaya markup server & client identik — tidak ada hydration
 * mismatch dan tidak ada kedipan ikon saat halaman dimuat.
 */

export default function ThemeToggle() {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;
    const sync = () => {
      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      btn.setAttribute("aria-label", dark ? "Beralih ke mode terang" : "Beralih ke mode gelap");
      btn.setAttribute("title", dark ? "Mode terang" : "Mode gelap");
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    if (next === "dark") {
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      root.removeAttribute("data-theme");
      root.style.colorScheme = "light";
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* mode privat: preferensi tidak tersimpan, tema tetap berlaku untuk sesi ini */
    }
  }

  /* Ikon dipilih lewat CSS (`html[data-theme="dark"]`) agar markup SSR = client. */
  return (
    <button ref={ref} type="button" className="theme-toggle" onClick={toggle} aria-label="Beralih ke mode gelap" title="Mode gelap">
      <svg className="i-moon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M20.6 14.4A8.6 8.6 0 1 1 9.6 3.4a7 7 0 0 0 11 11Z" />
      </svg>
      <svg className="i-sun" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4.1" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.6 12H2.4M21.6 12h-2.2M6.5 6.5 4.9 4.9M19.1 19.1l-1.6-1.6M17.5 6.5l1.6-1.6M4.9 19.1l1.6-1.6" />
      </svg>
    </button>
  );
}
