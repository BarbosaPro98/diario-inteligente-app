import type { Metadata, Viewport } from "next";
import { Caveat, Dancing_Script, Inter, JetBrains_Mono, Merriweather, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const merriweather = Merriweather({ variable: "--font-merriweather", subsets: ["latin"], weight: ["400", "700"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });
const dancing = Dancing_Script({ variable: "--font-dancing", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Diário Seguro",
  description: "Diário pessoal e estratégico com criptografia local",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Diário", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1115",
};

// Aplica tema e fonte antes da primeira pintura para evitar "flash".
const bootScript = `try{var s=JSON.parse(localStorage.getItem('diario-settings')||'{}');document.documentElement.dataset.theme=s.theme||'dark';document.documentElement.dataset.font=s.font||'inter'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [inter, merriweather, playfair, caveat, dancing, jetbrains].map((f) => f.variable).join(" ");
  return (
    <html lang="pt-BR" data-theme="dark" data-font="inter" className={`${fonts} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
