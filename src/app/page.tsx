"use client";

import { useState } from "react";
import { Download, Link as LinkIcon, Loader2, ClipboardPaste, Music, AlertCircle, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import axios from "axios";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import Header from "@/components/Header";
import TikTokLogo from "@/components/TikTokLogo";

export default function Home() {
  const [url, setUrl] = useState("");
  const [fbUrl, setFbUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloadingType, setDownloadingType] = useState<"video" | "mp3" | "image" | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isCreatingVideo, setIsCreatingVideo] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{message: string, type: "loading" | "success"} | null>(null);

  const showToast = (message: string, type: "loading" | "success") => {
    setToast({ message, type });
    if (type === "success") {
      setTimeout(() => setToast(null), 3500);
    }
  };
  
  const processDownload = async (linkToDownload: string, platform: "tiktok" | "facebook") => {
    if (!linkToDownload.trim()) {
      setError(`Please put a valid ${platform === "tiktok" ? "TikTok" : "Facebook"} URL`);
      return;
    }

    if (platform === "tiktok" && !linkToDownload.includes("tiktok")) {
      setError("Invalid link. Please paste a URL from TikTok.");
      return;
    }
    if (platform === "facebook" && !linkToDownload.includes("facebook.com") && !linkToDownload.includes("fb.watch")) {
      setError("Invalid link. Please paste a URL from Facebook.");
      return;
    }
    
    setError("");
    setLoading(true);
    setResult(null);
    setActiveImageIndex(0);

    try {
      const endpoint = platform === "tiktok" ? "/api/download" : "/api/facebook";
      const response = await axios.post(endpoint, { url: linkToDownload });
      
      if (response.data.status === "success" || response.data.success) {
        setResult(response.data.data || response.data.video);
      } else {
        setError(response.data.message || response.data.error || "Failed to download video. Please try again.");
      }
    } catch (err) {
      console.error(err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (axios.isAxiosError(err) && err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("An error occurred while fetching the video. The server might be down.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processDownload(url, "tiktok");
  };

  const handleFbManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processDownload(fbUrl, "facebook");
  };

  const handlePasteAndDownload = async (platform: "tiktok" | "facebook") => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 0) {
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        const cleanText = urlMatch ? urlMatch[0] : text;
        if (platform === "tiktok") {
          setUrl(cleanText);
          processDownload(cleanText, "tiktok");
        } else {
          setFbUrl(cleanText);
          processDownload(cleanText, "facebook");
        }
      } else {
        setError(`Your clipboard is empty. Please copy a ${platform === "tiktok" ? "TikTok" : "Facebook"} link first.`);
      }
    } catch (err) {
      console.log("Failed to paste", err);
      if (platform === "tiktok") {
        if (url) processDownload(url, "tiktok");
        else setError("Clipboard access denied. Please paste manually and hit Download.");
      } else {
        if (fbUrl) processDownload(fbUrl, "facebook");
        else setError("Clipboard access denied. Please paste manually and hit Download.");
      }
    }
  };

  const handleDownloadFile = async (fileUrl: string, type: "video" | "mp3" | "image", imageIndex?: number) => {
    // Clear any previous toast immediately so state is clean before starting
    setToast(null);
    setDownloadingType(type);
    
    // Small tick to let React flush the null toast before showing loading, avoiding stale UI
    await new Promise(r => setTimeout(r, 50));
    showToast("Downloading... Please wait", "loading");
    
    try {
      const titleClean = result?.title ? result.title.substring(0, 12).replace(/[^a-zA-Z0-9]/g, '_') : "Media";
      const ext = type === "video" ? "mp4" : type === "image" ? "jpg" : "mp3";
      // Unique filename using timestamp + index so Android doesn't prompt 'Download again?'
      const uniqueSuffix = type === "image" && imageIndex !== undefined ? `_${imageIndex + 1}` : "";
      const filename = `MM_TIKTOK_${titleClean}${uniqueSuffix}.${ext}`;
      const encodedHeaders = btoa(JSON.stringify(result?.http_headers || {}));
      const downloadUrl = `/api/proxy?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}&headers=${encodedHeaders}`;
      
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = downloadUrl;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      
      // Let the click propagate before cleanup
      setTimeout(() => {
        document.body.removeChild(a);
      }, 300);
      
      showToast("Download Started!", "success");
      
    } catch (err) {
      console.error("Failed to download file natively", err);
      // Fallback
      window.open(fileUrl, "_blank");
      setToast(null);
    } finally {
      setDownloadingType(null);
    }
  };

  // ─── Client-side Slideshow → MP4 Video Generator (WebCodecs API) ─────────────
  const createVideoFromImages = async () => {
    if (!result?.images?.length || !result?.mp3_url) return;
    setIsCreatingVideo(true);
    setToast(null);
    await new Promise(r => setTimeout(r, 60));
    showToast("Image Crafting... Please wait", "loading");

    const blobUrls: string[] = [];

    try {
      const images: string[] = result.images;
      const audioSrcUrl: string = result.mp3_url;
      const numImages = images.length;

      // 1 — Fetch and decode audio to get duration + raw samples
      const audioResp = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: audioSrcUrl, filename: "audio.mp3", http_headers: result?.http_headers || {} })
      });
      const audioArrayBuffer = await audioResp.arrayBuffer();
      const ac = new AudioContext();
      const decodedAudio = await ac.decodeAudioData(audioArrayBuffer);
      await ac.close();
      const audioDuration = decodedAudio.duration;
      const sampleRate = decodedAudio.sampleRate;
      const numChannels = decodedAudio.numberOfChannels;

      const secsPerImage = numImages > 1 ? audioDuration / numImages : audioDuration;

      // 2 — Fetch images as blob URLs
      for (let i = 0; i < numImages; i++) {
        showToast(`Fetching image ${i + 1}/${numImages}...`, "loading");
        const r2 = await fetch("/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: images[i], filename: `img_${i}.jpg`, http_headers: result?.http_headers || {} })
        });
        const b = await r2.blob();
        blobUrls.push(URL.createObjectURL(b));
      }
      showToast("Image Crafting... Please wait", "loading");

      // 3 — Load HTMLImageElements
      const htmlImages = await Promise.all(
        blobUrls.map(src => new Promise<HTMLImageElement>((ok, fail) => {
          const img = new Image();
          img.onload = () => ok(img);
          img.onerror = fail;
          img.src = src;
        }))
      );

      // 4 — Canvas for frame drawing (no DOM attachment needed - WebCodecs reads pixels directly)
      const W = 540, H = 960;
      const cvs = document.createElement("canvas");
      cvs.width = W; cvs.height = H;
      const ctx = cvs.getContext("2d", { alpha: false })!;

      const drawCoverFit = (img: HTMLImageElement) => {
        const ir = img.naturalWidth / img.naturalHeight;
        const cr = W / H;
        let dw = W, dh = H, dx = 0, dy = 0;
        if (ir > cr) { dh = H; dw = H * ir; dx = -(dw - W) / 2; }
        else         { dw = W; dh = W / ir;  dy = -(dh - H) / 2; }
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, dx, dy, dw, dh);
      };

      // 5 — Setup MP4 muxer
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: "avc", width: W, height: H },
        audio: { codec: "aac", sampleRate, numberOfChannels: numChannels },
        fastStart: "in-memory",
      });

      // 6 — VideoEncoder (H.264 - works on ALL Android devices)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const VE = (window as any).VideoEncoder;
      if (!VE) throw new Error("WebCodecs VideoEncoder not supported on this browser");

      const videoEncoder: VideoEncoder = new VE({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: Error) => { throw e; },
      });
      videoEncoder.configure({
        codec: "avc1.4d0028",  // H.264 Main Profile Level 4.0 (Fixes Android black screens)
        width: W, height: H,
        bitrate: 1_500_000,
        framerate: 25,
      });

      // 7 — AudioEncoder (AAC)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AE = (window as any).AudioEncoder;
      if (!AE) throw new Error("WebCodecs AudioEncoder not supported on this browser");

      const audioEncoder: AudioEncoder = new AE({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
        error: (e: Error) => { throw e; },
      });
      audioEncoder.configure({
        codec: "mp4a.40.2",  // AAC-LC
        sampleRate,
        numberOfChannels: numChannels,
        bitrate: 128_000,
      });

      // 8 — Encode video frames: draw each image, snapshot as VideoFrame, encode
      const fps = 25;
      const frameDurationUs = Math.round(1_000_000 / fps); // microseconds per frame
      const framesPerImage = Math.ceil(secsPerImage * fps);
      let frameIndex = 0;

      for (let i = 0; i < htmlImages.length; i++) {
        drawCoverFit(htmlImages[i]);
        const framesToEncode = i < htmlImages.length - 1
          ? framesPerImage
          : Math.max(1, Math.round(audioDuration * fps) - frameIndex);

        for (let f = 0; f < framesToEncode; f++) {
          const tsUs = frameIndex * frameDurationUs;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const frame = new (window as any).VideoFrame(cvs, {
            timestamp: tsUs,
            duration: frameDurationUs,
          });
          videoEncoder.encode(frame, { keyFrame: f % 50 === 0 });
          frame.close();
          frameIndex++;
          // Yield to event loop every 25 frames to keep UI responsive
          if (frameIndex % 25 === 0) await new Promise(r => setTimeout(r, 0));
        }
      }

      // 9 — Encode audio samples from decoded AudioBuffer
      const audioChunkSize = 4096;
      for (let offset = 0; offset < decodedAudio.length; offset += audioChunkSize) {
        const length = Math.min(audioChunkSize, decodedAudio.length - offset);
        // Build planar Float32 data: [ch0 samples, ch1 samples]
        const planar = new Float32Array(numChannels * length);
        for (let ch = 0; ch < numChannels; ch++) {
          planar.set(decodedAudio.getChannelData(ch).subarray(offset, offset + length), ch * length);
        }
        const tsUs = Math.round((offset / sampleRate) * 1_000_000);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audioData = new (window as any).AudioData({
          format: "f32-planar",
          sampleRate,
          numberOfChannels: numChannels,
          numberOfFrames: length,
          timestamp: tsUs,
          data: planar,
        });
        audioEncoder.encode(audioData);
        audioData.close();
      }

      // 10 — Flush encoders and finalize MP4
      await videoEncoder.flush();
      await audioEncoder.flush();
      muxer.finalize();

      const mp4Buffer = muxer.target.buffer;
      const mp4Blob = new Blob([mp4Buffer], { type: "video/mp4" });

      // 11 — Download as .mp4
      const titleClean = result?.title
        ? result.title.substring(0, 12).replace(/[^a-zA-Z0-9]/g, "_")
        : "Slideshow";
      const dlUrl = URL.createObjectURL(mp4Blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `MM_TIKTOK_${titleClean}_slides.mp4`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(dlUrl); document.body.removeChild(a); }, 400);

      showToast("Video Created! Check Downloads ✓", "success");
    } catch (err2) {
      console.error("Video creation failed", err2);
      showToast("Crafting failed. Try again.", "success");
    } finally {
      blobUrls.forEach(u => URL.revokeObjectURL(u));
      setIsCreatingVideo(false);
    }
  };

  const hasContent = loading || result || error;

  return (
    <main className="flex flex-col min-h-[100dvh] relative overflow-hidden bg-gradient-to-br from-blue-50/80 via-white to-blue-100/60 p-4 pb-12 pt-20">
      
      {/* Top Header Navigation */}
      <Header />

      {/* Background Decorative Blob */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-300/30 blur-[120px] pointer-events-none transition-all duration-1000" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-300/30 blur-[120px] pointer-events-none transition-all duration-1000" />

      {/* Main Foreground Container */}
      <div className={`relative z-10 w-full max-w-3xl mx-auto flex flex-col items-center transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${hasContent ? "pt-2 md:pt-4" : "justify-center min-h-[80dvh] -translate-y-12"}`}>
        
        {/* Header Text & Beautiful Transparent TikTok Logo */}
        <div className={`flex flex-col items-center text-center transition-all duration-700 ${hasContent ? "scale-90 opacity-90 mb-6 hidden sm:flex" : "scale-100 mb-10"}`}>
          
          {/* Glassmorphic Logos Container */}
          <div className="flex items-center gap-4 mb-5 animate-in zoom-in spin-in-12 duration-1000">
            {/* TikTok Logo */}
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-[20px] bg-gradient-to-tr from-[#00f2fe] via-[#4facfe] to-[#f093fb] p-[2px] shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-white/70 backdrop-blur-xl rounded-[18px] flex items-center justify-center">
                <TikTokLogo className="w-7 h-7 md:w-8 md:h-8 text-gray-900 drop-shadow-sm transition-transform hover:scale-110 duration-300" />
              </div>
            </div>
            
            <div className="text-gray-400 font-bold text-lg">&</div>
            
            {/* Facebook Logo */}
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-[20px] bg-gradient-to-tr from-[#1877F2] to-[#0d59b8] p-[2px] shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-white/70 backdrop-blur-xl rounded-[18px] flex items-center justify-center">
                <svg className="w-7 h-7 md:w-8 md:h-8 text-[#1877F2] drop-shadow-sm transition-transform hover:scale-110 duration-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
            </div>
          </div>

          <h1 className={`font-black text-gray-900 tracking-tight transition-all duration-700 ${hasContent ? "text-2xl md:text-3xl mb-1" : "text-3xl md:text-5xl lg:text-6xl mb-3 leading-tight"}`}>
            TikTok & Facebook Downloader
          </h1>
          <p className={`text-gray-600 font-medium transition-all duration-700 max-w-xl ${hasContent ? "text-sm hidden sm:block" : "text-base md:text-lg"}`}>
            The fastest tool to save videos in <span className="text-blue-600 font-bold">Ultra HD without watermark</span> and get MP3 audio instantly.
          </p>
        </div>

        {/* Central Input Box or Reboot Button */}
        <div className={`w-full max-w-2xl flex flex-col items-center gap-4 transition-all duration-700 ${hasContent ? "order-last mt-10" : "order-2"}`}>
          
          {!hasContent ? (
            <div className="w-full flex flex-col gap-5">
              {/* TikTok Input Form */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-gray-600 ml-2">TikTok Downloader</span>
                <form 
                  onSubmit={handleManualSubmit} 
                  className="w-full relative glass-card p-2 flex items-center gap-2 transition-all duration-500 shadow-[0_10px_40px_rgba(37,99,235,0.08)] bg-white/90 border border-blue-100 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10"
                >
                  <div className="pl-3 hidden sm:flex">
                    <TikTokLogo className="text-blue-500 w-5 h-5 flex-shrink-0" />
                  </div>
                  
                  <input 
                    type="url" 
                    placeholder="Paste TikTok link here..." 
                    className="flex-1 bg-transparent px-3 py-3 outline-none text-gray-800 placeholder:text-gray-400 font-medium text-base min-w-0"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={loading}
                  />

                  <button
                    type="submit"
                    onClick={(e) => {
                      if (url.trim()) {
                        e.preventDefault();
                        processDownload(url, "tiktok");
                      } else {
                        e.preventDefault();
                        handlePasteAndDownload("tiktok");
                      }
                    }}
                    disabled={loading}
                    title={url.trim() ? "Download" : "Paste & Download"}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold transition-all shadow-lg shadow-blue-500/30 active:scale-[0.96] disabled:opacity-70 flex-shrink-0 min-w-[120px]"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : url.trim() ? (
                      <>
                        <Download className="w-5 h-5" />
                        <span>Download</span>
                      </>
                    ) : (
                      <>
                        <ClipboardPaste className="w-5 h-5" />
                        <span>Paste</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Facebook Input Form */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-gray-600 ml-2">Facebook Downloader</span>
                <form 
                  onSubmit={handleFbManualSubmit} 
                  className="w-full relative glass-card p-2 flex items-center gap-2 transition-all duration-500 shadow-[0_10px_40px_rgba(37,99,235,0.08)] bg-white/90 border border-blue-100 hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10"
                >
                  <div className="pl-3 hidden sm:flex">
                    <svg className="text-[#1877F2] w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  
                  <input 
                    type="url" 
                    placeholder="Paste Facebook video or reel link here..." 
                    className="flex-1 bg-transparent px-3 py-3 outline-none text-gray-800 placeholder:text-gray-400 font-medium text-base min-w-0"
                    value={fbUrl}
                    onChange={(e) => setFbUrl(e.target.value)}
                    disabled={loading}
                  />

                  <button
                    type="submit"
                    onClick={(e) => {
                      if (fbUrl.trim()) {
                        e.preventDefault();
                        processDownload(fbUrl, "facebook");
                      } else {
                        e.preventDefault();
                        handlePasteAndDownload("facebook");
                      }
                    }}
                    disabled={loading}
                    title={fbUrl.trim() ? "Download" : "Paste & Download"}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#1877F2] to-[#0d59b8] hover:from-[#166fe5] hover:to-[#0a4897] text-white font-bold transition-all shadow-lg shadow-blue-500/30 active:scale-[0.96] disabled:opacity-70 flex-shrink-0 min-w-[120px]"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : fbUrl.trim() ? (
                      <>
                        <Download className="w-5 h-5" />
                        <span>Download</span>
                      </>
                    ) : (
                      <>
                        <ClipboardPaste className="w-5 h-5" />
                        <span>Paste</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            // Beautiful Reset Button shown when content is loaded
            <button
              onClick={() => {
                setUrl("");
                setFbUrl("");
                setResult(null);
                setLoading(false);
                setError("");
              }}
              className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-white/60 backdrop-blur-md border border-white hover:border-blue-200 text-gray-800 rounded-[2rem] font-bold text-sm md:text-base shadow-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 active:scale-95 animate-in fade-in slide-in-from-bottom-8 overflow-hidden w-full max-w-[340px]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-blue-100/30 to-purple-50/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <LinkIcon className="w-4 h-4" />
              </div>
              Download Another Video
            </button>
          )}
        </div>

        {/* Result & Loading Area (Order 2, sits cleanly between header and input) */}
        <div className={`w-full max-w-[340px] flex flex-col items-center transition-all duration-700 order-2 origin-top ${hasContent ? "opacity-100 scale-100" : "opacity-0 scale-95 h-0 overflow-hidden"}`}>
          
          {/* Error Message */}
          {error && (
            <div className="w-full bg-red-50 text-red-600 px-5 py-4 rounded-2xl border border-red-100 text-sm flex items-center justify-center animate-in fade-in slide-in-from-top-4 shadow-sm mb-4">
              <AlertCircle className="w-5 h-5 mr-2 text-red-500 shrink-0" />
              <span className="font-medium text-center">{error}</span>
            </div>
          )}

          {/* Premium Skeleton Loading */}
          {loading && !error && (
            <div className="w-full glass-card flex flex-col p-4 animate-in fade-in zoom-in-95 duration-500 border border-white/60">
              <div className="w-full aspect-[9/16] rounded-xl shimmer-light overflow-hidden mb-4 relative shadow-inner">
                {/* Skeleton Overlay for Author & Title */}
                <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-black/10 shadow-sm" />
                    <div className="flex flex-col gap-1.5">
                      <div className="w-24 h-3.5 rounded-md bg-black/10" />
                      <div className="w-16 h-2.5 rounded-md bg-black/10" />
                    </div>
                  </div>
                  <div className="w-[85%] h-3 rounded-md bg-black/10 mt-1" />
                  <div className="w-[60%] h-3 rounded-md bg-black/10" />
                </div>
                
                {/* Simulated center floating loader icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-blue-400 animate-spin opacity-50" />
                </div>
              </div>
              <div className="flex gap-3 w-full">
                <div className="h-12 w-1/2 rounded-xl shimmer-light" />
                <div className="h-12 w-1/2 rounded-xl shimmer-light" />
              </div>
            </div>
          )}

          {/* Actual Video Result */}
          {result && !loading && !error && (
            <div className="w-full glass-card flex flex-col p-4 animate-in fade-in zoom-in-95 duration-700 shadow-2xl border-white bg-white/95">
              
              {/* Result Stage: Video or Photo Carousel bounded strictly */}
              <div className="relative w-full aspect-[9/16] max-h-[45vh] bg-black/5 rounded-xl overflow-hidden shadow-inner flex shrink-0 items-center justify-center border border-gray-100 mb-4 group">
                {result.images && result.images.length > 0 ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={result.images[activeImageIndex]} 
                      alt={`Slide ${activeImageIndex + 1}`} 
                      className="object-cover w-full h-full transition-all duration-300" 
                    />
                    
                    {/* Carousel Navigation */}
                    {result.images.length > 1 && (
                      <>
                        {activeImageIndex > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveImageIndex(p => p - 1); }} 
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 md:p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all active:scale-90"
                          >
                            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                          </button>
                        )}
                        {activeImageIndex < result.images.length - 1 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveImageIndex(p => p + 1); }} 
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 md:p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all active:scale-90"
                          >
                            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                          </button>
                        )}
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white font-bold uppercase tracking-wider shadow-sm">
                          {activeImageIndex + 1} / {result.images.length}
                        </div>
                      </>
                    )}
                  </>
                ) : result.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={result.cover} 
                    alt="Video thumbnail" 
                    className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50/50 backdrop-blur-sm">
                    <TikTokLogo className="w-10 h-10 text-gray-400 opacity-50" />
                  </div>
                )}
                
                {/* Gradient overlay for Author Profile & Title */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/98 via-black/60 to-transparent pt-32 pb-4 px-4 pointer-events-none flex flex-col justify-end">
                  
                  {/* Author Info */}
                  <div className="flex items-center gap-3 mb-2.5">
                    {result.author?.avatar ? (
                      <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-white/90 shadow-lg shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={result.author.avatar} alt="Author avatar" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/80 shadow-lg shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-white font-bold text-sm md:text-base drop-shadow-md truncate">
                        {result.author?.nickname || "TikTok Creator"}
                      </span>
                      <span className="text-white/80 font-medium text-xs drop-shadow-md truncate">
                        @{result.author?.unique_id || "tiktok"}
                      </span>
                    </div>
                  </div>

                  {/* Video Title */}
                  <p className="text-white/95 font-medium text-xs md:text-sm drop-shadow-md line-clamp-2 leading-snug">
                    {result.title || "Ready to save format"}
                  </p>
                </div>
              </div>
              
              {/* Download Action Buttons */}
              <div className="w-full flex justify-center gap-6 sm:gap-10 mt-5 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both flex-wrap">
                
                {/* Video Button Column */}
                {(result.hd_url || result.sd_url || (result.images && result.images.length > 0)) && (
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() =>
                        result.images && result.images.length > 0
                          ? createVideoFromImages()
                          : handleDownloadFile(result.hd_url || result.sd_url, "video")
                      }
                      disabled={downloadingType !== null || isCreatingVideo}
                      className="w-14 h-14 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-[0_8px_25px_rgba(37,99,235,0.4)] transition-all active:scale-[0.92] disabled:opacity-70 disabled:scale-100 group"
                    >
                      {(downloadingType === "video" || isCreatingVideo) ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Download className="w-6 h-6 group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300" />
                      )}
                    </button>
                    <span className="text-sm font-bold text-gray-700">Video</span>
                  </div>
                )}

                {/* Specific Image Button Column (Visible only on Photo posts) */}
                {result.images && result.images.length > 0 && (
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => handleDownloadFile(result.images[activeImageIndex], "image", activeImageIndex)}
                      disabled={downloadingType !== null}
                      className="w-14 h-14 flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-[0_8px_25px_rgba(99,102,241,0.4)] transition-all active:scale-[0.92] disabled:opacity-70 disabled:scale-100 group"
                    >
                      {downloadingType === "image" ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <ImageIcon className="w-6 h-6 group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300" />
                      )}
                    </button>
                    <span className="text-sm font-bold text-gray-700">Image</span>
                  </div>
                )}
                
                {/* MP3 Audio Button Column */}
                {result.mp3_url && (
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => handleDownloadFile(result.mp3_url, "mp3")}
                      disabled={downloadingType !== null}
                      className="w-14 h-14 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-[0_8px_25px_rgba(37,99,235,0.4)] transition-all active:scale-[0.92] disabled:opacity-70 disabled:scale-100 group"
                    >
                      {downloadingType === "mp3" ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Music className="w-6 h-6 animate-bounce-spin-delay group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300" style={{ animationDelay: "2s" }} />
                      )}
                    </button>
                    <span className="text-sm font-bold text-gray-700">MP3</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Notification Toast - compact pill */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-full flex items-center gap-2 shadow-[0_6px_24px_rgba(0,0,0,0.18)] text-white font-semibold whitespace-nowrap animate-in fade-in slide-in-from-bottom-6 duration-300 ${toast.type === "success" ? "bg-green-600 border border-green-500" : "bg-blue-600 border border-blue-500"}`}>
          {toast.type === "loading" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white flex-shrink-0" />
          ) : (
            <Download className="w-3.5 h-3.5 text-white flex-shrink-0" />
          )}
          <span className="text-[12px] leading-none">{toast.message}</span>
        </div>
      )}
    </main>
  );
}
