// app/api/yt/route.ts
import type { NextRequest } from "next/server";
import { spawn, spawnSync } from "node:child_process";

export const runtime = "nodejs";
export const maxDuration = 300;

const YTDLP_BIN_ENV = process.env.YTDLP_BIN;
const FFMPEG_PATH_ENV = process.env.FFMPEG_PATH;

type Body = { url?: string; format?: "mp3" | "mp4" | "wav" };

export async function POST(req: NextRequest) {
  try {
    const { url = "", format = "mp3" } = (await req.json()) as Body;
    const fmt = (format || "mp3").toLowerCase() as "mp3" | "mp4" | "wav";

    if (!isValidYouTubeUrl(url)) return jsonBad(400, "Invalid URL. Only youtube.com/youtu.be are allowed.");
    if (!["mp3", "mp4", "wav"].includes(fmt)) return jsonBad(400, "Invalid format. Use mp3, mp4, or wav.");

    const ytbin = YTDLP_BIN_ENV || which("yt-dlp") || which("youtube-dl");
    if (!ytbin) return jsonBad(500, "yt-dlp not found. Install it or set YTDLP_BIN.");
    const ffmpeg = FFMPEG_PATH_ENV || which("ffmpeg");
    if (!ffmpeg) return jsonBad(500, "FFmpeg not found. Install ffmpeg or set FFMPEG_PATH.");

    // ---- 1) yt-dlp: stream SOURCE -> stdout (no post-processing) ----
    // audio path: bestaudio; video path: best (yt-dlp muxes internally for stdout)
    const ytdlpArgs =
      fmt === "mp4"
        ? [
            "--no-playlist",
            "--restrict-filenames",
            "--no-warnings",
            "--no-part",
            "-f",
            "best",     // let ffmpeg handle container/fragmentation
            "-o",
            "-",        // stdout
            url,
          ]
        : [
            "--no-playlist",
            "--restrict-filenames",
            "--no-warnings",
            "--no-part",
            "-f",
            "bestaudio/best",
            "-o",
            "-",        // stdout
            url,
          ];

    const ytdlp = spawn(ytbin, ytdlpArgs, { stdio: ["ignore", "pipe", "pipe"] });

    // ---- 2) ffmpeg: stdin <- ytdlp.stdout, stdout -> HTTP response ----
    const ffArgs =
      fmt === "mp3"
        ? [
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-vn",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "320k",
            "-f",
            "mp3",
            "pipe:1",
          ]
        : fmt === "wav"
        ? [
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-vn",
            "-f",
            "wav",
            "pipe:1",
          ]
        : [
            // MP4 video: remux to fragmented mp4 so the client can start playing immediately
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-c",
            "copy", // try to avoid re-encode; if incompatible, ffmpeg will complain; you can fall back to re-encode
            "-movflags",
            "+frag_keyframe+empty_moov",
            "-f",
            "mp4",
            "pipe:1",
          ];

    const ff = spawn(ffmpeg, ffArgs, { stdio: ["pipe", "pipe", "pipe"] });

    // pipe yt-dlp -> ffmpeg
    ytdlp.stdout.pipe(ff.stdin);

    // gather errors for useful surfacing
    let ytdlpErr = "";
    let ffErr = "";
    ytdlp.stderr.on("data", (d) => (ytdlpErr += d.toString()));
    ff.stderr.on("data", (d) => (ffErr += d.toString()));

    // wire cancellation both ways
    const cancel = () => {
      try { ytdlp.kill("SIGKILL"); } catch {}
      try { ff.kill("SIGKILL"); } catch {}
    };

    // Create a web ReadableStream from ffmpeg stdout (start sending right away)
    const stream = new ReadableStream({
      start(controller) {
        ff.stdout.on("data", (chunk) => controller.enqueue(chunk));
        ff.stdout.on("end", () => controller.close());
        ff.on("error", (err) => controller.error(err));
        ff.on("close", (code) => {
          // If ffmpeg failed, surface its stderr
          if (code !== 0) controller.error(new Error(ffErr || `ffmpeg exited ${code}`));
        });
        ytdlp.on("close", (code) => {
          if (code !== 0 && !ffErr) {
            // if yt-dlp died but ffmpeg didn't show anything, surface this
            controller.error(new Error(ytdlpErr || `yt-dlp exited ${code}`));
          }
        });
      },
      cancel,
    });

    const headers = new Headers({
      "Content-Type": contentTypeFor(fmt),
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="download.${fmt}"`,
    });

    return new Response(stream, { headers });
  } catch (e: any) {
    return jsonBad(500, `Download failed: ${e?.message || e}`);
  }
}

/* ------------------ helpers ------------------ */

function which(cmd: string): string | null {
  try {
    const out = spawnSync("which", [cmd], { encoding: "utf8" });
    const p = out.stdout.trim();
    return p ? p : null;
  } catch {
    return null;
  }
}
function isValidYouTubeUrl(u: string) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    return host.endsWith("youtube.com") || host === "youtu.be" || host.endsWith("m.youtube.com");
  } catch {
    return false;
  }
}
function contentTypeFor(fmt: "mp3" | "mp4" | "wav") {
  switch (fmt) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "mp4":
      return "video/mp4";
  }
}
function jsonBad(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
