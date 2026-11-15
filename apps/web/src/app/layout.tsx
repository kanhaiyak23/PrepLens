import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

// Design source: Stitch design system, fontFamily headline/body/label = "Public Sans".
const font = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });

export const metadata: Metadata = {
  title: "PrepLens: interview experiences from NST seniors",
  description: "Read what each interview round really asks, written by NST seniors who sat in it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <head>
        {/* Design source: Stitch screens load Material Symbols Outlined for every icon. Root layout, so it loads on every page. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
