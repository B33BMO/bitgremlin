import { NextRequest } from "next/server";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createReadStream, promises as fsp } from "node:fs";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const maxDuration = 300; // up to 5 min to be safe

// Optional overrides
const YTDLP_BIN = process.env.YTDLP_BIN || "/usr/local/bin/yt-dlp";
const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";

type Body = { url?: string; format?: "mp3" | "mp4" | "wav" };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const url = (body.url || "").trim();
    const format = (body.format || "mp3").toLowerCase() as "mp3" | "mp4" | "wav";

    // basic validation
    if (!isValidYouTubeUrl(url)) {
      return jsonBad(400, "Invalid URL. Only youtube.com/youtu.be are allowed.");
    }
    if (!["mp3", "mp4", "wav"].includes(format)) {
      return jsonBad(400, "Invalid format. Use mp3, mp4, or wav.");
    }

    // temp paths
    const id = randomUUID();
    const outBase = join(tmpdir(), `yt-${id}-%(id)s`);
    const outFinal = join(tmpdir(), `yt-${id}.${format === "mp4" ? "mp4" : format}`);
    const commonArgs = [
      "--no-playlist",
      "--no-warnings",
      "--restrict-filenames",
      "--ffmpeg-location", FFMPEG_PATH,
      "-o", `${outBase}.%(ext)s`,
      url,
    ];

    let args: string[] = [];
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
        ...commonArgs
      ];
    }

    // actually run it
    await runYtDlp(args);

    // resolve which file yt-dlp created (may have %-replaced names)
    const produced = await resolveOutputFile(tmpdir(), id, format);
    if (!produced) {
      throw new Error("Download succeeded but file not found");
    }

    // move/rename to consistent final name for clean streaming & cleanup
    await fsp.rename(produced, outFinal);

    // stream
    const stream = createReadStream(outFinal);
    const headers = new Headers();
    headers.set("Content-Type", contentTypeFor(format));
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Disposition", `attachment; filename="download.${format}"`);
    headers.set("X-Downloader", "yt-dlp");

    // after response completes, unlink the file
    // next will close the stream when done; schedule cleanup
    stream.on("close", () => {
      fsp.unlink(outFinal).catch(() => {});
    });

    return new Response(stream as any, { headers });
  } catch (e: any) {
    return jsonBad(500, `Download failed: ${e?.message || e}`);
  }
}

function isValidYouTubeUrl(u: string) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    return (
      host.endsWith("youtube.com") ||
      host === "youtu.be" ||
      host.endsWith("m.youtube.com")
    );
  } catch {
    return false;
  }
}

function runYtDlp(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
  });
}

async function resolveOutputFile(dir: string, id: string, format: "mp3"|"mp4"|"wav") {
  // find a file starting with `yt-<id>-` and extension matching
  const entries = await fsp.readdir(dir);
  const ext = format === "mp4" ? ".mp4" : `.${format}`;
  const match = entries.find((n) => n.startsWith(`yt-${id}-`) && n.endsWith(ext));
  if (match) return join(dir, match);

  // sometimes yt-dlp already merged/converted to direct name without middle id
  const alt = entries.find((n) => n.startsWith(`yt-${id}`) && n.endsWith(ext));
  return alt ? join(dir, alt) : null;
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
