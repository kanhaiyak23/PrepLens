import type { Metadata } from "next";
import { EB_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

// Design source: Rishihood University brand (ADR-29): EB Garamond for display headings, Montserrat for the interface.
const display = EB_Garamond({ subsets: ["latin"], variable: "--font-garamond", display: "swap", weight: ["500", "600", "700"], style: ["normal", "italic"] });
const sans = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: "PrepLens · Interview experiences from NST seniors",
  description: "Read what each placement interview round really asks, written by Newton School of Technology seniors at Rishihood University.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <head>
        {/* Material Symbols for every icon. display=block: an icon is never shown as its ligature name while the font loads. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display -- an icon font must block, never swap */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" />
      </head>
      <body>{children}</body>
    </html>
  );
}
