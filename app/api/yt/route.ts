import { NextRequest } from "next/server";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createReadStream, promises as fsp } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

export const runtime = "nodejs";
export const maxDuration = 300;

// Optional overrides (absolute paths if you set them)
const YTDLP_BIN_ENV = process.env.YTDLP_BIN;   // e.g. /usr/local/bin/yt-dlp
const FFMPEG_PATH_ENV = process.env.FFMPEG_PATH; // e.g. /usr/bin/ffmpeg

type Body = { url?: string; format?: "mp3" | "mp4" | "wav" };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const url = (body.url || "").trim();
    const format = (body.format || "mp3").toLowerCase() as "mp3" | "mp4" | "wav";

    if (!isValidYouTubeUrl(url)) return jsonBad(400, "Invalid URL. Only youtube.com/youtu.be are allowed.");
    if (!["mp3", "mp4", "wav"].includes(format)) return jsonBad(400, "Invalid format. Use mp3, mp4, or wav.");

// Detect binaries
const ytbin = YTDLP_BIN_ENV || which("yt-dlp") || which("youtube-dl");
if (!ytbin) return jsonBad(500, "yt-dlp not found. Install it or set YTDLP_BIN.");
const ffmpeg = FFMPEG_PATH_ENV || which("ffmpeg");
if (!ffmpeg && (format === "mp3" || format === "wav" || format === "mp4")) {
  return jsonBad(500, "FFmpeg not found. Install ffmpeg or set FFMPEG_PATH.");
}

// Temp output template
const id = randomUUID();
const outBase = join(tmpdir(), `yt-${id}-%(id)s`);
const commonArgs = [
  "--no-playlist",
  "--restrict-filenames",
  "--no-warnings",
  "-o", `${outBase}.%(ext)s`,
  url
];

// Build args per format
let args: string[];
if (format === "mp4") {
  args = [
    "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
    "--merge-output-format", "mp4",
    ...commonArgs
  ];
} else {
  args = [
    "-f", "bestaudio/best",
    "--extract-audio",
    "--audio-format", format, // mp3 or wav
    "--audio-quality", "0",
    ...commonArgs
  ];
}

// Only add the ffmpeg flag **once**, and only if it's an absolute path
const finalArgs = ffmpeg && ffmpeg.startsWith("/")
  ? ["--ffmpeg-location", ffmpeg, ...args]
  : args;

// Run
await runYtDlp(ytbin, finalArgs);


    // Find produced file
    const produced = await resolveOutputFile(tmpdir(), id, format);
    if (!produced) throw new Error("Download succeeded but file not found");

    const finalName = join(tmpdir(), `yt-${id}.${format === "mp4" ? "mp4" : format}`);
    await fsp.rename(produced, finalName);

    const stream = createReadStream(finalName);
    const headers = new Headers({
      "Content-Type": contentTypeFor(format),
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="download.${format}"`,
      "X-Downloader": "yt-dlp"
    });
    stream.on("close", () => fsp.unlink(finalName).catch(() => {}));
    return new Response(stream as any, { headers });

  } catch (e: any) {
    return jsonBad(500, `Download failed: ${e?.message || e}`);
  }
}

/* ---------- helpers ---------- */

function which(cmd: string): string | null {
  try {
    const out = spawnSync("which", [cmd], { encoding: "utf8" });
    const p = out.stdout.trim();
    return p ? p : null;
  } catch { return null; }
}

function isValidYouTubeUrl(u: string) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    return host.endsWith("youtube.com") || host === "youtu.be" || host.endsWith("m.youtube.com");
  } catch { return false; }
}

function runYtDlp(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", d => (stderr += d.toString()));
    child.on("close", code => {
      if (code === 0) return resolve();
      reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
  });
}

async function resolveOutputFile(dir: string, id: string, format: "mp3"|"mp4"|"wav") {
  const entries = await fsp.readdir(dir);
  const ext = format === "mp4" ? ".mp4" : `.${format}`;
  // try strict match first
  let match = entries.find(n => n.startsWith(`yt-${id}-`) && n.endsWith(ext));
  if (match) return join(dir, match);
  // fallbacks
  match = entries.find(n => n.startsWith(`yt-${id}`) && n.endsWith(ext));
  if (match) return join(dir, match);
  // yt-dlp sometimes keeps m4a for audio before convert; map to final ext
  if (format === "mp3" || format === "wav") {
    const pre = entries.find(n => n.startsWith(`yt-${id}-`) && (n.endsWith(".m4a") || n.endsWith(".webm") || n.endsWith(".opus")));
    if (pre) return join(dir, pre);
  }
  return null;
}

function contentTypeFor(fmt: "mp3" | "mp4" | "wav") {
  switch (fmt) {
    case "mp3": return "audio/mpeg";
    case "wav": return "audio/wav";
    case "mp4": return "video/mp4";
  }
}

function jsonBad(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
