import "./globals.css";
import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import { BackgroundAudioPlayer } from "@/components/audio/BackgroundAudioPlayer";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NeedPipsForPorsche — XAU/USD Trading Intelligence",
  description: "Personal Real-time Trade Analysis & Discipline Hub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${sora.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased font-sans">
        {children}
        <BackgroundAudioPlayer />
      </body>
    </html>
  );
}

