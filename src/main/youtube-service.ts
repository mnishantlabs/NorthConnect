import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { app } from "electron";
import { Readable } from "stream";
import YTDlpWrap from "yt-dlp-wrap";
import { getFfmpegPath } from "./voice-audio";

export interface OnlineTrackResult {
  id: string;
  title: string;
  author: string;
  duration: number;
  durationFormatted: string;
  thumbnail: string;
  url: string;
  views?: number;
  ago?: string;
  source: "youtube" | "spotify";
}

let isDownloadingYtDlp = false;

export async function ensureYtDlpBinary(): Promise<string | null> {
  const current = getYtDlpPath();
  if (current && fs.existsSync(current)) {
    return current;
  }

  if (isDownloadingYtDlp) return null;
  isDownloadingYtDlp = true;

  try {
    let targetDir = path.join(process.cwd(), "bin");
    try {
      if (app?.getPath) {
        targetDir = path.join(app.getPath("userData"), "bin");
      }
    } catch {}

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetBinary = path.join(targetDir, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
    if (!fs.existsSync(targetBinary)) {
      await YTDlpWrap.downloadFromGithub(targetBinary);
    }
    isDownloadingYtDlp = false;
    return targetBinary;
  } catch (err) {
    console.error("Failed to auto-download yt-dlp binary:", err);
    isDownloadingYtDlp = false;
    return null;
  }
}

function sanitizeBinaryPath(filePath: string): string {
  if (!filePath) return filePath;
  if (filePath.includes("app.asar") && !filePath.includes("app.asar.unpacked")) {
    const unpacked = filePath.replace("app.asar", "app.asar.unpacked");
    if (fs.existsSync(unpacked)) {
      return unpacked;
    }
  }
  return filePath;
}

export function getYtDlpPath(): string {
  if (process.env.YTDLP_PATH) {
    const p = sanitizeBinaryPath(process.env.YTDLP_PATH);
    if (fs.existsSync(p)) return p;
  }

  const candidates: string[] = [];

  // Packaged Electron resources directory (extraResources / installer locations)
  if (typeof process.resourcesPath !== "undefined") {
    candidates.push(
      path.join(process.resourcesPath, "bin", "yt-dlp.exe"),
      path.join(process.resourcesPath, "yt-dlp.exe"),
      path.join(process.resourcesPath, "app.asar.unpacked", "bin", "yt-dlp.exe"),
      path.join(process.resourcesPath, "app.asar.unpacked", "dist", "main", "yt-dlp.exe")
    );
  }

  // App userData directory (downloaded or user directory)
  try {
    if (app?.getPath) {
      candidates.push(
        path.join(app.getPath("userData"), "bin", "yt-dlp.exe"),
        path.join(app.getPath("userData"), "yt-dlp.exe")
      );
    }
  } catch {}

  candidates.push(
    sanitizeBinaryPath(path.join(__dirname, "yt-dlp.exe")),
    sanitizeBinaryPath(path.join(__dirname, "..", "yt-dlp.exe")),
    sanitizeBinaryPath(path.join(__dirname, "..", "main", "yt-dlp.exe")),
    path.join(process.cwd(), "bin", "yt-dlp.exe"),
    path.join(process.cwd(), "dist", "main", "yt-dlp.exe")
  );

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      const sanitized = sanitizeBinaryPath(c);
      if (fs.existsSync(sanitized)) {
        return sanitized;
      }
    }
  }

  return "yt-dlp";
}

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

async function fetchSpotifyTrackMetadata(spotifyUrl: string): Promise<{ title: string; artist: string; thumbnail?: string } | null> {
  try {
    const oembedUrl = "https://open.spotify.com/oembed?url=" + encodeURIComponent(spotifyUrl);
    const res = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return {
      title: data.title || "",
      artist: data.author_name || data.provider_name || "Spotify",
      thumbnail: data.thumbnail_url,
    };
  } catch {
    return null;
  }
}

export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=)|music\.youtube\.com\/watch\?v=)([\w-]{11})/);
  return match ? match[1] : null;
}

export async function searchWithYtDlp(query: string, limit = 15): Promise<OnlineTrackResult[]> {
  await ensureYtDlpBinary();
  const ytdlBin = getYtDlpPath();

  return new Promise((resolve) => {
    const args = [
      "--flat-playlist",
      "-j",
      "--no-warnings",
      "-q",
      "--default-search",
      `ytsearch${limit}`,
      query,
    ];

    try {
      const proc = spawn(ytdlBin, args, { windowsHide: true });
      let output = "";
      proc.stdout.on("data", (d) => {
        output += d.toString();
      });
      proc.on("error", (err) => {
        console.error("yt-dlp search spawn error:", err);
        resolve([]);
      });
      proc.on("close", (code) => {
        if (!output.trim()) {
          resolve([]);
          return;
        }
        const lines = output.trim().split(/\r?\n/);
        const results: OnlineTrackResult[] = [];
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (!data.id && !data.url) continue;
            const vidId = data.id || extractYouTubeId(data.url) || "";
            const title = typeof data.title === "string" ? data.title : "Unknown Title";
            const author = typeof data.uploader === "string" ? data.uploader : (typeof data.channel === "string" ? data.channel : "YouTube Music");
            const durationSec = typeof data.duration === "number" ? data.duration : 0;
            const thumbnail = (Array.isArray(data.thumbnails) && data.thumbnails.length > 0)
              ? (data.thumbnails[data.thumbnails.length - 1]?.url || data.thumbnails[0]?.url)
              : `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;
            const url = data.url && data.url.startsWith("http") ? data.url : `https://www.youtube.com/watch?v=${vidId}`;

            results.push({
              id: vidId || url,
              title,
              author,
              duration: durationSec,
              durationFormatted: formatDuration(durationSec),
              thumbnail,
              url,
              views: data.view_count,
              source: "youtube",
            });
          } catch {}
        }
        resolve(results);
      });
    } catch {
      resolve([]);
    }
  });
}

