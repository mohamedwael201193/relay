import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { RelayProviders } from "@/components/relay/providers/RelayProviders";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["italic", "normal"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "RELAY — Your runner trades. You live.",
  description:
    "RELAY is the self-driving runner for DreamDEX event contracts. Deploy once with a bounded budget — it races every market window, builds verified streaks, and never asks you to click claim.",
  keywords: [
    "RELAY",
    "DreamDEX",
    "Somnia",
    "event contracts",
    "trading runner",
    "prediction markets",
    "streaks",
  ],
  authors: [{ name: "RELAY" }],
  openGraph: {
    title: "RELAY — Your runner trades. You live.",
    description:
      "Deploy a budget-bounded trading runner. Every window is a lap. Streaks are real, verified, and run themselves.",
    siteName: "RELAY",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#14110a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${archivo.variable} ${instrument.variable} ${plexMono.variable} antialiased bg-background text-foreground`}
      >
        <RelayProviders>
          {children}
          <Toaster />
        </RelayProviders>
      </body>
    </html>
  );
}
