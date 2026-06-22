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

    const urlMatch = url.match(/(https?:\/\/[^\s]+)/);
    const cleanUrl = urlMatch ? urlMatch[0] : url;

    // Direct Serverless Fetching for ultra-fast <2s response
    const fetchTikWM = async () => {
      const response = await axios.post("https://www.tikwm.com/api/", { url: cleanUrl, hd: 1 }, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 4000 // Very short timeout to favor faster APIs
      });
      const data = response.data;
      if (data && data.code === 0 && data.data) {
        return { provider: "tikwm", data: data.data };
      }
      throw new Error(data?.msg || "TikWM extraction failed");
    };

    const fetchSiputzx = async () => {
      const response = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(cleanUrl)}`, {
        timeout: 4000
      });
      const data = response.data;
      if (data && data.status && data.data) {
        return { provider: "siputzx", data: data.data };
      }
      throw new Error("Siputzx extraction failed");
    };

    // Race APIs to get the absolute fastest response
    const result = await Promise.any([fetchTikWM(), fetchSiputzx()]);

    if (result.provider === "tikwm") {
      const videoData = result.data;
      return NextResponse.json({
        status: "success",
        data: {
          title: videoData.title || "",
          cover: videoData.cover || "",
          hd_url: videoData.hdplay || videoData.play || "",
          sd_url: videoData.play || "",
          mp3_url: videoData.music || videoData.music_info?.play || "",
          author: {
            nickname: videoData.author?.nickname || "",
            unique_id: videoData.author?.unique_id || "",
            avatar: videoData.author?.avatar || "",
          },
          images: videoData.images || [],
        },
      });
    } else {
      const videoData = result.data;
      let hd_url = "";
      let sd_url = "";
      
      if (videoData.media && Array.isArray(videoData.media)) {
        videoData.media.forEach((m: {quality: string, url: string}) => {
          if (m.quality === "HD") hd_url = m.url;
          else if (m.quality === "SD") sd_url = m.url;
        });
      }
      
      if (!hd_url && videoData.media?.length > 0) hd_url = videoData.media[0].url;
      if (!sd_url) sd_url = hd_url;

      return NextResponse.json({
        status: "success",
        data: {
          title: videoData.title || "TikTok Video",
          cover: videoData.thumbnail || "",
          hd_url: hd_url,
          sd_url: sd_url,
          mp3_url: videoData.audio || "", // Siputzx might provide audio differently or not at all sometimes
          author: {
            nickname: videoData.author || "TikTok User",
            unique_id: "tiktok",
            avatar: "",
          },
          images: [],
        },
      });
    }
  } catch (error) {
    console.error("TikTok Direct Fetch Error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { 
        status: "error", 
        message: "Network error or API blocked. Try another link." 
      },
      { status: 500 }
    );
  }
}
