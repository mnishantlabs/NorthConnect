import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { app } from "electron";
import ytSearch from "yt-search";
import { Readable } from "stream";
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

export function getYtDlpPath(): string {
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) {
    return process.env.YTDLP_PATH;
  }

  const candidates: string[] = [
    path.join(__dirname, "yt-dlp.exe"),
    path.join(__dirname, "..", "yt-dlp.exe"),
    path.join(__dirname, "..", "main", "yt-dlp.exe"),
    path.join(process.cwd(), "bin", "yt-dlp.exe"),
    path.join(process.cwd(), "dist", "main", "yt-dlp.exe"),
  ];

  try {
    if (app?.getPath) {
      candidates.push(path.join(app.getPath("userData"), "bin", "yt-dlp.exe"));
    }
  } catch {}

  try {
    if (typeof process.resourcesPath !== "undefined") {
      candidates.push(path.join(process.resourcesPath, "yt-dlp.exe"));
      candidates.push(path.join(process.resourcesPath, "bin", "yt-dlp.exe"));
    }
  } catch {}

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
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

export async function searchOnlineMusic(query: string, limit = 15): Promise<OnlineTrackResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (trimmed.includes("spotify.com/track/") || trimmed.includes("spotify:track:")) {
    const spotifyMeta = await fetchSpotifyTrackMetadata(trimmed);
    const searchTerm = spotifyMeta ? spotifyMeta.title + " " + spotifyMeta.artist : trimmed;
    const ytResults = await ytSearch(searchTerm);
    if (ytResults?.videos?.length) {
      return ytResults.videos.slice(0, limit).map((v) => ({
        id: v.videoId || v.url,
        title: spotifyMeta?.title || v.title,
        author: spotifyMeta?.artist || v.author.name,
        duration: v.duration.seconds || 0,
        durationFormatted: v.duration.timestamp || formatDuration(v.duration.seconds),
        thumbnail: spotifyMeta?.thumbnail || v.thumbnail || v.image,
        url: v.url,
        views: v.views,
        ago: v.ago,
        source: "spotify" as const,
      }));
    }
  }

  if (
    trimmed.includes("youtube.com/watch") ||
    trimmed.includes("youtu.be/") ||
    trimmed.includes("music.youtube.com/watch")
  ) {
    try {
      const vidId = extractYouTubeId(trimmed);
      if (vidId) {
        const r = await ytSearch({ videoId: vidId });
        if (r) {
          return [
            {
              id: r.videoId || vidId,
              title: r.title,
              author: r.author?.name || "YouTube Music",
              duration: r.duration?.seconds || 0,
              durationFormatted: r.duration?.timestamp || formatDuration(r.duration?.seconds || 0),
              thumbnail: r.thumbnail || r.image,
              url: r.url || trimmed,
              views: r.views,
              ago: r.ago,
              source: "youtube" as const,
            },
          ];
        }
      }
    } catch {}

    const ytResults = await ytSearch(trimmed);
    if (ytResults?.videos?.length) {
      const v = ytResults.videos[0];
      return [
        {
          id: v.videoId || v.url,
          title: v.title,
          author: v.author.name,
          duration: v.duration.seconds,
          durationFormatted: v.duration.timestamp || formatDuration(v.duration.seconds),
          thumbnail: v.thumbnail || v.image,
          url: v.url,
          views: v.views,
          ago: v.ago,
          source: "youtube" as const,
        },
      ];
    }
  }

  try {
    const results = await ytSearch(trimmed);
    if (!results?.videos?.length) return [];

    return results.videos.slice(0, limit).map((v) => ({
      id: v.videoId || v.url,
      title: v.title,
      author: v.author.name,
      duration: v.duration.seconds,
      durationFormatted: v.duration.timestamp || formatDuration(v.duration.seconds),
      thumbnail: v.thumbnail || v.image,
      url: v.url,
      views: v.views,
      ago: v.ago,
      source: "youtube" as const,
    }));
  } catch (err: any) {
    console.error("Failed to search online music:", err);
    return [];
  }
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
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const ffmpegProc = spawn(ffmpegBin, ffmpegArgs, {
    stdio: ["pipe", "pipe", "ignore"],
    windowsHide: true,
  });

  ytdlProc.stdout.pipe(ffmpegProc.stdin);

  const cleanup = () => {
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
