import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IconSprite } from "@/components/IconSprite";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Qvea — голосования для класса",
  description:
    "Комнаты голосований с входом по коду или QR: несколько голосований в одной комнате, живой подсчёт голосов и анонимный или именной режим.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Onest:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
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
