import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aristótel.IA",
  description: "Painel da sua evolução 1%",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