export async function searchOnlineMusic(query: string, limit = 15): Promise<OnlineTrackResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Handle Spotify URLs
  if (trimmed.includes("spotify.com/track/") || trimmed.includes("spotify:track:")) {
    const spotifyMeta = await fetchSpotifyTrackMetadata(trimmed);
    const searchTerm = spotifyMeta ? `${spotifyMeta.title} ${spotifyMeta.artist}` : trimmed;
    const results = await searchWithYtDlp(searchTerm, Math.min(limit, 5));
    if (results.length > 0) {
      return results.map((v, i) => ({
        ...v,
        title: i === 0 && spotifyMeta?.title ? spotifyMeta.title : v.title,
        author: i === 0 && spotifyMeta?.artist ? spotifyMeta.artist : v.author,
        thumbnail: i === 0 && spotifyMeta?.thumbnail ? spotifyMeta.thumbnail : v.thumbnail,
        source: "spotify" as const,
      }));
    }
  }

  // Direct YouTube URL or Query Search
  try {
    const results = await searchWithYtDlp(trimmed, limit);
    return results;
  } catch (err: any) {
    console.error("Failed to search online music:", err);
    return [];
  }
}

export async function resolveDirectAudioUrl(url: string): Promise<string | null> {
  await ensureYtDlpBinary();
  return new Promise((resolve) => {
    const ytdlBin = getYtDlpPath();
    const args = ["-g", "-f", "bestaudio/best", "--no-warnings", "-q", url];
    try {
      const proc = spawn(ytdlBin, args, { windowsHide: true });
      let output = "";
      proc.stdout.on("data", (d) => {
        output += d.toString();
      });
      proc.on("error", () => resolve(null));
      proc.on("close", (code) => {
        const directUrl = output.trim().split(/\r?\n/)[0];
        if (code === 0 && directUrl && directUrl.startsWith("http")) {
          resolve(directUrl);
        } else {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });
}

export interface StreamingProcessHandle {
  stream: Readable;
  processes: ChildProcess[];
  cleanup: () => void;
}

export function createOnlineAudioStream(
  videoUrl: string,
  startSeconds = 0,
  onError?: (err: Error) => void
): StreamingProcessHandle {
  const ytdlBin = getYtDlpPath();
  const ffmpegBin = getFfmpegPath();

  const ytdlArgs = [
    "-f",
    "bestaudio/best",
    "--no-playlist",
    "--no-warnings",
    "-q",
    "-o",
    "-",
    videoUrl,
  ];

  const ffmpegArgs = [
    ...(startSeconds > 0 ? ["-ss", String(startSeconds)] : []),
    "-i",
    "pipe:0",
    "-analyzeduration",
    "0",
    "-loglevel",
    "0",
    "-f",
    "s16le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "pipe:1",
  ];

  const ytdlProc = spawn(ytdlBin, ytdlArgs, {
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  });

  const ffmpegProc = spawn(ffmpegBin, ffmpegArgs, {
    stdio: ["pipe", "pipe", "ignore"],
    windowsHide: true,
  });

  // Attach safe error listeners on pipes to prevent unhandled 'write EOF' / EPIPE crashes
  ytdlProc.stdout.on("error", () => {});
  ffmpegProc.stdin.on("error", () => {});
  ffmpegProc.stdout.on("error", () => {});

  ytdlProc.stdout.pipe(ffmpegProc.stdin);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      ytdlProc.stdout.unpipe(ffmpegProc.stdin);
    } catch {}
    try {
      ytdlProc.kill("SIGKILL");
    } catch {}
    try {
      ffmpegProc.kill("SIGKILL");
    } catch {}
  };

  ffmpegProc.on("close", () => {
    cleanup();
  });

  ytdlProc.on("close", () => {
    try {
      ffmpegProc.stdin.end();
    } catch {}
  });

  ytdlProc.on("error", (err) => {
    onError?.(new Error("yt-dlp error: " + err.message));
    cleanup();
  });

  ffmpegProc.on("error", (err) => {
    onError?.(new Error("FFmpeg error: " + err.message));
    cleanup();
  });

  return {
    stream: ffmpegProc.stdout,
    processes: [ytdlProc, ffmpegProc],
    cleanup,
  };
}
