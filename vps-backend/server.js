const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Directories
const tempDir = path.join(__dirname, 'temp');
const downloadsDir = path.join(__dirname, 'public', 'downloads');

if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json());
app.use('/downloads', express.static(downloadsDir));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ─── Helper: spawn-based command runner ──────────────────────────────────────
// Uses spawn instead of exec so we don't hit buffer limits on large yt-dlp output.
// Collects stdout/stderr as strings and resolves/rejects after process exits.
const spawnPromise = (cmd, args, timeoutMs = 120000) => {
  return new Promise((resolve, reject) => {
    console.log(`[spawn] ${cmd} ${args.join(' ')}`);

    const proc = spawn(cmd, args, { shell: false });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Command timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        console.error(`[spawn] exit code ${code}\nstderr: ${stderr}`);
        reject(new Error(stderr.trim() || `Process exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
};

// ─── yt-dlp common headers for TikTok ────────────────────────────────────────
// These headers mimic a real browser and prevent TikTok from blocking yt-dlp.
const YTDLP_COMMON_ARGS = [
  '--no-warnings',
  '--no-playlist',
  '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  '--add-header', 'Referer:https://www.tiktok.com/',
  '--add-header', 'Accept-Language:en-US,en;q=0.9',
];

// ─── Route ────────────────────────────────────────────────────────────────────
app.post('/api/download', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes('tiktok')) {
    return res.status(400).json({ status: 'error', message: 'Please provide a valid TikTok link' });
  }

  // Extract clean URL (strips any surrounding share-text on Android/iOS)
  const urlMatch = url.match(/(https?:\/\/[^\s"']+)/);
  if (!urlMatch) {
    return res.status(400).json({ status: 'error', message: 'Invalid URL format' });
  }
  const cleanUrl = urlMatch[0];

  try {
    // ── 1. Fetch metadata & direct URLs via yt-dlp --dump-json ────────────────
    const metaArgs = [
      ...YTDLP_COMMON_ARGS,
      '--dump-json',
      cleanUrl,
    ];
    
    console.log(`[extract] Starting for: ${cleanUrl}`);
    const { stdout: metaOut } = await spawnPromise('yt-dlp', metaArgs, 30000);
    const videoData = JSON.parse(metaOut);
    
    const title = videoData.title || videoData.fulltitle || 'TikTok Video';
    const author = videoData.uploader || 'TikTok User';
    const uploaderId = videoData.uploader_id || author.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    // Fallback to highest quality thumbnail available
    let cover = '';
    if (videoData.thumbnails && videoData.thumbnails.length > 0) {
      cover = videoData.thumbnails[videoData.thumbnails.length - 1].url;
    } else {
      cover = videoData.thumbnail || '';
    }

    // Find the highest quality unwatermarked video
    let bestFormat = null;
    let maxPixels = 0;

    if (videoData.formats && videoData.formats.length > 0) {
      for (const format of videoData.formats) {
        // Skip formats that are explicitly audio-only or have a 'watermarked' note
        if (format.vcodec === 'none' || (format.format_note && format.format_note.toLowerCase().includes('watermarked'))) {
          continue;
        }
        
        const width = format.width || 0;
        const height = format.height || 0;
        const pixels = width * height;
        const tbr = format.tbr || 0;
        
        if (pixels > maxPixels || (pixels === maxPixels && bestFormat && tbr > bestFormat.tbr)) {
          maxPixels = pixels;
          bestFormat = format;
        }
      }
    }

    const hd_url = (bestFormat && bestFormat.url) ? bestFormat.url : (videoData.url || (videoData.formats && videoData.formats.length > 0 ? videoData.formats[videoData.formats.length - 1].url : ''));

    console.log(`[success] Extracted direct URL for: ${cleanUrl}`);

    return res.json({
      status: 'success',
      data: {
        title,
        author: {
          nickname:  author,
          unique_id: uploaderId,
          avatar:    '', // yt-dlp doesn't easily fetch avatar directly without extra parsing
        },
        cover,
        hd_url: hd_url,
        sd_url: hd_url,
        images: [],
        http_headers: videoData.http_headers || {}, // Can implement slide extraction if needed
      },
    });

  } catch (err) {
    console.error('[error]', err.message || err);

    return res.status(500).json({
      status: 'error',
      message: 'Failed to process video. It may be private, deleted, or temporarily unavailable.',
    });
  }
});

// ─── Auto-cleanup: delete files older than 30 minutes ────────────────────────
cron.schedule('*/15 * * * *', () => {
  console.log('[cron] Running cleanup...');
  const maxAge = 30 * 60 * 1000;
  const now = Date.now();

  const cleanDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdir(dir, (err, files) => {
      if (err) return console.error(`[cron] readdir error: ${err}`);
      files.forEach(file => {
        if (file === '.gitkeep') return;
        const fp = path.join(dir, file);
        fs.stat(fp, (err2, stats) => {
          if (err2) return;
          if (now - stats.mtimeMs > maxAge) {
            fs.unlink(fp, (err3) => {
              if (!err3) console.log(`[cron] Deleted: ${file}`);
            });
          }
        });
      });
    });
  };

  cleanDir(tempDir);
  cleanDir(downloadsDir);
});

app.listen(PORT, () => {
  console.log(`[server] VPS Backend running on port ${PORT} | BASE_URL: ${BASE_URL}`);
});
