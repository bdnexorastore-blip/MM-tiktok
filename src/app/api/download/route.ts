import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes("tiktok")) {
      return NextResponse.json(
        { status: "error", message: "Please provide a valid TikTok link" },
        { status: 400 }
      );
    }

    // Mobile apps (Android/iOS) typically append extra text when copying links 
    // e.g. "Check this out! https://vm.tiktok.com/XZY/"
    // We must extract only the URL from this string
    const urlMatch = url.match(/(https?:\/\/[^\s]+)/);
    const cleanUrl = urlMatch ? urlMatch[0] : url;

    // Use our custom VPS backend instead of tikwm
    // You should set VPS_BACKEND_URL in your Vercel Environment Variables
    // Defaulting to the newly deployed Render URL
    const vpsBackendUrl = process.env.VPS_BACKEND_URL || "https://mm-tiktok.onrender.com";
    const apiUrl = `${vpsBackendUrl}/api/download`;
    
    // Call the VPS backend
    // Since processing with yt-dlp and ffmpeg might take time, we wait for the response
    const response = await axios.post(apiUrl, { url: cleanUrl }, {
      timeout: 120000 // 2 minutes timeout to wait for the VPS processing
    });

    const scraperData = response.data;

    if (scraperData.status === "success" && scraperData.data) {
      // Success, forward the response formatted by our VPS
      return NextResponse.json({
        status: "success",
        data: {
          title: scraperData.data.title,
          cover: scraperData.data.cover,
          sd_url: scraperData.data.sd_url,
          hd_url: scraperData.data.hd_url,
          mp3_url: scraperData.data.audio_url || "", // Map audio_url from VPS
          author: scraperData.data.author,
          images: scraperData.data.images || [], 
          http_headers: scraperData.data.http_headers || {},
        },
      });
    } else {
      return NextResponse.json(
        { 
          status: "error", 
          message: scraperData.message || "Failed to process video. Account might be private or link is invalid." 
        },
        { status: 400 }
      );
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("TikTok VPS API Error Output:", error);
    
    let errorMessage = "Network error or API blocked. Try another link.";
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        errorMessage = "The download took too long and timed out. Please try again.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
    } else if (error && error.message) {
       errorMessage = error.message;
    }

    return NextResponse.json(
      { status: "error", message: errorMessage },
      { status: 500 }
    );
  }
}
