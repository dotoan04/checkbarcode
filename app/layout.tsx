import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

// Reuse Manrope as the display family (tight tracking handled in CSS).
const display = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["700", "800"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Barcode Risk Checker",
  description:
    "Assess the reuse / conflict risk of GTIN/EAN/UPC barcodes before listing products.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${display.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
