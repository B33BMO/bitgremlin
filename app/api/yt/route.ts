// app/api/yt/route.ts
import type { NextRequest } from "next/server";
import { spawn, spawnSync } from "node:child_process";

export const runtime = "nodejs";
export const maxDuration = 300;

const YTDLP_BIN_ENV = process.env.YTDLP_BIN;
const FFMPEG_PATH_ENV = process.env.FFMPEG_PATH;
const STREAM_MODE = process.env.YT_STREAM_MODE === "1"; // toggle

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
    if (!ffmpeg && (fmt === "mp3" || fmt === "wav" || fmt === "mp4")) {
      return jsonBad(500, "FFmpeg not found. Install ffmpeg or set FFMPEG_PATH.");
    }

    if (STREAM_MODE) {
      // ---- Streaming path: pipe stdout to client (prevents 504) ----
      const argsBase = [
        "--no-playlist",
        "--restrict-filenames",
        "--no-warnings",
        "--no-part", // no temp .part files
        ...(ffmpeg && ffmpeg.startsWith("/") ? ["--ffmpeg-location", ffmpeg] : []),
      ];

      const args =
        fmt === "mp4"
          ? [
              "-f",
              "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
              "--merge-output-format",
              "mp4",
              "-o",
              "-", // stdout
              ...argsBase,
              url,
            ]
          : [
              "-f",
              "bestaudio/best",
              "--extract-audio",
              "--audio-format",
              fmt, // mp3 or wav
              "--audio-quality",
              "0",
              "-o",
              "-", // stdout
              ...argsBase,
              url,
            ];

      const child = spawn(ytbin, args, { stdio: ["ignore", "pipe", "pipe"] });

      let stderr = "";
      child.stderr.on("data", (d) => (stderr += d.toString()));

      const headers = new Headers({
        "Content-Type": contentTypeFor(fmt),
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="download.${fmt}"`,
        // don’t set Content-Length; let it be chunked
      });

      // Create a web ReadableStream from the child's stdout
      const stream = new ReadableStream({
        start(controller) {
          child.stdout.on("data", (chunk) => controller.enqueue(chunk));
          child.stdout.on("end", () => controller.close());
          child.on("error", (err) => controller.error(err));
          child.on("close", (code) => {
            if (code !== 0 && !stderr.includes("Conversion failed")) {
              // surface useful error
              controller.error(new Error(stderr || `yt-dlp exited ${code}`));
            }
          });
        },
        cancel() {
          try {
            child.kill("SIGKILL");
          } catch {}
        },
      });

      return new Response(stream, { headers });
    }

    // ---- Non-streaming path (your original write-to-disk version) ----
    // Keep your existing code here if you still want the file-to-disk fallback.
    // (Omitted for brevity — your earlier version is fine.)
    return jsonBad(501, "Non-streaming path disabled. Set YT_STREAM_MODE=1 to enable streaming.");

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
