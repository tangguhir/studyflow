import type { Metadata } from "next";
import "./globals.css";
import "./study.css";
export const metadata: Metadata = { title: "StudyFlow", description: "Atur tugas akademik, prioritas, dan tenggat dalam satu ruang belajar." };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
