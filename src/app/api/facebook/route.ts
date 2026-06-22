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

    // Fetch video data and facebook HTML metadata concurrently to save time
    const fetchSiputzx = axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(cleanUrl)}`, {
      timeout: 8000 // Fast timeout
    });

    const fetchFbMeta = axios.get(cleanUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      },
      timeout: 5000
    }).catch(() => null); // ignore errors to not fail the whole request

    const [siputzxRes, fbMetaRes] = await Promise.all([fetchSiputzx, fetchFbMeta]);
    const data = siputzxRes.data;

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

      // Extract real metadata
      let realTitle = data.data.title || 'Facebook Video';
      let realCover = data.data.thumbnail || '';
      let authorName = 'Facebook User';

      if (fbMetaRes && fbMetaRes.data) {
        const html = fbMetaRes.data;
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          realTitle = titleMatch[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
          const parts = realTitle.split(/\||-|on Reels/i);
          if (parts.length > 1) {
            authorName = parts[0].trim();
          } else {
            authorName = realTitle.split(" ")[0] || 'Facebook User';
          }
        }
        const imgMatch = html.match(/<meta property="og:image" content="(.*?)"/i);
        if (imgMatch && imgMatch[1]) {
          realCover = imgMatch[1].replace(/&amp;/g, '&');
        }
      }

      return NextResponse.json({
        success: true,
        video: {
          title: realTitle,
          author: {
            nickname: authorName,
            unique_id: 'facebook',
            avatar: realCover, // Using video cover as the profile pic for better UI
          },
          cover: realCover,
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
