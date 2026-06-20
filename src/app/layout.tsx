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
  title: "MM TIKTOK | Premium Video Downloader",
  description: "Fast, clean, and user-friendly TikTok video downloader. Download without watermark for free.",
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
