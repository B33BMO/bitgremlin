import { NextRequest } from "next/server";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createReadStream, createWriteStream, promises as fsp } from "node:fs";
import { Readable } from "node:stream";
import { spawn, spawnSync } from "node:child_process";

export const runtime = "nodejs";
export const maxDuration = 300; // allow up to 5 min processing

const FFMPEG_PATH = process.env.FFMPEG_PATH || which("ffmpeg") || "/usr/bin/ffmpeg";

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return bad(400, "Expected multipart/form-data");
    }

    const form = await req.formData();
    const file = form.get("file") as unknown as File | null;
    if (!file || typeof (file as any).stream !== "function") {
      return bad(400, "Missing file");
    }

    const fmt = String(form.get("format") || "mp3").toLowerCase();
    const normalize = String(form.get("normalize") || "0") === "1";
    const start = form.get("start") ? clampNum(Number(form.get("start")), 0, 24 * 3600) : undefined;
    const end = form.get("end") ? clampNum(Number(form.get("end")), 0, 24 * 3600) : undefined;
    const bitrate = form.get("bitrate") ? String(form.get("bitrate")) : undefined;
    const sr = form.get("samplerate") ? String(form.get("samplerate")) : undefined;

    if (!["mp3", "wav", "flac", "ogg", "aac"].includes(fmt)) {
      return bad(400, "Invalid format");
    }
    if (!FFMPEG_PATH) {
      return bad(500, "ffmpeg not found on server");
    }

    // ────────────────────────────────
    // stream the upload to temp file
    // ────────────────────────────────
    const id = randomUUID();
    const inPath = join(tmpdir(), `aud-${id}-in`);
    const outExt = fmt === "aac" ? "m4a" : fmt;
    const outPath = join(tmpdir(), `aud-${id}-out.${outExt}`);

    const webStream = (file as any).stream();
    const nodeStream = Readable.fromWeb(webStream);
    await new Promise<void>((resolve, reject) => {
      const dest = createWriteStream(inPath);
      nodeStream.pipe(dest);
      dest.on("finish", resolve);
      dest.on("error", reject);
    });

    // ────────────────────────────────
    // build ffmpeg args
    // ────────────────────────────────
    const args: string[] = ["-hide_banner", "-y", "-i", inPath];
    if (typeof start === "number" && start > 0) args.push("-ss", String(start));
    if (typeof end === "number" && end > 0) args.push("-to", String(end));
    if (sr) args.push("-ar", sr);

    const filters: string[] = [];
    if (normalize) filters.push("loudnorm=I=-14:TP=-1.5:LRA=11");
    if (filters.length) args.push("-af", filters.join(","));

    switch (fmt) {
      case "mp3":
        args.push("-c:a", "libmp3lame", "-b:a", `${bitrate || "192"}k`);
        break;
      case "aac":
        args.push("-c:a", "aac", "-b:a", `${bitrate || "192"}k`);
        break;
      case "ogg":
        args.push("-c:a", "libvorbis", "-q:a", "5");
        break;
      case "flac":
        args.push("-c:a", "flac");
        break;
      case "wav":
        args.push("-c:a", "pcm_s16le");
        break;
    }
    args.push(outPath);

    await run(FFMPEG_PATH, args);

    // ────────────────────────────────
    // stream output back to client
    // ────────────────────────────────
    const stream = createReadStream(outPath);
    const ctOut = contentType(outExt);
    const headers = new Headers({
      "Content-Type": ctOut,
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="output.${outExt}"`
    });

    stream.on("close", async () => {
      await Promise.allSettled([fsp.unlink(inPath), fsp.unlink(outPath)]);
    });

    return new Response(stream as any, { headers });
  } catch (e: any) {
    return bad(500, `Audio processing failed: ${e?.message || e}`);
  }
}

/* ────────────── helpers ────────────── */

function which(bin: string): string | null {
  try {
    const res = spawnSync("which", [bin], { encoding: "utf8" });
    return res.stdout.trim() || null;
  } catch {
    return null;
  }
}

function run(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err || `ffmpeg exited ${code}`))));
  });
}

function clampNum(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function contentType(ext: string) {
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    case "ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}

function bad(status: number, msg: string) {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}
