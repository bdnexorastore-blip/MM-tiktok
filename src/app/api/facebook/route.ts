import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // In dev, point to localhost:4000. In prod, point to render.
    const vpsUrl = process.env.NODE_ENV === "development" 
      ? "http://localhost:4000" 
      : (process.env.VPS_BACKEND_URL || "https://mm-tiktok.onrender.com");
    
    // Call the VPS backend facebook endpoint
    const response = await fetch(`${vpsUrl}/api/facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const scraperData = await response.json();

    if (!response.ok || scraperData.status === "error") {
      return NextResponse.json(
        { error: scraperData.message || "Failed to process Facebook video" },
        { status: response.status || 500 }
      );
    }

    if (scraperData.status === "success" && scraperData.data) {
      // Map to the same structure the UI expects
      return NextResponse.json({
        success: true,
        video: {
          title: scraperData.data.title,
          cover: scraperData.data.cover,
          hd_url: scraperData.data.hd_url,
          mp3_url: scraperData.data.audio_url || "",
          author: scraperData.data.author,
          images: scraperData.data.images || [],
        },
      });
    }

    throw new Error("Unexpected response from scraper");
  } catch (error: any) {
    console.error("Facebook API Route Error:", error.message);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
