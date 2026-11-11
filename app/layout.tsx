import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Onest } from "next/font/google";
import "./globals.css";
import { IconSprite } from "@/components/IconSprite";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Шрифты собираются вместе с проектом и раздаются с нашего домена: браузер не
 * ждёт ответа сторонних CDN (Google Fonts из России часто отвечает медленно
 * или не отвечает вовсе) и не делает лишних DNS/TLS-соединений.
 */
const sans = Onest({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-onest",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-jetbrains",
  fallback: ["ui-monospace", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: "Qvea — голосования для класса",
  description:
    "Комнаты голосований с входом по коду или QR: несколько голосований в одной комнате, живой подсчёт голосов и анонимный или именной режим.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#131C28",
};

const THEME_SCRIPT = `
(function () {
  var t;
  try { t = localStorage.getItem('ds-theme'); } catch (e) {}
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <IconSprite />
        <div className="app">
          <SiteHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
