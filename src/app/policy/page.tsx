"use client";

import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import Image from "next/image";
import Header from "@/components/Header";

export default function PolicyPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only show skeleton on first visit
    const hasLoaded = sessionStorage.getItem('app_skeleton_shown');
    if (!hasLoaded) {
      const timer = setTimeout(() => {
        setLoading(false);
        sessionStorage.setItem('app_skeleton_shown', 'true');
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <main className="flex flex-col min-h-[100dvh] relative overflow-hidden bg-gradient-to-br from-blue-50/80 via-white to-blue-100/60 p-4 pb-12 pt-20">
      
      {/* Top Header Navigation */}
      <Header title="Privacy Policy" showBack={true} />

      {/* Decorative Blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-300/30 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-300/30 blur-[120px] pointer-events-none" />

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col gap-6 w-full pb-20 mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {loading ? (
          /* Skeletons */
          <div className="flex flex-col gap-6 w-full">
            <div className="glass-card flex flex-col p-6 gap-4 border border-white/60">
              <div className="w-1/3 h-8 rounded-md shimmer-light mb-4" />
              <div className="w-full h-4 rounded-md shimmer-light" />
              <div className="w-full h-4 rounded-md shimmer-light" />
              <div className="w-5/6 h-4 rounded-md shimmer-light" />
            </div>
            <div className="glass-card flex flex-col p-6 gap-4">
              <div className="w-1/4 h-6 rounded-md shimmer-light mb-2" />
              <div className="w-full h-4 rounded-md shimmer-light" />
              <div className="w-full h-4 rounded-md shimmer-light" />
              <div className="w-4/5 h-4 rounded-md shimmer-light" />
            </div>
            <div className="glass-card flex flex-col p-6 gap-4">
              <div className="w-1/3 h-6 rounded-md shimmer-light mb-2" />
              <div className="w-full h-4 rounded-md shimmer-light" />
              <div className="w-3/4 h-4 rounded-md shimmer-light" />
            </div>
          </div>
        ) : (
          /* Real Content */
          <>
            <div className="glass-card flex flex-col p-8 bg-white/90 border-white/60 shadow-[0_8px_40px_rgba(0,0,0,0.04)] mb-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 rounded-xl text-blue-600"><Lock className="w-6 h-6" /></div>
                <div>
                  <h1 className="text-2xl font-black text-gray-900 tracking-tight">Privacy Policy</h1>
                  <p className="text-xs text-blue-600 font-bold tracking-wide uppercase mt-1">Effective Date: April 2026</p>
                </div>
              </div>
              
              <div className="prose prose-sm md:prose-base text-gray-600 max-w-none text-justify">
                <p className="mb-4 font-medium text-gray-800">
                  Welcome to the Privacy Policy for MM TIKTOK. We prioritize your privacy above all else and are committed to ensuring that your data remains safe, secure, and under your absolute control. This comprehensive policy details exactly how we operate our services and what limits we place on our own infrastructure.
                </p>

                <h3 className="text-gray-900 font-bold text-lg mt-8 mb-3">1. Information We Do NOT Collect</h3>
                <p className="mb-4">
                  MM TIKTOK operates on a strict zero-retention architecture. We do not require you to create an account, register, or provide any personally identifiable information (PII) to utilize our core download services. Every action you take on our platform—pasting a link, generating an HD video stream, or downloading an MP3 audio file—is stateless. This means that once your session is closed, there are no databases storing your history, no logs tracking your IP addresses specifically to user files, and absolutely no behavioral profiles built against your device. 
                </p>
                <p className="mb-4">
                  We guarantee that the application does not execute any tracking SDKs on your frontend device. The URLs you paste into our secure input fields are immediately proxied to the target API for immediate resolution and then instantly discarded from server memory.
                </p>

                <h3 className="text-gray-900 font-bold text-lg mt-8 mb-3">2. How Downloads Are Processed</h3>
                <p className="mb-4">
                  When you request a video download via MM TIKTOK, the following sequence occurs: Your requested TikTok URL is transmitted via an encrypted HTTPS connection to our backend route handler. This handler acts solely as a transient proxy. It reformats your request to interact securely with a third-party scraping service (e.g., tikwm) to extract the bare media files. The media files are then streamed downwards to your browser natively.
                </p>
                <p className="mb-4">
                  Because we utilize Next.js API Routes for this proxy behavior, none of the files touch a permanent disk instance on our servers. The transfer resides within volatile RAM limits and is expunged immediately following the file transmission. We cannot reproduce your downloaded files, nor can we trace them back to you.
                </p>

                <h3 className="text-gray-900 font-bold text-lg mt-8 mb-3">3. Third-Party Connections</h3>
                <p className="mb-4">
                  While our internal infrastructure is entirely devoid of trackers, we do interact with external APIs to fulfill your requests. Please note that the third-party providers responsible for resolving the TikTok media links may have their own independent operational logs. However, because our proxy obfuscates your direct origin to the absolute extent permissible by network routing standards, your exposure to these third-party trackers is significantly minimized compared to native TikTok application usage.
                </p>
                
                <h3 className="text-gray-900 font-bold text-lg mt-8 mb-3">4. Cookies and Local Storage</h3>
                <p className="mb-4">
                  We do not employ any tracking cookies. We do not use Google Analytics or Facebook Pixels on this domain. The limited front-end state management (such as toggling the dark/light mode, or remembering UI states) is handled purely in volatile browser memory or non-intrusive local storage strictly for functional aesthetic purposes.
                </p>
                
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mt-8">
                  <h4 className="font-bold text-blue-900 mb-2">Policy Updates & Compliance</h4>
                  <p className="text-blue-800 text-sm">
                    Because we handle no user data, our compliance with regulations like GDPR and CCPA is inherently met by default. Should we ever alter this architecture to include accounts or persistent storage, this policy will be updated immediately, and a massive clear notice will be broadcast on our hero section. Continued use of the platform unequivocally constitutes acceptance of this non-tracking, safe data processing pledge.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center py-6 text-sm">
               <Image src="/logo.png" alt="Platform Icon" width={24} height={24} className="opacity-50 grayscale mr-2" />
               <span className="text-gray-400 font-bold">MM TIKTOK • 2026</span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
