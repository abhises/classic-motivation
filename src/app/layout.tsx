import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shorts Studio",
  description: "Generate short vertical videos and post them to YouTube, Instagram and TikTok",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
          <header className="flex items-center justify-between gap-4 border-b border-white/5 p-4 md:w-56 md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-r">
            <div className="flex items-center gap-2 px-1 md:mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-amber-400 text-sm font-black text-black">▶</div>
              <div>
                <div className="text-sm font-semibold text-white">Shorts Studio</div>
                <div className="text-[11px] text-zinc-500">generate · post · repeat</div>
              </div>
            </div>
            <Nav />
          </header>
          <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
