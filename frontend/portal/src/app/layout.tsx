import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tıbbi Danışmanlık Platformu",
  description: "İkinci görüş ve tıbbi danışmanlık portalı",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={inter.variable}>
      <head>
        {/* Basecoat standalone — PostCSS/Tailwind derlemesine bağlı değil */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/basecoat.css" />
      </head>
      <body
        className={`${inter.className} min-h-svh bg-background text-foreground antialiased font-medium`}
      >
        {children}
      </body>
    </html>
  );
}
