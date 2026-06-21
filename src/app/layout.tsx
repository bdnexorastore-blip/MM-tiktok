import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PWAContext from "@/components/PWAContext";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "MM TIKTOK | Premium TikTok & Facebook Video Downloader",
  description: "Fast, clean, and user-friendly TikTok and Facebook video downloader. Download videos without watermark for free in HD quality and get MP3 audio instantly.",
  keywords: [
    "tiktok download", "mm tiktok", "watermark tiktok", "tiktok video downloader",
    "download tiktok videos without watermark", "tiktok downloader hd", "tiktok to mp4",
    "save tiktok video", "tiktok mp3 download", "facebook video downloader",
    "fb video download", "download facebook reels", "fb reels downloader",
    "facebook downloader hd", "save facebook videos", "download fb private video",
    "tiktok no watermark", "snaptik alternative", "ssstik alternative",
    "tiktok video saver", "tiktok downloader online", "free tiktok downloader",
    "tiktok download pc", "tiktok download mobile", "facebook video saver",
    "fb to mp4", "facebook reel download online", "best facebook downloader",
    "mm tiktok downloader", "download tiktok link", "tiktok audio downloader",
    "tiktok sound download", "fb video downloader hd", "facebook video download free",
    "tiktok download without watermark 1080p", "tiktok video converter", "fb reel saver",
    "download facebook video link", "tiktok video format", "fast tiktok downloader",
    "tiktok short video download", "facebook story saver", "fb video hd download",
    "tiktok premium downloader", "watermark remover tiktok", "tiktok video offline",
    "facebook to mp3", "fb downloader online", "tiktok video link download",
    "facebook high quality video download", "download fb live video", "tiktok repost download"
  ],
  manifest: "/manifest.json",
  applicationName: "MM TIKTOK",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MM TIKTOK",
  },
  verification: {
    google: "1O709zKVp3mHuLlvN1tBdycXkeUVKizrVt2GWDSgb60",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gradient-to-br from-blue-50/80 via-white to-blue-100/60`}>
        <PWAContext />
        {children}
      </body>
    </html>
  );
}
