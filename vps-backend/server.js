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
  '--impersonate', 'chrome',
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
      console.log(`[extract] Fetching from TikWM for: ${cleanUrl}`);
      const axios = require('axios');
      
      // Attempt 1: tikwm
      let response = await axios.post('https://www.tikwm.com/api/', { url: cleanUrl, hd: 1 }, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      let data = response.data;
      if (data && data.code === 0 && data.data) {
        console.log(`[success] Extracted via TikWM: ${cleanUrl}`);
        const videoData = data.data;
        
        // Return standard response format
        return res.json({
          status: 'success',
          data: {
            title: videoData.title || '',
            author: {
              nickname: videoData.author?.nickname || '',
              unique_id: videoData.author?.unique_id || '',
              avatar: videoData.author?.avatar || '',
            },
            cover: videoData.cover || '',
            hd_url: videoData.hdplay || videoData.play || '',
            sd_url: videoData.play || '',
            images: videoData.images || [],
          },
        });
      } else {
        throw new Error(data.msg || "TikWM extraction failed");
      }
    } catch (err) {
      console.error('[error] TikWM failed, trying fallback...', err.message || err);
      
      try {
        // Fallback 2: lovetik.com
        const axios = require('axios');
        let response2 = await axios.post('https://lovetik.com/api/ajax/search', `query=${encodeURIComponent(cleanUrl)}`, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        let data2 = response2.data;
        if (data2 && data2.status === 'ok' && data2.links && data2.links.length > 0) {
          console.log(`[success] Extracted via Lovetik: ${cleanUrl}`);
          
          let hd_url = '';
          let sd_url = '';
          
          // Find the best quality mp4
          for (const link of data2.links) {
            if (link.t.includes('MP4')) {
              if (link.s.includes('1080') || link.s.toLowerCase().includes('hd')) {
                hd_url = link.a;
              } else if (!sd_url) {
                sd_url = link.a;
              }
            }
          }
          
          if (!hd_url) hd_url = data2.links[0].a;
          if (!sd_url) sd_url = hd_url;

          return res.json({
            status: 'success',
            data: {
              title: data2.desc || '',
              author: {
                nickname: data2.author_name || '',
                unique_id: data2.author || '',
                avatar: data2.author_a || '',
              },
              cover: data2.cover || '',
              hd_url: hd_url,
              sd_url: sd_url,
              images: [],
            },
          });
        } else {
          throw new Error("Lovetik fallback failed");
        }
      } catch (err2) {
        console.error('[error] Fallback failed:', err2.message || err2);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to process video. It may be private, deleted, or temporarily unavailable.',
        });
      }
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
