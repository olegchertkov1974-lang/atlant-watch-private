import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://atlant-park-alert.olegchertkov1974.chatgpt.site"),
  title: "Атлант-Парк — мониторинг оповещений",
  description: "Локальная карта и Telegram-оповещения для территории Атлант-Парк в Обухово.",
  openGraph: {
    title: "АТЛАНТ / WATCH",
    description: "Мониторинг БПЛА вокруг Атлант‑Парка",
    type: "website",
    images: [{ url: "/og.png", width: 1729, height: 910, alt: "АТЛАНТ / WATCH — мониторинг БПЛА вокруг Атлант‑Парка" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "АТЛАНТ / WATCH",
    description: "Мониторинг БПЛА вокруг Атлант‑Парка",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
