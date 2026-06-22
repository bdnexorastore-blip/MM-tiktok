import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Direct Serverless Fetching for ultra-fast <2s response
    const urlMatch = url.match(/(https?:\/\/[^\s"']+)/);
    const cleanUrl = urlMatch ? urlMatch[0] : url;

    // We can't use fetch easily with timeout in Next.js without AbortController, 
    // so we'll use axios (which is already a dependency) for cleaner timeout handling.
    const response = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(cleanUrl)}`, {
      timeout: 8000 // Fast timeout
    });

    const data = response.data;
    if (data && data.status && data.data && data.data.downloads) {
      let hd_url = '';
      let sd_url = '';
      
      data.data.downloads.forEach((d: {quality: string, url: string}) => {
        if (d.quality.toLowerCase().includes('hd') || d.quality.includes('720p') || d.quality.includes('1080p')) {
          hd_url = d.url;
        } else if (d.quality.toLowerCase().includes('sd') || d.quality.includes('360p')) {
          sd_url = d.url;
        }
      });
      
      if (!hd_url && data.data.downloads.length > 0) hd_url = data.data.downloads[0].url;
      if (!sd_url) sd_url = hd_url;

      return NextResponse.json({
        success: true,
        video: {
          title: data.data.title || 'Facebook Video',
          author: {
            nickname: 'Facebook User',
            unique_id: 'facebook',
            avatar: '',
          },
          cover: data.data.thumbnail || '',
          hd_url: hd_url,
          sd_url: sd_url,
          mp3_url: '', // SIPUTZX API does not provide separate MP3 for FB
          images: [],
        },
      });
    }

    throw new Error("Unexpected response from scraper or no downloads found");
  } catch (error) {
    console.error("Facebook API Route Error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
