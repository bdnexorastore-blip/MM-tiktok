import { NextResponse } from "next/server";

export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    const filename = searchParams.get("filename") || "download.mp4";

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    const encodedHeaders = searchParams.get("headers");
    let customHeaders = {};
    if (encodedHeaders) {
      try {
        customHeaders = JSON.parse(Buffer.from(encodedHeaders, "base64").toString("utf-8"));
      } catch (e) {
        console.error("Failed to parse custom headers", e);
      }
    }

    // Pass a strong desktop User-Agent to force TikTok CDN to return the highest uncompressed bitrate stream
    const headersToUse = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://www.tiktok.com/",
      ...customHeaders
    };

    const response = await fetch(url, {
      headers: headersToUse
    });

    if (!response.ok) throw new Error("Failed to fetch file from TikTok CDN");

    const headers = new Headers();
    
    // Explicitly set media MIME types so Android/iOS Media Scanners detect and index them in the Gallery app
    if (filename.toLowerCase().endsWith(".mp4")) {
      headers.set("Content-Type", "video/mp4");
    } else if (filename.toLowerCase().endsWith(".mp3")) {
      headers.set("Content-Type", "audio/mpeg");
    } else {
      headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
    }

    // Pass the exact file size to the mobile browser to prevent early stream termination (which causes corrupted 'black screen' MP4 files)
    const contentLength = response.headers.get("Content-Length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    // Force browser to pop up native download manager
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    // Stream the body directly to the client
    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Proxy Download Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to download" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, filename = "download.mp4", http_headers = {} } = body;

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Merge default headers with the ones provided by yt-dlp
    const headersToUse = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://www.tiktok.com/",
      ...http_headers
    };

    const response = await fetch(url, { headers: headersToUse });

    if (!response.ok) {
      throw new Error(`Failed to fetch file from TikTok CDN: ${response.statusText}`);
    }

    const headers = new Headers();
    if (filename.toLowerCase().endsWith(".mp4")) {
      headers.set("Content-Type", "video/mp4");
    } else if (filename.toLowerCase().endsWith(".mp3")) {
      headers.set("Content-Type", "audio/mpeg");
    } else {
      headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
    }

    const contentLength = response.headers.get("Content-Length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Proxy POST Download Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to download" }, { status: 500 });
  }
}
