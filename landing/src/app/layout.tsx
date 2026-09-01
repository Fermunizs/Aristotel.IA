import type { Metadata } from "next";
import { Fraunces, Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-fraunces" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });

const SITE = "https://aristotelia.vercel.app"; // ajustar quando o domínio final entrar

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Aristótel.IA — agente de evolução 1%",
  description:
    "Uma treinadora pessoal no Telegram para quem sabe o que estudar mas não consegue fazer todo dia.",
  icons: { icon: "/aristotelia-180.jpg" },
  openGraph: {
    title: "Aristótel.IA — agente de evolução 1%",
    description: "Diz o que quer aprender. A trilha nasce na hora, e ela te cobra amanhã.",
    images: ["/aristotelia.jpg"],
    locale: "pt_BR",
    type: "website",
  },
};

// Aplica o tema salvo antes da pintura — evita flash.
const THEME_INIT = `try{var t=localStorage.getItem('arist-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${inter.variable} ${spaceMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
