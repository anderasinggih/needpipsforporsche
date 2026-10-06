import "./globals.css";
import type { Metadata } from "next";
import { BackgroundAudioPlayer } from "@/components/audio/BackgroundAudioPlayer";
import { FloatingBottomDock } from "@/components/ui/FloatingBottomDock";

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
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 antialiased pb-20 sm:pb-24">
        {children}
        <BackgroundAudioPlayer />
        <FloatingBottomDock />
      </body>
    </html>
  );
}
