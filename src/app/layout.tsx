import type { Metadata } from "next";
import "./globals.css";
import "./study.css";
import ThemeToggle from "./theme-toggle";
export const metadata: Metadata = { title: "StudyFlow", description: "Atur tugas akademik, prioritas, dan tenggat dalam satu ruang belajar." };

/* Dijalankan sebelum paint supaya tema tersimpan tidak berkedip (FOUC). */
const themeBootstrap = `(function(){try{var t=localStorage.getItem('studyflow-theme');if(t==='dark'){var r=document.documentElement;r.setAttribute('data-theme','dark');r.style.colorScheme='dark';}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
